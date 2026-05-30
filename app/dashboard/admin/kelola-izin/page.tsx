'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function KelolaIzin() {
  const [izinList, setIzinList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [selectedIzin, setSelectedIzin] = useState<any>(null);
  const [actionStatus, setActionStatus] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchIzin();
  }, [filterStatus]);

  const fetchIzin = async () => {
    setLoading(true);
    try {
      const url = filterStatus !== 'all' ? `/api/izin?status=${filterStatus}` : '/api/izin';
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) setIzinList(data);
    } catch (error) {
      console.error('Error fetching izin:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!selectedIzin) return;
    setSubmitting(true);
    
    try {
      const res = await fetch('/api/izin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          izinId: selectedIzin.id,
          status: actionStatus,
          keterangan: keterangan
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setToastMessage({ text: data.message, type: 'success' });
        setTimeout(() => setToastMessage(null), 3000);
        setShowModal(false);
        setSelectedIzin(null);
        setKeterangan('');
        fetchIzin();
      } else {
        setToastMessage({ text: data.error || 'Gagal memproses', type: 'error' });
      }
    } catch (error) {
      setToastMessage({ text: 'Terjadi kesalahan', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const openModal = (izin: any, status: string) => {
    setSelectedIzin(izin);
    setActionStatus(status);
    setKeterangan('');
    setShowModal(true);
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'disetujui':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Disetujui</span>;
      case 'ditolak':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Ditolak</span>;
      default:
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Menunggu</span>;
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-in-right">
          <div className={`px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 ${
            toastMessage.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}>
            {toastMessage.text}
          </div>
        </div>
      )}

      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Link href="/dashboard/admin" className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-800">Kelola Izin</h1>
                <p className="text-sm text-gray-500">Setujui atau tolak pengajuan izin karyawan</p>
              </div>
            </div>
            <button onClick={handleLogout} className="px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6">
          <div className="flex gap-3">
            <button onClick={() => setFilterStatus('all')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filterStatus === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Semua</button>
            <button onClick={() => setFilterStatus('pending')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filterStatus === 'pending' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Menunggu</button>
            <button onClick={() => setFilterStatus('disetujui')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filterStatus === 'disetujui' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Disetujui</button>
            <button onClick={() => setFilterStatus('ditolak')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filterStatus === 'ditolak' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Ditolak</button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-4">Memuat data...</p>
            </div>
          ) : izinList.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Belum ada pengajuan izin</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Karyawan</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tanggal Izin</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Alasan</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {izinList.map((izin) => (
                    <tr key={izin.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-medium text-gray-800">{izin.userName}</p>
                          <p className="text-xs text-gray-400">{new Date(izin.diajukanPada).toLocaleDateString('id-ID')}</p>
                        </div>
                       </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-gray-800">{new Date(izin.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                       </td>
                      <td className="px-5 py-4">
                        <p className="text-sm text-gray-600 line-clamp-2">{izin.alasan}</p>
                       </td>
                      <td className="px-5 py-4">{getStatusBadge(izin.status)}</td>
                      <td className="px-5 py-4">
                        {izin.status === 'pending' && (
                          <div className="flex gap-2">
                            <button onClick={() => openModal(izin, 'disetujui')} className="px-3 py-1 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Setujui</button>
                            <button onClick={() => openModal(izin, 'ditolak')} className="px-3 py-1 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Tolak</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {showModal && selectedIzin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">{actionStatus === 'disetujui' ? 'Setujui Izin' : 'Tolak Izin'}</h2>
              <p className="text-gray-600 mb-4">{actionStatus === 'disetujui' ? `Setujui izin untuk ${selectedIzin.userName}?` : `Tolak izin untuk ${selectedIzin.userName}?`}</p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Keterangan (opsional)</label>
                <textarea rows={3} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Tambahkan keterangan..." value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50">Batal</button>
                <button onClick={handleAction} disabled={submitting} className={`flex-1 px-4 py-2 rounded-xl text-white font-medium ${actionStatus === 'disetujui' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'} disabled:opacity-50`}>{submitting ? 'Memproses...' : (actionStatus === 'disetujui' ? 'Setujui' : 'Tolak')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slide-in-right { from { opacity: 0; transform: translateX(100%); } to { opacity: 1; transform: translateX(0); } }
        .animate-slide-in-right { animation: slide-in-right 0.3s ease-out; }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>
    </div>
  );
}