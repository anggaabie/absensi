import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getToken } from '@/lib/utils';

export async function GET() {
  try {
    const token = await getToken();
    if (!token || token.role !== 'karyawan') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const absenHariIni = await prisma.absen.findFirst({
      where: {
        userId: token.id,
        timestamp: { gte: today }
      }
    });

    return NextResponse.json({
      sudahAbsen: !!absenHariIni,
      status: absenHariIni?.status
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}