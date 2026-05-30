import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getToken } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const token = await getToken();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: token.id },
      select: { quotaIzin: true, nama: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Ambil semua izin yang DISETUJUI
    const approvedIzin = await prisma.izin.findMany({
      where: {
        userId: token.id,
        status: 'disetujui'
      },
      select: { tanggal: true }
    });

    // Kelompokkan berdasarkan bulan dari TANGGAL IZIN
    const approvedByMonth: Record<string, number> = {};
    for (const izin of approvedIzin) {
      const monthKey = `${izin.tanggal.getFullYear()}-${izin.tanggal.getMonth() + 1}`;
      approvedByMonth[monthKey] = (approvedByMonth[monthKey] || 0) + 1;
    }

    // Untuk response, kita perlu menentukan bulan mana yang sedang "aktif"
    // Karena izin H-3, kita bisa menampilkan quota untuk bulan dari tanggal izin yang diajukan
    
    // Opsi: Tampilkan semua bulan yang memiliki izin
    const quotaInfo = [];
    for (const [monthKey, used] of Object.entries(approvedByMonth)) {
      quotaInfo.push({
        month: monthKey,
        quota: user.quotaIzin,
        used: used,
        remaining: user.quotaIzin - used,
        canApply: user.quotaIzin - used > 0
      });
    }

    // Atau: Hitung untuk bulan yang akan datang (misal: bulan depan dari sekarang)
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const targetMonthKey = `${nextMonth.getFullYear()}-${nextMonth.getMonth() + 1}`;
    const usedForNextMonth = approvedByMonth[targetMonthKey] || 0;
    const remainingForNextMonth = user.quotaIzin - usedForNextMonth;

    console.log('Quota check (by izin date):', {
      userId: token.id,
      quota: user.quotaIzin,
      targetMonth: targetMonthKey,
      usedForTargetMonth: usedForNextMonth,
      remaining: remainingForNextMonth,
      canApply: remainingForNextMonth > 0,
      allApprovedByMonth: approvedByMonth
    });

    return NextResponse.json({
      quota: user.quotaIzin,
      used: usedForNextMonth,
      remaining: remainingForNextMonth > 0 ? remainingForNextMonth : 0,
      canApply: remainingForNextMonth > 0,
      currentMonth: targetMonthKey,
      details: approvedByMonth
    });
  } catch (error) {
    console.error('Error fetching user quota:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}