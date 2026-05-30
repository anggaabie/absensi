import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getToken } from '@/lib/utils';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken();
    if (!token || token.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { nama, email } = await request.json();

    if (!nama || !email) {
      return NextResponse.json({ error: 'Nama dan email wajib diisi' }, { status: 400 });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        email: email,
        NOT: { id: id }
      }
    });

    if (existingUser) {
      return NextResponse.json({ error: 'Email sudah digunakan oleh karyawan lain' }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: id },
      data: { nama, email }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Data karyawan berhasil diupdate',
      data: { id: user.id, nama: user.nama, email: user.email }
    });
  } catch (error) {
    console.error('Edit karyawan error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken();
    if (!token || token.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id: id }
    });

    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    await prisma.user.delete({
      where: { id: id }
    });

    return NextResponse.json({ 
      success: true, 
      message: `Karyawan ${user.nama} berhasil dihapus` 
    });
  } catch (error) {
    console.error('Delete karyawan error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}