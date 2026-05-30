import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { getToken } from '@/lib/utils';

// POST - Admin menambahkan karyawan baru
export async function POST(request: Request) {
  try {
    const token = await getToken();
    if (!token || token.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Hanya admin yang bisa menambah karyawan' }, { status: 401 });
    }

    const { nama, email, password, role } = await request.json();

    // Validasi input
    if (!nama || !email || !password) {
      return NextResponse.json({ error: 'Nama, email, dan password wajib diisi' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 });
    }

    // Cek apakah email sudah terdaftar
    const existing = await prisma.user.findUnique({
      where: { email }
    });

    if (existing) {
      return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 400 });
    }

    // ========== AMBIL JATAH IZIN DEFAULT DARI SETTINGS ==========
    const settings = await prisma.setting.findMany();
    const settingsMap: Record<string, string> = {};
    settings.forEach((s: any) => {
      settingsMap[s.key] = s.value;
    });
    
    // Default quota izin (3 jika tidak ada setting)
    const defaultQuota = parseInt(settingsMap.quota_izin_default || '3');

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Buat user baru dengan quota izin dari settings
    const user = await prisma.user.create({
      data: {
        nama,
        email,
        password: hashedPassword,
        role: role || 'karyawan',
        quotaIzin: defaultQuota  // <-- TAMBAHKAN INI
      },
      select: {
        id: true,
        nama: true,
        email: true,
        role: true,
        quotaIzin: true,  // <-- TAMBAHKAN INI
        createdAt: true
      }
    });

    // ========== KIRIM NOTIFIKASI KE ADMIN (Opsional) ==========
    try {
      // Cari admin lain untuk dikirimi notifikasi
      const admins = await prisma.user.findMany({
        where: { 
          role: 'admin',
          id: { not: token.id } // kecuali admin yang sedang login
        },
        select: { id: true }
      });

      if (admins.length > 0) {
        const notification = await prisma.notification.create({
          data: {
            title: 'Karyawan Baru Ditambahkan',
            message: `Admin ${token.nama} telah menambahkan karyawan baru: ${nama} (${email}) dengan jatah izin ${defaultQuota} kali per bulan.`,
            type: 'info',
            target: 'admin'
          }
        });

        for (const admin of admins) {
          await prisma.notificationReceipt.create({
            data: {
              notificationId: notification.id,
              userId: admin.id,
              isRead: false
            }
          });
        }
      }
    } catch (notifError) {
      console.error('Error sending notification:', notifError);
      // Tidak mengembalikan error karena registrasi tetap berhasil
    }

    return NextResponse.json({ 
      success: true,
      message: `Karyawan berhasil ditambahkan dengan jatah izin ${defaultQuota} kali per bulan`,
      data: user
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// GET - Ambil daftar karyawan (hanya admin)
export async function GET(request: Request) {
  try {
    const token = await getToken();
    if (!token || token.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Hanya admin yang bisa melihat daftar karyawan' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '50');

    const users = await prisma.user.findMany({
      where: {
        role: 'karyawan',
        OR: [
          { nama: { contains: search } },
          { email: { contains: search } }
        ]
      },
      select: {
        id: true,
        nama: true,
        email: true,
        role: true,
        quotaIzin: true,
        createdAt: true,
        _count: {
          select: {
            izin: {
              where: {
                status: 'disetujui',
                tanggal: {
                  gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                  lte: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    // Format response dengan sisa jatah
    const formattedUsers = users.map(user => ({
      id: user.id,
      nama: user.nama,
      email: user.email,
      role: user.role,
      quotaIzin: user.quotaIzin,
      izinTerpakai: user._count.izin,
      sisaIzin: user.quotaIzin - user._count.izin,
      createdAt: user.createdAt
    }));

    return NextResponse.json({
      success: true,
      data: formattedUsers,
      total: formattedUsers.length
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PUT - Update jatah izin karyawan (hanya admin)
export async function PUT(request: Request) {
  try {
    const token = await getToken();
    if (!token || token.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Hanya admin yang bisa mengubah jatah izin' }, { status: 401 });
    }

    const { userId, quotaIzin } = await request.json();

    if (!userId || quotaIzin === undefined) {
      return NextResponse.json({ error: 'User ID dan quota izin wajib diisi' }, { status: 400 });
    }

    if (quotaIzin < 0 || quotaIzin > 12) {
      return NextResponse.json({ error: 'Jatah izin harus antara 0-12' }, { status: 400 });
    }

    // Cek apakah user ada
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, nama: true, email: true, quotaIzin: true, role: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    if (user.role !== 'karyawan') {
      return NextResponse.json({ error: 'Hanya karyawan yang bisa diubah jatah izinnya' }, { status: 400 });
    }

    // Update quota izin
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { quotaIzin },
      select: {
        id: true,
        nama: true,
        email: true,
        role: true,
        quotaIzin: true,
        updatedAt: true
      }
    });

    // Kirim notifikasi ke karyawan
    try {
      const notification = await prisma.notification.create({
        data: {
          title: 'Jatah Izin Diperbarui',
          message: `Jatah izin Anda telah diubah dari ${user.quotaIzin} menjadi ${quotaIzin} kali per bulan oleh admin ${token.nama}.`,
          type: 'info',
          target: userId
        }
      });

      await prisma.notificationReceipt.create({
        data: {
          notificationId: notification.id,
          userId: userId,
          isRead: false
        }
      });
    } catch (notifError) {
      console.error('Error sending notification:', notifError);
    }

    return NextResponse.json({ 
      success: true, 
      message: `Jatah izin ${user.nama} berhasil diubah dari ${user.quotaIzin} menjadi ${quotaIzin} kali per bulan`,
      data: updatedUser
    });
  } catch (error) {
    console.error('Error updating user quota:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE - Hapus karyawan (hanya admin)
export async function DELETE(request: Request) {
  try {
    const token = await getToken();
    if (!token || token.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Hanya admin yang bisa menghapus karyawan' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ error: 'User ID wajib diisi' }, { status: 400 });
    }

    // Cek apakah user ada dan bukan admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, nama: true, role: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    if (user.role === 'admin') {
      return NextResponse.json({ error: 'Tidak dapat menghapus akun admin' }, { status: 400 });
    }

    // Hapus user (cascade akan menghapus absen, izin, dll)
    await prisma.user.delete({
      where: { id: userId }
    });

    return NextResponse.json({ 
      success: true, 
      message: `Karyawan ${user.nama} berhasil dihapus`
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}