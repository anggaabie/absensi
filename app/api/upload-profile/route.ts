import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getToken } from '@/lib/utils';

export async function POST(request: Request) {
  try {
    const token = await getToken();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { image } = await request.json();

    if (!image) {
      return NextResponse.json({ error: 'Foto tidak ditemukan' }, { status: 400 });
    }

    // Validasi ukuran (maksimal 5MB)
    if (image.length > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ukuran foto maksimal 5MB' }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: token.id },
      data: { profileImage: image }
    });

    return NextResponse.json({
      success: true,
      message: 'Foto profil berhasil diupdate',
      profileImage: image
    });
  } catch (error) {
    console.error('Upload profile error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const token = await getToken();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: token.id },
      data: { profileImage: null }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Foto profil berhasil dihapus' 
    });
  } catch (error) {
    console.error('Delete profile error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}