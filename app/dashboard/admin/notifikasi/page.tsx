'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function KirimNotifikasi() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    message: '',
    type: 'info',
    target: 'all'
  });
  const [messageStatus, setMessageStatus] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessageStatus(null);

    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      const data = await res.json();

      if (res.ok) {
        setMessageStatus({ text: 'Notifikasi berhasil dikirim!', type: 'success' });
        setForm({ title: '', message: '', type: 'info', target: 'all' });
        setTimeout(() => setMessageStatus(null), 3000);
      } else {
        setMessageStatus({ text: data.error || 'Gagal mengirim notifikasi', type: 'error' });
      }
    } catch (error) {
      setMessageStatus({ text: 'Terjadi kesalahan', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b px-6 py-4">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-800">Kirim Notifikasi</h1>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/dashboard/admin')}
              className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50"
            >
              Kembali
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
            >
              Keluar
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Judul Notifikasi</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Contoh: Libur Nasional"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pesan</label>
            <textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Isi pesan notifikasi..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Notifikasi</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="info">ℹ️ Informasi</option>
                <option value="warning">⚠️ Peringatan</option>
                <option value="success">✅ Sukses</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Penerima</label>
              <select
                value={form.target}
                onChange={(e) => setForm({ ...form, target: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">📢 Semua User</option>
                <option value="karyawan">👥 Karyawan</option>
                <option value="admin">👑 Admin</option>
              </select>
            </div>
          </div>

          {messageStatus && (
            <div className={`p-3 rounded-lg text-sm ${messageStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {messageStatus.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {loading ? 'Mengirim...' : 'Kirim Notifikasi'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-sm text-blue-800 font-medium mb-2">ℹ️ Informasi</p>
          <p className="text-xs text-blue-600">
            Notifikasi yang dikirim akan muncul di halaman karyawan dan admin sesuai dengan target yang dipilih. 
            Karyawan akan melihat notifikasi di modal notifikasi (ikon lonceng).
          </p>
        </div>
      </div>
    </div>
  );
}