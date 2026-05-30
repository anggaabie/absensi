import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getToken } from '@/lib/utils';

// Definisikan tipe untuk absen
interface AbsenData {
  id: string;
  userName: string;
  timestamp: Date;
  status: string;
  latitude: number;
  longitude: number;
  imageUrl: string | null;
}

export async function GET(request: Request) {
  try {
    const token = await getToken();
    if (!token || token.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const absensi: AbsenData[] = await prisma.absen.findMany({
      orderBy: { timestamp: 'desc' }
    });

    const formattedAbsensi = absensi.map((absen: AbsenData) => ({
      id: absen.id,
      userName: absen.userName,
      timestamp: absen.timestamp,
      status: absen.status,
      location: { lat: absen.latitude, lng: absen.longitude },
      imageUrl: absen.imageUrl
    }));

    return NextResponse.json(formattedAbsensi);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}