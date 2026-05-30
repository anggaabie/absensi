import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getToken } from '@/lib/utils';

// Helper function untuk mendapatkan periode bulan
function getMonthRange(date: Date) {
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { startOfMonth, endOfMonth };
}

// GET - Ambil izin (karyawan lihat punya sendiri, admin lihat semua)
export async function GET(request: Request) {
  try {
    const token = await getToken();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const userId = token.id;
    const role = token.role;

    let where: any = {};

    if (role === 'karyawan') {
      where.userId = userId;
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    const izin = await prisma.izin.findMany({
      where,
      orderBy: { diajukanPada: 'desc' }
    });

    return NextResponse.json(izin);
  } catch (error) {
    console.error('Error fetching izin:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST - Karyawan mengajukan izin (dengan pengecekan quota)
export async function POST(request: Request) {
  try {
    const token = await getToken();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Hanya karyawan yang bisa mengajukan izin
    if (token.role !== 'karyawan') {
      return NextResponse.json({ error: 'Hanya karyawan yang bisa mengajukan izin' }, { status: 403 });
    }

    const { tanggal, alasan } = await request.json();

    if (!tanggal || !alasan) {
      return NextResponse.json({ error: 'Tanggal dan alasan wajib diisi' }, { status: 400 });
    }

    // ========== CEK JATAH IZIN (QUOTA) ==========
    const user = await prisma.user.findUnique({
      where: { id: token.id },
      select: { quotaIzin: true, nama: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    // Hitung jumlah izin yang sudah DISETUJUI bulan ini
    const now = new Date();
    const { startOfMonth, endOfMonth } = getMonthRange(now);

    const approvedCount = await prisma.izin.count({
      where: {
        userId: token.id,
        status: 'disetujui',
        tanggal: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      }
    });

    // Cek apakah masih ada sisa kuota
    if (approvedCount >= user.quotaIzin) {
      return NextResponse.json({ 
        error: `Maaf, jatah izin Anda bulan ini sudah habis (${user.quotaIzin} kali). Silakan hubungi admin.` 
      }, { status: 400 });
    }

    // ========== CEK TANGGAL MINIMAL H-3 ==========
    const tanggalIzin = new Date(tanggal);
    const sekarang = new Date();
    
    tanggalIzin.setHours(0, 0, 0, 0);
    sekarang.setHours(0, 0, 0, 0);
    
    const selisihHari = Math.ceil((tanggalIzin.getTime() - sekarang.getTime()) / (1000 * 3600 * 24));

    if (selisihHari < 3) {
      return NextResponse.json({ 
        error: `Pengajuan izin harus H-3 sebelum tanggal yang diajukan. Minimal ${3 - selisihHari} hari lagi.` 
      }, { status: 400 });
    }

    // ========== CEK DUPLIKASI IZIN ==========
    const existingIzin = await prisma.izin.findFirst({
      where: {
        userId: token.id,
        tanggal: {
          gte: new Date(tanggalIzin.setHours(0, 0, 0, 0)),
          lt: new Date(tanggalIzin.setHours(23, 59, 59, 999))
        }
      }
    });

    if (existingIzin) {
      return NextResponse.json({ 
        error: `Anda sudah pernah mengajukan izin untuk tanggal ${tanggalIzin.toLocaleDateString('id-ID')}. Silakan pilih tanggal lain.` 
      }, { status: 400 });
    }

    // ========== BUAT PENGAJUAN IZIN ==========
    const izin = await prisma.izin.create({
      data: {
        userId: token.id,
        userName: token.nama || user.nama,
        tanggal: tanggalIzin,
        alasan,
        status: 'pending'
      }
    });

    // ========== KIRIM NOTIFIKASI KE ADMIN ==========
    try {
      const admins = await prisma.user.findMany({
        where: { role: 'admin' },
        select: { id: true }
      });

      const notification = await prisma.notification.create({
        data: {
          title: '📋 Pengajuan Izin Baru',
          message: `${token.nama} mengajukan izin pada tanggal ${tanggalIzin.toLocaleDateString('id-ID')}. Sisa jatah: ${user.quotaIzin - (approvedCount + 1)} dari ${user.quotaIzin}`,
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
    } catch (notifError) {
      console.error('Error sending notification:', notifError);
    }

    return NextResponse.json({ 
      success: true, 
      data: izin, 
      message: 'Pengajuan izin berhasil dikirim',
      remainingQuota: user.quotaIzin - (approvedCount + 1)
    });
  } catch (error) {
    console.error('Error creating izin:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PUT - Admin menyetujui/menolak izin (dengan update quota)
export async function PUT(request: Request) {
  try {
    const token = await getToken();
    if (!token || token.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Hanya admin yang bisa menyetujui/menolak izin' }, { status: 401 });
    }

    const { izinId, status, keterangan } = await request.json();

    if (!izinId || !status) {
      return NextResponse.json({ error: 'ID izin dan status wajib diisi' }, { status: 400 });
    }

    // Ambil data izin sebelum update
    const existingIzin = await prisma.izin.findUnique({
      where: { id: izinId },
      include: { user: true }
    });

    if (!existingIzin) {
      return NextResponse.json({ error: 'Izin tidak ditemukan' }, { status: 404 });
    }

    // Cek apakah status berubah menjadi disetujui (dari sebelumnya belum disetujui)
    const wasApproved = existingIzin.status === 'disetujui';
    const isNowApproved = status === 'disetujui';
    const isNowRejected = status === 'ditolak';

    // Update status izin
    const izin = await prisma.izin.update({
      where: { id: izinId },
      data: {
        status: isNowApproved ? 'disetujui' : 'ditolak',
        keterangan: keterangan || null,
        disetujuiPada: isNowApproved ? new Date() : null
      }
    });

    // ========== UPDATE QUOTA JIKA PERLU ==========
    // Catatan: Quota hanya terpengaruh oleh izin yang DISETUJUI
    // Tidak perlu update manual karena perhitungan quota selalu realtime dari database
    
    // Kirim notifikasi ke karyawan
    try {
      const notification = await prisma.notification.create({
        data: {
          title: isNowApproved ? 'Pengajuan Izin Disetujui' : ' Pengajuan Izin Ditolak',
          message: isNowApproved 
            ? `Pengajuan izin Anda tanggal ${existingIzin.tanggal.toLocaleDateString('id-ID')} telah DISETUJUI.${keterangan ? ` Keterangan: ${keterangan}` : ''}`
            : `Pengajuan izin Anda tanggal ${existingIzin.tanggal.toLocaleDateString('id-ID')} telah DITOLAK.${keterangan ? ` Alasan: ${keterangan}` : ''}`,
          type: isNowApproved ? 'success' : 'warning',
          target: existingIzin.userId
        }
      });

      await prisma.notificationReceipt.create({
        data: {
          notificationId: notification.id,
          userId: existingIzin.userId,
          isRead: false
        }
      });
    } catch (notifError) {
      console.error('Error sending notification:', notifError);
    }

    // Hitung quota terbaru untuk dikembalikan ke response
    const now = new Date();
    const { startOfMonth, endOfMonth } = getMonthRange(now);
    const approvedCount = await prisma.izin.count({
      where: {
        userId: existingIzin.userId,
        status: 'disetujui',
        tanggal: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      }
    });

    const remainingQuota = existingIzin.user.quotaIzin - approvedCount;

    return NextResponse.json({ 
      success: true, 
      data: izin, 
      message: `Izin ${isNowApproved ? 'disetujui' : 'ditolak'}`,
      remainingQuota: remainingQuota > 0 ? remainingQuota : 0
    });
  } catch (error) {
    console.error('Error updating izin:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE - Admin menghapus izin (opsional)
export async function DELETE(request: Request) {
  try {
    const token = await getToken();
    if (!token || token.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const izinId = searchParams.get('id');

    if (!izinId) {
      return NextResponse.json({ error: 'ID izin wajib diisi' }, { status: 400 });
    }

    // Ambil data izin sebelum dihapus
    const izin = await prisma.izin.findUnique({
      where: { id: izinId }
    });

    if (!izin) {
      return NextResponse.json({ error: 'Izin tidak ditemukan' }, { status: 404 });
    }

    await prisma.izin.delete({
      where: { id: izinId }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Izin berhasil dihapus',
      deletedData: { userId: izin.userId, tanggal: izin.tanggal }
    });
  } catch (error) {
    console.error('Error deleting izin:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}