// app/api/auth/face-login/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateFaceDistance } from '@/lib/utils';

export async function POST(request: Request) {
  try {
    const { faceDescriptor } = await request.json();

    if (!faceDescriptor || !Array.isArray(faceDescriptor)) {
      return NextResponse.json({ error: 'Face descriptor tidak valid' }, { status: 400 });
    }

    // Ambil semua user
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        nama: true,
        email: true,
        role: true,
        faceDescriptor: true,
      },
    });

    // Filter user yang memiliki faceDescriptor
    const usersWithFace = allUsers.filter(user => user.faceDescriptor !== null);

    if (usersWithFace.length === 0) {
      return NextResponse.json({ error: 'Belum ada user yang terdaftar wajahnya' }, { status: 404 });
    }

    let bestMatch = null;
    let minDistance = 0.6;

    for (const user of usersWithFace) {
      const distance = calculateFaceDistance(faceDescriptor, user.faceDescriptor as number[]);
      if (distance < minDistance) {
        minDistance = distance;
        bestMatch = user;
      }
    }

    if (!bestMatch) {
      return NextResponse.json({ error: 'Wajah tidak dikenali' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: bestMatch.id,
        nama: bestMatch.nama,
        email: bestMatch.email,
        role: bestMatch.role,
      },
    });
  } catch (error) {
    console.error('Face login error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}