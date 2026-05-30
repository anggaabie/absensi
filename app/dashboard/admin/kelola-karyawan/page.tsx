'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Webcam from 'react-webcam';
import Link from 'next/link';

// HAPUS import face-api.js statis
// import * as faceapi from 'face-api.js';

interface Karyawan {
  id: string;
  nama: string;
  email: string;
  hasFaceData: boolean;
  profileImage?: string;
  createdAt?: string;
}

export default function KelolaKaryawan() {
  const [karyawan, setKaryawan] = useState<Karyawan[]>([]);
  const [filteredKaryawan, setFilteredKaryawan] = useState<Karyawan[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedKaryawan, setSelectedKaryawan] = useState<Karyawan | null>(null);
  const [formData, setFormData] = useState({ nama: '', email: '', password: '' });
  const [editFormData, setEditFormData] = useState({ nama: '', email: '' });
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'registered' | 'unregistered'>('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<Karyawan | null>(null);
  const [showResetPassword, setShowResetPassword] = useState<Karyawan | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const webcamRef = useRef<Webcam>(null);
  const router = useRouter();

  useEffect(() => {
    fetchKaryawan();
    loadModels();
    
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let filtered = [...karyawan];
    
    if (searchTerm) {
      filtered = filtered.filter(k => 
        k.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
        k.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (filterStatus === 'registered') {
      filtered = filtered.filter(k => k.hasFaceData);
    } else if (filterStatus === 'unregistered') {
      filtered = filtered.filter(k => !k.hasFaceData);
    }
    
    setFilteredKaryawan(filtered);
  }, [searchTerm, filterStatus, karyawan]);

  const showToast = (text: string, type: 'success' | 'error') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadModels = async () => {
    const MODEL_URL = '/models';
    const CDN_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
    
    try {
      // Dynamic import face-api.js
      const faceapi = await import('face-api.js');
      
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
      setModelsLoaded(true);
      console.log('Models loaded successfully');
    } catch (localError) {
      try {
        const faceapi = await import('face-api.js');
        await faceapi.nets.tinyFaceDetector.loadFromUri(CDN_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(CDN_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(CDN_URL);
        setModelsLoaded(true);
        console.log('Models loaded from CDN');
      } catch (cdnError) {
        console.error('Model loading failed:', cdnError);
      }
    }
  };

  const fetchKaryawan = async () => {
    const res = await fetch('/api/karyawan');
    const data = await res.json();
    if (res.ok) setKaryawan(data);
  };

  const registerFace = async (userId: string) => {
    const imageSrc = webcamRef.current?.getScreenshot({
      width: 320,
      height: 240
    });
    
    if (!imageSrc) {
      showToast('Gagal mengambil foto', 'error');
      return;
    }

    setUploadLoading(true);
    
    try {
      const img = new Image();
      img.width = 224;
      img.height = 224;
      
      await new Promise((resolve) => {
        img.onload = resolve;
        img.src = imageSrc;
      });

      // Dynamic import face-api.js untuk deteksi
      const faceapi = await import('face-api.js');

      const detection = await faceapi
        .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({
          inputSize: 224,
          scoreThreshold: 0.6,
        }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        showToast('Wajah tidak terdeteksi. Pastikan wajah terlihat jelas dan pencahayaan cukup.', 'error');
        setUploadLoading(false);
        return;
      }

      if (!detection.descriptor || detection.descriptor.length !== 128) {
        showToast('Data wajah tidak valid. Silahkan coba lagi.', 'error');
        setUploadLoading(false);
        return;
      }

      const res = await fetch('/api/upload-wajah', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          faceDescriptor: Array.from(detection.descriptor)
        })
      });

      if (res.ok) {
        showToast('Data wajah berhasil disimpan!', 'success');
        setSelectedUser(null);
        fetchKaryawan();
      } else {
        const data = await res.json();
        showToast(data.error || 'Gagal menyimpan data wajah', 'error');
      }
    } catch (error) {
      console.error('Face detection error:', error);
      showToast('Error deteksi wajah. Silahkan coba lagi.', 'error');
    } finally {
      setUploadLoading(false);
    }
  };

  const addKaryawan = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formData, role: 'karyawan' })
    });

    if (res.ok) {
      showToast('Karyawan berhasil ditambahkan', 'success');
      setShowForm(false);
      setFormData({ nama: '', email: '', password: '' });
      fetchKaryawan();
    } else {
      const data = await res.json();
      showToast(data.error || 'Gagal menambahkan karyawan', 'error');
    }
    setLoading(false);
  };

  const editKaryawan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKaryawan) return;
    
    setLoading(true);
    const res = await fetch(`/api/karyawan/${selectedKaryawan.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editFormData)
    });

    if (res.ok) {
      showToast('Data karyawan berhasil diupdate', 'success');
      setShowEditForm(false);
      setSelectedKaryawan(null);
      fetchKaryawan();
    } else {
      const data = await res.json();
      showToast(data.error || 'Gagal mengupdate karyawan', 'error');
    }
    setLoading(false);
  };

  const resetPassword = async (userId: string, email: string) => {
    if (!newPassword) {
      showToast('Password baru wajib diisi', 'error');
      return;
    }
    
    setLoading(true);
    const res = await fetch(`/api/karyawan/${userId}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword })
    });

    if (res.ok) {
      showToast(`Password berhasil direset untuk ${email}`, 'success');
      setShowResetPassword(null);
      setNewPassword('');
    } else {
      const data = await res.json();
      showToast(data.error || 'Gagal reset password', 'error');
    }
    setLoading(false);
  };

  const deleteKaryawan = async (id: string) => {
    const res = await fetch(`/api/karyawan?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Karyawan berhasil dihapus', 'success');
      setShowDeleteConfirm(null);
      fetchKaryawan();
    } else {
      showToast('Gagal menghapus karyawan', 'error');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const getStats = () => {
    const total = karyawan.length;
    const registered = karyawan.filter(k => k.hasFaceData).length;
    const unregistered = total - registered;
    return { total, registered, unregistered };
  };

  const stats = getStats();

  const Icons = {
    menu: () => (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    ),
    dashboard: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    users: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    settings: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    logout: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
    ),
    add: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
    search: () => (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    edit: () => (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    delete: () => (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
    camera: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    eye: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
    key: () => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
    ),
    check: () => (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    ),
    close: () => (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    filter: () => (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
      </svg>
    ),
    time: () => (
      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast Message */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-in-right">
          <div className={`px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 ${
            toastMessage.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}>
            {toastMessage.type === 'success' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {toastMessage.text}
          </div>
        </div>
      )}

      {/* Top Navigation Bar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <Icons.menu />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-sm">
                  <Icons.users />
                </div>
                <span className="font-semibold text-gray-800 text-lg">Kelola Karyawan</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg">
                <Icons.time />
                <span className="text-sm text-gray-600 font-medium">{currentTime}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                  A
                </div>
                <div className="hidden md:block">
                  <p className="text-sm font-medium text-gray-700">Admin</p>
                  <p className="text-xs text-gray-400">Administrator</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Sidebar + Main Content */}
      <div className="flex">
        {/* Sidebar Desktop */}
        <aside className="hidden lg:block w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-64px)] sticky top-16">
          <div className="p-4 space-y-1">
            <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Menu Utama</div>
            <Link href="/dashboard/admin" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-600 hover:bg-gray-50 transition-all">
              <Icons.dashboard />
              Dashboard
            </Link>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-blue-50 text-blue-700 font-medium">
              <Icons.users />
              Kelola Karyawan
            </button>
            <Link href="/dashboard/admin/pengaturan" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-600 hover:bg-gray-50 transition-all">
              <Icons.settings />
              Pengaturan
            </Link>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Karyawan</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{stats.total}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Icons.users />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Wajah Terdaftar</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-2">{stats.registered}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <Icons.check />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Belum Terdaftar</p>
                  <p className="text-2xl font-bold text-amber-600 mt-2">{stats.unregistered}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Icons.camera />
                </div>
              </div>
            </div>
          </div>

          {/* Filters and Actions */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-6">
            <div className="p-5">
              <div className="flex flex-col md:flex-row gap-4 justify-between">
                <div className="flex flex-col sm:flex-row gap-3 flex-1">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Icons.search />
                    </div>
                    <input
                      type="text"
                      placeholder="Cari nama atau email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFilterStatus('all')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                        filterStatus === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <Icons.filter />
                      Semua
                    </button>
                    <button
                      onClick={() => setFilterStatus('registered')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        filterStatus === 'registered' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Terdaftar
                    </button>
                    <button
                      onClick={() => setFilterStatus('unregistered')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        filterStatus === 'unregistered' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Belum Terdaftar
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-all shadow-sm"
                >
                  <Icons.add />
                  Tambah Karyawan
                </button>
              </div>
            </div>
          </div>

          {/* Karyawan Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {filteredKaryawan.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icons.users />
                </div>
                <p className="text-gray-500 font-medium">Tidak ada data karyawan</p>
                <p className="text-gray-400 text-sm mt-1">Silahkan tambah karyawan baru</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Karyawan</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Email</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status Wajah</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredKaryawan.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            {user.profileImage ? (
                              <img 
                                src={user.profileImage} 
                                alt={user.nama} 
                                className="w-10 h-10 rounded-full object-cover border border-gray-200"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                                {user.nama.charAt(0)}
                              </div>
                            )}
                            <span className="font-medium text-gray-800">{user.nama}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap hidden md:table-cell">
                          <span className="text-sm text-gray-600">{user.email}</span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {user.hasFaceData ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                              <Icons.check />
                              Terdaftar
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                              Belum
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            {!user.hasFaceData && (
                              <button
                                onClick={() => setSelectedUser(user.id)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Registrasi Wajah"
                              >
                                <Icons.camera />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setSelectedKaryawan(user);
                                setEditFormData({ nama: user.nama, email: user.email });
                                setShowEditForm(true);
                              }}
                              className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Edit Data"
                            >
                              <Icons.edit />
                            </button>
                            <button
                              onClick={() => setShowResetPassword(user)}
                              className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                              title="Reset Password"
                            >
                              <Icons.key />
                            </button>
                            <button
                              onClick={() => setShowDetailModal(user)}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Detail"
                            >
                              <Icons.eye />
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(user.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Hapus"
                            >
                              <Icons.delete />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Logout Button Floating Mobile */}
      <button
        onClick={handleLogout}
        className="lg:hidden fixed bottom-6 right-6 bg-red-600 text-white p-3 rounded-full shadow-lg hover:bg-red-700 transition-all z-40"
      >
        <Icons.logout />
      </button>

      {/* Modal Registrasi Wajah */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedUser(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Icons.camera />
                <h2 className="text-xl font-semibold text-gray-800">Registrasi Wajah</h2>
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-gray-600">
                <Icons.close />
              </button>
            </div>
            <div className="p-5">
              {!modelsLoaded ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-500 mt-4">Memuat model deteksi wajah...</p>
                </div>
              ) : (
                <>
                  <div className="relative mb-5">
                    <Webcam 
                      ref={webcamRef} 
                      className="w-full rounded-xl border border-gray-200" 
                      screenshotFormat="image/jpeg"
                      mirrored={false}
                      videoConstraints={{
                        facingMode: "user",
                        width: { ideal: 480 },
                        height: { ideal: 360 }
                      }}
                    />
                    <div className="absolute inset-0 border-2 border-blue-400 rounded-xl pointer-events-none opacity-50"></div>
                  </div>
                  <button
                    onClick={() => registerFace(selectedUser)}
                    disabled={uploadLoading}
                    className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-3 rounded-xl font-medium hover:from-emerald-700 hover:to-emerald-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadLoading ? 'Memproses...' : 'Simpan Wajah'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Detail Karyawan */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDetailModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Icons.eye />
                <h2 className="text-xl font-semibold text-gray-800">Detail Karyawan</h2>
              </div>
              <button onClick={() => setShowDetailModal(null)} className="text-gray-400 hover:text-gray-600">
                <Icons.close />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
                {showDetailModal.profileImage ? (
                  <img 
                    src={showDetailModal.profileImage} 
                    alt={showDetailModal.nama} 
                    className="w-20 h-20 rounded-2xl object-cover border-2 border-blue-200"
                  />
                ) : (
                  <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold">
                    {showDetailModal.nama.charAt(0)}
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-bold text-gray-800">{showDetailModal.nama}</h3>
                  <p className="text-gray-500 text-sm">{showDetailModal.email}</p>
                </div>
              </div>
              <div className="flex justify-between py-3 border-b border-gray-100">
                <span className="text-gray-500">Status Wajah</span>
                <span className={`font-medium ${showDetailModal.hasFaceData ? 'text-emerald-600' : 'text-red-600'}`}>
                  {showDetailModal.hasFaceData ? 'Terdaftar' : 'Belum Terdaftar'}
                </span>
              </div>
              <div className="flex justify-between py-3 border-b border-gray-100">
                <span className="text-gray-500">ID Karyawan</span>
                <span className="font-mono text-sm text-gray-600">{showDetailModal.id.substring(0, 8)}...</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-gray-500">Bergabung</span>
                <span className="text-sm text-gray-600">
                  {showDetailModal.createdAt ? new Date(showDetailModal.createdAt).toLocaleDateString('id-ID') : '-'}
                </span>
              </div>
            </div>
            <div className="p-5 border-t border-gray-100">
              <button
                onClick={() => setShowDetailModal(null)}
                className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-200 transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reset Password */}
      {showResetPassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowResetPassword(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Icons.key />
                <h2 className="text-xl font-semibold text-gray-800">Reset Password</h2>
              </div>
              <button onClick={() => setShowResetPassword(null)} className="text-gray-400 hover:text-gray-600">
                <Icons.close />
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); resetPassword(showResetPassword.id, showResetPassword.email); }} className="p-5">
              <p className="text-sm text-gray-600 mb-4">
                Reset password untuk karyawan: <span className="font-semibold text-gray-800">{showResetPassword.nama}</span>
              </p>
              <input
                type="password"
                placeholder="Password baru"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-5"
                required
                minLength={4}
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-purple-600 text-white py-3 rounded-xl font-medium hover:bg-purple-700 transition-all disabled:opacity-50"
              >
                {loading ? 'Memproses...' : 'Reset Password'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah Karyawan */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Icons.add />
                <h2 className="text-xl font-semibold text-gray-800">Tambah Karyawan</h2>
              </div>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <Icons.close />
              </button>
            </div>
            <form onSubmit={addKaryawan} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nama Lengkap</label>
                <input
                  type="text"
                  placeholder="Masukkan nama lengkap"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={formData.nama}
                  onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  placeholder="Masukkan email"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <input
                  type="password"
                  placeholder="Masukkan password"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={4}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-all disabled:opacity-50 mt-2"
              >
                {loading ? 'Menyimpan...' : 'Simpan'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Karyawan */}
      {showEditForm && selectedKaryawan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowEditForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Icons.edit />
                <h2 className="text-xl font-semibold text-gray-800">Edit Karyawan</h2>
              </div>
              <button onClick={() => setShowEditForm(false)} className="text-gray-400 hover:text-gray-600">
                <Icons.close />
              </button>
            </div>
            <form onSubmit={editKaryawan} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nama Lengkap</label>
                <input
                  type="text"
                  placeholder="Nama Lengkap"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  value={editFormData.nama}
                  onChange={(e) => setEditFormData({ ...editFormData, nama: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  placeholder="Email"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-amber-600 text-white py-3 rounded-xl font-medium hover:bg-amber-700 transition-all disabled:opacity-50 mt-2"
              >
                {loading ? 'Menyimpan...' : 'Update Data'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icons.delete />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Hapus Karyawan</h2>
              <p className="text-gray-500 mb-6">Apakah Anda yakin ingin menghapus karyawan ini? Tindakan ini tidak dapat dibatalkan.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-600 font-medium hover:bg-gray-50 transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={() => deleteKaryawan(showDeleteConfirm)}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-all"
                >
                  Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slide-in-right {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}