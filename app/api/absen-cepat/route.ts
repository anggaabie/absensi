import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getToken } from '@/lib/utils';
import * as faceapi from 'face-api.js';

// Load models di server (hanya sekali saat server start)
let modelsLoaded = false;

async function loadModels() {
  if (modelsLoaded) return;
  
  // Gunakan CDN atau path lokal
  const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
  await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
  await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
  await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
  modelsLoaded = true;
  console.log('Face models loaded on server');
}

// Fungsi untuk menghitung jarak Euclidean
function calculateFaceDistance(desc1: number[], desc2: number[]): number {
  if (!desc1 || !desc2 || desc1.length !== desc2.length) return 1;
  
  let sum = 0;
  for (let i = 0; i < desc1.length; i++) {
    sum += Math.pow(desc1[i] - desc2[i], 2);
  }
  return Math.sqrt(sum);
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Konversi base64 ke Image
async function base64ToImage(base64String: string): Promise<HTMLImageElement> {
  const img = new (globalThis as any).Image();
  const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  
  return new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `data:image/jpeg;base64,${buffer.toString('base64')}`;
  });
}

export async function POST(request: Request) {
  try {
    // Load models di server
    await loadModels();
    
    const token = await getToken();
    if (!token || token.role !== 'karyawan') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { image, location } = await request.json();

    // Gunakan koordinat dari env atau default
    const kantorLat = parseFloat(process.env.NEXT_PUBLIC_KANTOR_LAT || '-7.370758');
    const kantorLng = parseFloat(process.env.NEXT_PUBLIC_KANTOR_LNG || '108.248837');
    const radius = 10; // Radius default 10 meter

    // 1. Validasi lokasi
    const jarak = calculateDistance(location.lat, location.lng, kantorLat, kantorLng);
    
    if (jarak > radius) {
      return NextResponse.json({ 
        error: `Jarak ${Math.round(jarak)} meter dari kantor (maksimal ${radius} meter)` 
      }, { status: 400 });
    }

    // 2. Konversi base64 ke image dan ekstrak face descriptor
    const img = await base64ToImage(image);
    
    const detection = await faceapi
      .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({
        inputSize: 224,
        scoreThreshold: 0.5
      }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection || !detection.descriptor) {
      return NextResponse.json({ error: 'Wajah tidak terdeteksi' }, { status: 400 });
    }

    // Konversi Float32Array ke number[]
    const inputDescriptor = Array.from(detection.descriptor);

    // 3. Ambil data user dari database
    const user = await prisma.user.findUnique({
      where: { id: token.id }
    });

    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    if (!user.faceDescriptor) {
      return NextResponse.json({ error: 'Data wajah belum terdaftar. Silahkan hubungi admin.' }, { status: 400 });
    }

    // 4. Bandingkan face descriptor
    const storedDescriptor = user.faceDescriptor as number[];
    const faceDistance = calculateFaceDistance(inputDescriptor, storedDescriptor);

    console.log(`Face distance: ${faceDistance}`);

    if (faceDistance > 0.6) {
      return NextResponse.json({ error: 'Wajah tidak cocok. Silahkan coba lagi.' }, { status: 400 });
    }

    // 5. Cek sudah absen hari ini
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const existingAbsen = await prisma.absen.findFirst({
      where: {
        userId: user.id,
        timestamp: { gte: today }
      }
    });

    if (existingAbsen) {
      return NextResponse.json({ error: 'Anda sudah melakukan absen hari ini.' }, { status: 400 });
    }

    // 6. Simpan absen
    const currentHour = new Date().getHours();
    const status = currentHour < 9 ? 'hadir' : 'terlambat';

    const absen = await prisma.absen.create({
      data: {
        userId: user.id,
        userName: user.nama,
        latitude: location.lat,
        longitude: location.lng,
        status: status,
        imageUrl: image
      }
    });

    return NextResponse.json({ 
      success: true,
      message: `✅ Absen berhasil! Status: ${status === 'hadir' ? 'Hadir' : 'Terlambat'}`,
      data: { jarak: `${Math.round(jarak)} meter`, status }
    });
    
  } catch (error) {
    console.error('Absen error:', error);
    return NextResponse.json({ error: 'Server error: ' + (error as Error).message }, { status: 500 });
  }
}