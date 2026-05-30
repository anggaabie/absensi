import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    // Validasi input
    if (!email || !password) {
      return NextResponse.json({ error: 'Email dan password wajib diisi' }, { status: 400 });
    }

    // Cari user di database
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return NextResponse.json({ error: 'Email tidak ditemukan' }, { status: 401 });
    }

    // Verifikasi password
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return NextResponse.json({ error: 'Password salah' }, { status: 401 });
    }

    // Buat JWT token
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    
    const token = await new SignJWT({ 
      id: user.id, 
      email: user.email, 
      role: user.role,
      nama: user.nama 
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1d')
      .sign(secret);

    // Buat response dengan data user
    const response = NextResponse.json({ 
      success: true,
      role: user.role, 
      nama: user.nama,
      email: user.email,
      id: user.id
    });

    // Set cookie dengan token
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 86400, // 24 jam
      path: '/'
    });

    console.log(`User login: ${user.nama} (${user.email}) - Role: ${user.role}`);
    
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}