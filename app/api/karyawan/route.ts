import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getToken } from '@/lib/utils';

// Definisikan tipe untuk karyawan
interface KaryawanData {
  id: string;
  nama: string;
  email: string;
  faceDescriptor: any;
  profileImage: string | null;
  createdAt: Date;
}

export async function GET() {
  try {
    const token = await getToken();
    if (!token || token.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const karyawan: KaryawanData[] = await prisma.user.findMany({
      where: { role: 'karyawan' },
      select: {
        id: true,
        nama: true,
        email: true,
        faceDescriptor: true,
        profileImage: true,  // <-- TAMBAHKAN INI
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedKaryawan = karyawan.map((k: KaryawanData) => ({
      id: k.id,
      nama: k.nama,
      email: k.email,
      hasFaceData: k.faceDescriptor ? true : false,
      profileImage: k.profileImage,  // <-- TAMBAHKAN INI
      createdAt: k.createdAt
    }));

    return NextResponse.json(formattedKaryawan);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const token = await getToken();
    if (!token || token.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID tidak ditemukan' }, { status: 400 });
    }

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Karyawan berhasil dihapus' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}