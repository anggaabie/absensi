import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getToken } from '@/lib/utils';

export async function POST(request: Request) {
  try {
    const token = await getToken();
    if (!token || token.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, faceDescriptor, faceImage } = await request.json();

    if (!faceDescriptor || faceDescriptor.length !== 128) {
      return NextResponse.json({ error: 'Data wajah tidak valid' }, { status: 400 });
    }

    // Update user dengan faceDescriptor
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        faceDescriptor: faceDescriptor,
        profileImage: faceImage || null
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Data wajah berhasil disimpan',
      data: { id: user.id, nama: user.nama }
    });
  } catch (error) {
    console.error('Upload face error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}