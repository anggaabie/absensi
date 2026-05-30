import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PUT - Update jatah izin karyawan (hanya admin)
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, quota } = body;

    if (!userId || quota === undefined) {
      return NextResponse.json({ error: 'User ID dan quota wajib diisi' }, { status: 400 });
    }

    if (quota < 0 || quota > 12) {
      return NextResponse.json({ error: 'Quota harus antara 0-12' }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { quotaIzin: quota },
      select: { id: true, name: true, email: true, quotaIzin: true }
    });

    return NextResponse.json({ 
      success: true, 
      message: `Jatah izin ${user.name} berhasil diupdate menjadi ${quota} kali per bulan`,
      data: user 
    });
  } catch (error) {
    console.error('Error updating user quota:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}