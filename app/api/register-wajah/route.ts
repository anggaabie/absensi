import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getToken } from '@/lib/utils';
import * as faceapi from 'face-api.js';

let modelsLoaded = false;

async function loadModels() {
  if (modelsLoaded) return;
  const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
  await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
  await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
  await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
  modelsLoaded = true;
}

async function base64ToImage(base64String: string): Promise<HTMLImageElement> {
  const img = new (globalThis as any).Image();
  return new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = base64String;
  });
}

export async function POST(request: Request) {
  try {
    await loadModels();
    
    const token = await getToken();
    if (!token || token.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, image } = await request.json();

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

    const user = await prisma.user.update({
      where: { id: userId },
      data: { faceDescriptor: Array.from(detection.descriptor) }
    });

    return NextResponse.json({ 
      success: true, 
      message: `Data wajah ${user.nama} berhasil disimpan`
    });
  } catch (error) {
    console.error('Register face error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}