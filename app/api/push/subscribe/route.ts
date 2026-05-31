// app/api/push/subscribe/route.ts
import { NextResponse } from 'next/server';
import webpush from 'web-push';

// Setup VAPID
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// Simpan subscriptions (SEMENTARA: pakai memory array)
// Di PRODUCTION nanti pake database (PostgreSQL/MySQL)
let subscriptions: any[] = [];

export async function POST(request: Request) {
  try {
    const { subscription } = await request.json();
    
    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }
    
    // Cek apakah sudah ada subscription dengan endpoint yang sama
    const existingIndex = subscriptions.findIndex(
      s => s.endpoint === subscription.endpoint
    );
    
    if (existingIndex !== -1) {
      // Update yang sudah ada
      subscriptions[existingIndex] = subscription;
      console.log('✅ Push subscription updated');
    } else {
      // Tambah baru
      subscriptions.push(subscription);
      console.log('✅ Push subscription added, total:', subscriptions.length);
    }
    
    return NextResponse.json({ success: true, total: subscriptions.length });
    
  } catch (error) {
    console.error('❌ Subscribe error:', error);
    return NextResponse.json(
      { error: 'Failed to subscribe' }, 
      { status: 500 }
    );
  }
}

// Fungsi untuk mendapatkan semua subscriptions (untuk testing)
export async function GET() {
  return NextResponse.json({ 
    total: subscriptions.length,
    subscriptions: subscriptions.map(s => ({ endpoint: s.endpoint }))
  });
}