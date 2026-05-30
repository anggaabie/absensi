import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getToken, calculateFaceDistance, calculateDistance } from '@/lib/utils';

const KANTOR_LAT = parseFloat(process.env.NEXT_PUBLIC_KANTOR_LAT!);
const KANTOR_LNG = parseFloat(process.env.NEXT_PUBLIC_KANTOR_LNG!);

export async function POST(request: Request) {
  try {
    const token = await getToken();
    if (!token || token.role !== 'karyawan') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { faceDescriptor, location, image } = await request.json();

    // Validasi jarak
    const jarak = calculateDistance(
      location.lat, location.lng,
      KANTOR_LAT, KANTOR_LNG
    );

    if (jarak > 10) {
      return NextResponse.json({ 
        error: `❌ Absen ditolak! Jarak Anda ${Math.round(jarak)} meter dari kantor. Maksimal 10 meter.`
      }, { status: 400 });
    }

    // Ambil data user
    const user = await prisma.user.findUnique({
      where: { id: token.id }
    });

    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    // Validasi wajah
    if (!user.faceDescriptor) {
      return NextResponse.json({ 
        error: '❌ Data wajah belum terdaftar. Silahkan hubungi admin.' 
      }, { status: 400 });
    }

    const storedDescriptor = user.faceDescriptor as number[];
    const faceDistance = calculateFaceDistance(faceDescriptor, storedDescriptor);

    if (faceDistance > 0.6) {
      return NextResponse.json({ 
        error: '❌ Wajah tidak cocok dengan data terdaftar.' 
      }, { status: 400 });
    }

    // Cek sudah absen hari ini
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const existingAbsen = await prisma.absen.findFirst({
      where: {
        userId: user.id,
        timestamp: { gte: today }
      }
    });

    if (existingAbsen) {
      return NextResponse.json({ 
        error: '❌ Anda sudah melakukan absen hari ini.' 
      }, { status: 400 });
    }

    // Simpan absen
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
      data: {
        status: status === 'hadir' ? 'Hadir' : 'Terlambat',
        waktu: new Date().toLocaleString('id-ID'),
        jarak: `${Math.round(jarak)} meter`
      }
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}