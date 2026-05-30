import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getToken } from '@/lib/utils';

// GET - Ambil semua pengaturan (bisa diakses semua user yang login)
export async function GET() {
  try {
    const token = await getToken();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ambil semua settings dari database
    const settings = await prisma.setting.findMany();
    
    // Konversi ke object key-value
    const settingsMap: Record<string, string> = {};
    settings.forEach((s: any) => {
      settingsMap[s.key] = s.value;
    });

    // Default settings jika tidak ada di database
    const defaultSettings = {
      jam_masuk: settingsMap.jam_masuk || '08:00',
      jam_keluar: settingsMap.jam_keluar || '17:00',
      toleransi_terlambat: settingsMap.toleransi_terlambat || '15',
      lokasi_kantor_lat: settingsMap.lokasi_kantor_lat || process.env.NEXT_PUBLIC_KANTOR_LAT || '-7.370758',
      lokasi_kantor_lng: settingsMap.lokasi_kantor_lng || process.env.NEXT_PUBLIC_KANTOR_LNG || '108.248837',
      radius_absen: settingsMap.radius_absen || '10',
      quota_izin_default: settingsMap.quota_izin_default || '3'  // <-- TAMBAHKAN INI
    };

    return NextResponse.json(defaultSettings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST - Simpan/update pengaturan (hanya admin)
export async function POST(request: Request) {
  try {
    const token = await getToken();
    // Hanya admin yang bisa menyimpan/update settings
    if (!token || token.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Hanya admin yang bisa mengubah pengaturan' }, { status: 401 });
    }

    const body = await request.json();
    
    // Data settings yang akan disimpan
    const settingsData = [
      { key: 'jam_masuk', value: body.jam_masuk, description: 'Jam masuk kerja' },
      { key: 'jam_keluar', value: body.jam_keluar, description: 'Jam keluar kerja' },
      { key: 'toleransi_terlambat', value: body.toleransi_terlambat, description: 'Toleransi keterlambatan (menit)' },
      { key: 'lokasi_kantor_lat', value: body.lokasi_kantor_lat, description: 'Latitude lokasi kantor' },
      { key: 'lokasi_kantor_lng', value: body.lokasi_kantor_lng, description: 'Longitude lokasi kantor' },
      { key: 'radius_absen', value: body.radius_absen, description: 'Radius absen (meter)' },
      { key: 'quota_izin_default', value: body.quota_izin_default || '3', description: 'Jatah izin default per bulan untuk karyawan baru' }  // <-- TAMBAHKAN INI
    ];

    // Upsert (update jika ada, create jika belum ada) setiap setting
    for (const setting of settingsData) {
      await prisma.setting.upsert({
        where: { key: setting.key },
        update: { value: setting.value, description: setting.description },
        create: { key: setting.key, value: setting.value, description: setting.description }
      });
    }

    // Optional: Update semua user yang memiliki quota null dengan nilai default
    const defaultQuota = parseInt(body.quota_izin_default || '3');
    await prisma.user.updateMany({
      where: { quotaIzin: null },
      data: { quotaIzin: defaultQuota }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Pengaturan berhasil disimpan',
      data: {
        jam_masuk: body.jam_masuk,
        jam_keluar: body.jam_keluar,
        toleransi_terlambat: body.toleransi_terlambat,
        radius_absen: body.radius_absen,
        quota_izin_default: defaultQuota
      }
    });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PUT - Update single setting (opsional, bisa digunakan untuk update per key)
export async function PUT(request: Request) {
  try {
    const token = await getToken();
    if (!token || token.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Hanya admin yang bisa mengubah pengaturan' }, { status: 401 });
    }

    const { key, value } = await request.json();

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'Key dan value wajib diisi' }, { status: 400 });
    }

    const allowedKeys = [
      'jam_masuk', 'jam_keluar', 'toleransi_terlambat',
      'lokasi_kantor_lat', 'lokasi_kantor_lng', 'radius_absen',
      'quota_izin_default'
    ];

    if (!allowedKeys.includes(key)) {
      return NextResponse.json({ error: 'Key tidak valid' }, { status: 400 });
    }

    const setting = await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value, description: `Pengaturan untuk ${key}` }
    });

    // Jika update quota_izin_default, update user yang memiliki quota null
    if (key === 'quota_izin_default') {
      const defaultQuota = parseInt(value);
      await prisma.user.updateMany({
        where: { quotaIzin: null },
        data: { quotaIzin: defaultQuota }
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Pengaturan ${key} berhasil disimpan`,
      data: setting 
    });
  } catch (error) {
    console.error('Error updating setting:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}