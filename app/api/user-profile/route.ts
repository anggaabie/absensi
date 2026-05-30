import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getToken } from '@/lib/utils';

export async function GET() {
  try {
    const token = await getToken();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: token.id },
      select: { 
        profileImage: true, 
        nama: true, 
        email: true 
      }
    });

    return NextResponse.json({
      profileImage: user?.profileImage || null,
      nama: user?.nama,
      email: user?.email
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}