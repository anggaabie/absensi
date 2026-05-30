import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getToken } from '@/lib/utils';

export async function GET() {
  try {
    const token = await getToken();
    if (!token || token.role !== 'karyawan') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const absensi = await prisma.absen.findMany({
      where: { userId: token.id },
      orderBy: { timestamp: 'desc' }
    });

    return NextResponse.json(absensi);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}