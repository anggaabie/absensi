import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getToken } from '@/lib/utils';

// GET - Ambil notifikasi untuk user yang login
export async function GET() {
  try {
    const token = await getToken(); // ← Tidak perlu parameter
    console.log('GET Notifications - Token:', token); // Debug
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = token.id; // ← Gunakan token.id, BUKAN token.userId!
    console.log('User ID dari token:', userId);

    const receipts = await prisma.notificationReceipt.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' }
    });

    console.log('Jumlah receipts:', receipts.length);

    if (receipts.length === 0) {
      return NextResponse.json({ notifications: [], unreadCount: 0 });
    }

    const notificationIds = receipts.map(r => r.notificationId);
    const notificationsData = await prisma.notification.findMany({
      where: { id: { in: notificationIds } },
      orderBy: { createdAt: 'desc' }
    });

    const notifications = receipts.map(receipt => {
      const notification = notificationsData.find(n => n.id === receipt.notificationId);
      return {
        id: notification?.id,
        title: notification?.title,
        message: notification?.message,
        type: notification?.type,
        isRead: receipt.isRead,
        createdAt: notification?.createdAt
      };
    }).filter(n => n.id);

    const unreadCount = receipts.filter(r => !r.isRead).length;

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST - Admin kirim notifikasi
export async function POST(request: Request) {
  try {
    const token = await getToken(); // ← Tidak perlu parameter
    console.log('POST Notifications - Token:', token);
    
    if (!token || token.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, message, type, target, specificUserId } = await request.json();

    console.log('=== DEBUG NOTIFIKASI ===');
    console.log('Target:', target);
    console.log('Specific User ID:', specificUserId);
    console.log('Title:', title);

    if (!title || !message) {
      return NextResponse.json({ error: 'Title dan message wajib diisi' }, { status: 400 });
    }

    let userIds: string[] = [];

    // Pilihan 1: Kirim ke semua karyawan
    if (target === 'all_karyawan') {
      const users = await prisma.user.findMany({
        where: { role: 'karyawan' },
        select: { id: true }
      });
      userIds = users.map(u => u.id);
      console.log('Mengirim ke semua karyawan:', userIds.length, 'user');
    } 
    // Pilihan 2: Kirim ke user tertentu
    else if (target === 'specific' && specificUserId && specificUserId !== '') {
      const user = await prisma.user.findUnique({
        where: { id: specificUserId }
      });
      
      if (!user) {
        return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
      }
      
      userIds = [specificUserId];
      console.log('Mengirim ke user spesifik:', user.nama, 'ID:', specificUserId);
    } 
    else {
      return NextResponse.json({ error: 'Target tidak valid' }, { status: 400 });
    }

    if (userIds.length === 0) {
      return NextResponse.json({ error: 'Tidak ada user yang menerima notifikasi' }, { status: 400 });
    }

    // Buat 1 notifikasi
    const notification = await prisma.notification.create({
      data: {
        title,
        message,
        type: type || 'info',
        target: target
      }
    });

    console.log('Notifikasi dibuat dengan ID:', notification.id);

    // Buat receipt untuk setiap user
    for (const userId of userIds) {
      await prisma.notificationReceipt.create({
        data: {
          notificationId: notification.id,
          userId: userId,
          isRead: false
        }
      });
      console.log('Receipt dibuat untuk user:', userId);
    }

    return NextResponse.json({ 
      success: true, 
      message: `Notifikasi berhasil dikirim ke ${userIds.length} user`
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json({ error: 'Server error: ' + (error as Error).message }, { status: 500 });
  }
}

// PUT - Tandai notifikasi sudah dibaca
export async function PUT(request: Request) {
  try {
    const token = await getToken();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { notificationId } = await request.json();
    const userId = token.id; // ← Gunakan token.id

    const receipt = await prisma.notificationReceipt.findFirst({
      where: { notificationId, userId }
    });

    if (!receipt) {
      return NextResponse.json({ error: 'Notifikasi tidak ditemukan' }, { status: 404 });
    }

    await prisma.notificationReceipt.update({
      where: { id: receipt.id },
      data: { 
        isRead: true,
        readAt: new Date()
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}