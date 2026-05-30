'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [namaUser, setNamaUser] = useState('');
  const [emailUser, setEmailUser] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [todayStatus, setTodayStatus] = useState({ sudahAbsen: false, status: '', waktu: '' });
  const [activeNav, setActiveNav] = useState('beranda');
  const [riwayatAbsen, setRiwayatAbsen] = useState<any[]>([]);
  const [stats, setStats] = useState({ hadir: 0, terlambat: 0, izin: 0 });
  const [settings, setSettings] = useState({ 
    radius: 10, 
    jamMasuk: '08:00', 
    jamKeluar: '17:00',
    toleransiTerlambat: 15,
    lat: -7.370758,
    lng: 108.248837
  });
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [smoothedDistance, setSmoothedDistance] = useState<number | null>(null);
  const [distanceHistory, setDistanceHistory] = useState<number[]>([]);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<any>(null);
  const [showNotificationDetailModal, setShowNotificationDetailModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<'single' | 'all' | null>(null);
  const [selectedDeleteId, setSelectedDeleteId] = useState<string | null>(null);
  
  // State untuk notifikasi dari database (hanya 24 jam terakhir)
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // State untuk artikel dari database
  const [articles, setArticles] = useState<any[]>([]);
  
  // State untuk modal konfirmasi
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmData, setConfirmData] = useState({
    title: '',
    message: '',
    onConfirm: () => {},
    confirmText: 'Ya',
    cancelText: 'Batal',
    type: 'danger'
  });
  
  // State untuk izin
  const [izinList, setIzinList] = useState<any[]>([]);
  const [showIzinModal, setShowIzinModal] = useState(false);
  const [izinForm, setIzinForm] = useState({ tanggal: '', alasan: '' });
  
  // State untuk jatah izin (quota)
  const [quota, setQuota] = useState({ quota: 3, used: 0, remaining: 3, canApply: true });
  
  // Refs
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const locationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const getGreeting = () => {
    const now = new Date();
    const hours = now.getHours();
    
    if (hours >= 3 && hours < 11) {
      return 'Selamat Pagi';
    } else if (hours >= 11 && hours < 15) {
      return 'Selamat Siang';
    } else if (hours >= 15 && hours < 18) {
      return 'Selamat Sore';
    } else {
      return 'Selamat Malam';
    }
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void, type: 'danger' | 'warning' | 'info' = 'danger') => {
    setConfirmData({
      title,
      message,
      onConfirm,
      confirmText: type === 'danger' ? 'Ya, Hapus' : type === 'warning' ? 'Ya, Lanjutkan' : 'Ya',
      cancelText: 'Batal',
      type
    });
    setShowConfirmModal(true);
  };

  // Smoothing jarak
  const smoothDistance = (newDistance: number) => {
    setDistanceHistory(prev => {
      const newHistory = [...prev, newDistance].slice(-5);
      const sorted = [...newHistory].sort((a, b) => a - b);
      const trimmed = sorted.slice(1, -1);
      const avg = trimmed.length > 0 ? trimmed.reduce((a, b) => a + b, 0) / trimmed.length : newDistance;
      setSmoothedDistance(Math.round(avg));
      return newHistory;
    });
  };

  const checkLocationRealtime = async () => {
    try {
      const location = await getLocation();
      setUserLocation(location);
      const dist = calculateDistance(location.lat, location.lng, settings.lat, settings.lng);
      setDistance(dist);
      smoothDistance(dist);
      return { location, distance: dist };
    } catch (error) {
      console.error('Error getting location:', error);
      return null;
    }
  };

  const startRealtimeLocationCheck = () => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
    }
    checkLocationRealtime();
    locationIntervalRef.current = setInterval(() => {
      checkLocationRealtime();
    }, 30000);
  };

  // Fetch jatah izin (quota)
  const fetchQuota = async () => {
    try {
      const res = await fetch('/api/user-quota');
      const data = await res.json();
      if (res.ok) {
        setQuota(data);
      }
    } catch (error) {
      console.error('Error fetching quota:', error);
    }
  };

  useEffect(() => {
    const nama = localStorage.getItem('userName') || '';
    const email = localStorage.getItem('userEmail') || '';
    const savedImage = localStorage.getItem('profileImage');
    setNamaUser(nama);
    setEmailUser(email);
    if (savedImage) setProfileImage(savedImage);
    
    updateDateTime();
    loadModels();
    fetchAllData();
    fetchNotifications();
    fetchArticles();
    fetchIzin();
    fetchQuota();
    
    startRealtimeLocationCheck();
    
    const interval = setInterval(updateDateTime, 1000);
    return () => {
      clearInterval(interval);
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
      }
    };
  }, []);

  const updateDateTime = () => {
    const now = new Date();
    setCurrentTime(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    setCurrentDate(now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
  };

  const fetchAllData = async () => {
    await Promise.all([
      fetchSettings(),
      fetchRiwayatAbsen(),
      fetchTodayStatus(),
      fetchProfileImage(),
      fetchStats()
    ]);
  };

  const fetchStats = async () => {
    try {
      const riwayatRes = await fetch('/api/riwayat-absen');
      let hadir = 0, terlambat = 0;
      
      if (riwayatRes.ok) {
        const riwayat = await riwayatRes.json();
        hadir = riwayat.filter((a: any) => a.status === 'hadir').length;
        terlambat = riwayat.filter((a: any) => a.status === 'terlambat').length;
      }
      
      const izinRes = await fetch('/api/izin');
      let izinDisetujui = 0;
      
      if (izinRes.ok) {
        const allIzin = await izinRes.json();
        izinDisetujui = allIzin.filter((i: any) => i.status === 'disetujui').length;
      }
      
      setStats({ hadir, terlambat, izin: izinDisetujui });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchArticles = async () => {
    try {
      const res = await fetch('/api/articles');
      const data = await res.json();
      if (res.ok) {
        setArticles(data);
      }
    } catch (error) {
      console.error('Error fetching articles:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (res.ok) {
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        const recentNotifications = (data.notifications || []).filter((notif: any) => {
          const notifDate = new Date(notif.createdAt);
          return notifDate >= twentyFourHoursAgo;
        });
        
        setNotifications(recentNotifications);
        setUnreadCount(recentNotifications.filter((n: any) => !n.isRead).length);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const fetchIzin = async () => {
    try {
      const res = await fetch('/api/izin');
      const data = await res.json();
      if (res.ok) {
        setIzinList(data);
      }
    } catch (error) {
      console.error('Error fetching izin:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId })
      });
      if (res.ok) {
        fetchNotifications();
      }
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  // Hapus notifikasi tunggal
  const deleteNotification = async (notificationId: string) => {
    try {
      const res = await fetch(`/api/notifications?id=${notificationId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('Notifikasi berhasil dihapus', 'success');
        fetchNotifications();
        setShowDeleteConfirmModal(false);
        setSelectedDeleteId(null);
        setDeleteTarget(null);
      } else {
        showToast('Gagal menghapus notifikasi', 'error');
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      showToast('Terjadi kesalahan', 'error');
    }
  };

  // Hapus semua notifikasi
  const deleteAllNotifications = async () => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('Semua notifikasi berhasil dihapus', 'success');
        fetchNotifications();
        setShowDeleteConfirmModal(false);
        setDeleteTarget(null);
      } else {
        showToast('Gagal menghapus semua notifikasi', 'error');
      }
    } catch (error) {
      console.error('Error deleting all notifications:', error);
      showToast('Terjadi kesalahan', 'error');
    }
  };

  // Konfirmasi hapus notifikasi
  const confirmDeleteNotification = (id?: string) => {
    if (id) {
      setSelectedDeleteId(id);
      setDeleteTarget('single');
      setShowDeleteConfirmModal(true);
    } else {
      setDeleteTarget('all');
      setShowDeleteConfirmModal(true);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (res.ok) {
        setSettings({
          radius: parseInt(data.radius_absen) || 10,
          jamMasuk: data.jam_masuk || '08:00',
          jamKeluar: data.jam_keluar || '17:00',
          toleransiTerlambat: parseInt(data.toleransi_terlambat) || 15,
          lat: parseFloat(data.lokasi_kantor_lat) || -7.370758,
          lng: parseFloat(data.lokasi_kantor_lng) || 108.248837
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchRiwayatAbsen = async () => {
    try {
      const res = await fetch('/api/riwayat-absen');
      if (res.ok) {
        const riwayat = await res.json();
        setRiwayatAbsen(riwayat);
      }
    } catch (error) {
      console.error('Error fetching riwayat:', error);
    }
  };

  const fetchTodayStatus = async () => {
    try {
      const res = await fetch('/api/cek-absen-hari-ini');
      if (res.ok) {
        const status = await res.json();
        if (status.sudahAbsen) {
          const absenRes = await fetch('/api/riwayat-absen');
          if (absenRes.ok) {
            const riwayat = await absenRes.json();
            const todayAbsen = riwayat.find((a: any) => {
              const date = new Date(a.timestamp);
              const today = new Date();
              return date.toDateString() === today.toDateString();
            });
            if (todayAbsen) {
              setTodayStatus({ 
                sudahAbsen: true, 
                status: status.status, 
                waktu: new Date(todayAbsen.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
              });
            } else {
              setTodayStatus({ sudahAbsen: true, status: status.status, waktu: '' });
            }
          } else {
            setTodayStatus({ sudahAbsen: true, status: status.status, waktu: '' });
          }
        } else {
          setTodayStatus({ sudahAbsen: false, status: '', waktu: '' });
        }
      }
    } catch (error) {
      console.error('Error fetching today status:', error);
    }
  };

  const fetchProfileImage = async () => {
    try {
      const res = await fetch('/api/user-profile');
      if (res.ok) {
        const profile = await res.json();
        if (profile.profileImage) {
          setProfileImage(profile.profileImage);
          localStorage.setItem('profileImage', profile.profileImage);
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const loadModels = async () => {
    try {
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
      setModelsLoaded(true);
    } catch (error) {
      console.error('Error loading models:', error);
    }
  };

  const showToast = (text: string, type: 'success' | 'error' | 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3500);
  };

  const getLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation tidak didukung'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        }),
        (error) => reject(new Error('Gagal mengambil lokasi: ' + error.message)),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const checkLocation = async () => {
    try {
      const location = await getLocation();
      setUserLocation(location);
      const dist = calculateDistance(location.lat, location.lng, settings.lat, settings.lng);
      setDistance(dist);
      smoothDistance(dist);
      return { location, distance: dist };
    } catch (error) {
      showToast((error as Error).message, 'error');
      return null;
    }
  };

  const handleAbsen = async () => {
    if (!showCamera) {
      const locationCheck = await checkLocation();
      if (!locationCheck) return;
      if (locationCheck.distance > settings.radius) {
        showToast(`📍 Absen ditolak! Jarak ${Math.round(locationCheck.distance)} meter dari kantor. Maksimal ${settings.radius} meter.`, 'error');
        return;
      }
      setShowCamera(true);
      return;
    }

    if (!modelsLoaded) {
      showToast('Memuat model wajah, tunggu sebentar...', 'info');
      return;
    }

    setIsProcessing(true);
    setLoading(true);

    try {
      const locationData = await getLocation();
      const imageSrc = webcamRef.current?.getScreenshot({ width: 240, height: 180 });
      if (!imageSrc) throw new Error('Gagal mengambil foto');

      const img = new Image();
      await new Promise((resolve) => { img.onload = resolve; img.src = imageSrc; });

      const detection = await faceapi
        .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 96, scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection?.descriptor) {
        showToast('❌ Wajah tidak terdeteksi. Pastikan pencahayaan cukup dan wajah terlihat jelas.', 'error');
        setIsProcessing(false);
        setLoading(false);
        return;
      }

      const response = await fetch('/api/absen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          faceDescriptor: Array.from(detection.descriptor),
          location: { lat: locationData.lat, lng: locationData.lng },
          image: imageSrc
        })
      });

      const data = await response.json();

      if (response.ok) {
        showToast(data.message, 'success');
        setShowCamera(false);
        await fetchAllData();
      } else {
        let errorMessage = data.error || 'Terjadi kesalahan';
        
        if (errorMessage.includes('belum terdaftar')) {
          errorMessage = '⚠️ DATA WAJAH BELUM TERDAFTAR!\n\nSilakan hubungi admin untuk melakukan registrasi wajah terlebih dahulu.';
        } else if (errorMessage.includes('tidak cocok')) {
          errorMessage = '❌ WAJAH TIDAK COCOK!\n\nPastikan wajah Anda terlihat jelas, pencahayaan cukup, dan coba lagi.';
        } else if (errorMessage.includes('jarak')) {
          errorMessage = `📍 ${errorMessage}`;
        } else if (errorMessage.includes('sudah melakukan absen')) {
          errorMessage = `✅ ${errorMessage}`;
        }
        
        showToast(errorMessage, 'error');
        console.error('API Error:', data);
      }
    } catch (error) {
      console.error('Absen error:', error);
      showToast('Terjadi kesalahan. Silahkan coba lagi.', 'error');
    } finally {
      setIsProcessing(false);
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) {
      showToast('File harus gambar dan maksimal 2MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      if (event.target?.result) {
        const imageUrl = event.target.result as string;
        
        const res = await fetch('/api/upload-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: imageUrl })
        });
        
        if (res.ok) {
          setProfileImage(imageUrl);
          localStorage.setItem('profileImage', imageUrl);
          showToast('Foto profil berhasil diupdate', 'success');
        } else {
          showToast('Gagal upload foto', 'error');
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAjukanIzin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Cek quota sebelum submit
    if (!quota.canApply) {
      showToast(`Maaf, jatah izin Anda bulan ini sudah habis (${quota.quota} kali). Silakan hubungi admin.`, 'error');
      return;
    }
    
    setLoading(true);
    
    try {
      const res = await fetch('/api/izin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(izinForm)
      });
      
      const data = await res.json();
      
      if (res.ok) {
        showToast(data.message || 'Pengajuan izin berhasil dikirim', 'success');
        setShowIzinModal(false);
        setIzinForm({ tanggal: '', alasan: '' });
        fetchIzin();
        fetchStats();
        fetchQuota(); // Refresh quota setelah ajukan izin
      } else {
        showToast(data.error || 'Gagal mengajukan izin', 'error');
      }
    } catch (error) {
      showToast('Terjadi kesalahan', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    showConfirm(
      'Konfirmasi Logout',
      'Apakah Anda yakin ingin keluar dari aplikasi?',
      async () => {
        try {
          await fetch('/api/auth/logout', { method: 'POST' });
        } catch (error) {
          console.error('Logout error:', error);
        }
        localStorage.clear();
        router.push('/login');
      },
      'warning'
    );
  };

  const handleLihatSemuaArtikel = () => {
    if (articles.length > 0) {
      const articleList = articles.map((a: any, i: number) => 
        `${i + 1}. ${a.title}\n   ${new Date(a.publishedAt || a.createdAt).toLocaleDateString('id-ID')}`
      ).join('\n\n');
      
      setConfirmData({
        title: '📚 Daftar Artikel',
        message: `Total ${articles.length} artikel:\n\n${articleList}\n\nKlik artikel di halaman beranda untuk membaca detailnya.`,
        onConfirm: () => setShowConfirmModal(false),
        confirmText: 'Tutup',
        cancelText: '',
        type: 'info'
      });
      setShowConfirmModal(true);
    } else {
      setConfirmData({
        title: 'Informasi',
        message: 'Belum ada artikel saat ini.',
        onConfirm: () => setShowConfirmModal(false),
        confirmText: 'Tutup',
        cancelText: '',
        type: 'info'
      });
      setShowConfirmModal(true);
    }
  };

  // Navigasi ke halaman artikel baru (bukan modal)
  const openArticlePage = (articleId: string) => {
    router.push(`/artikel/${articleId}`);
  };

  const getInitial = () => namaUser.charAt(0);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'disetujui':
        return { color: '#10B981', text: 'Disetujui', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' };
      case 'ditolak':
        return { color: '#EF4444', text: 'Ditolak', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' };
      default:
        return { color: '#F59E0B', text: 'Menunggu', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' };
    }
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // ==================== MODAL COMPONENTS ====================

  // Modal Konfirmasi Component
  const ConfirmModal = () => (
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center" 
      style={{ background: 'rgba(0,0,0,0.75)' }}
    >
      <div 
        className="bg-white rounded-2xl w-full max-w-sm mx-4 animate-slide-up overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '24px 20px 20px 20px', textAlign: 'center' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '28px',
            margin: '0 auto 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: confirmData.type === 'danger' ? '#FEE2E2' : confirmData.type === 'warning' ? '#FEF3C7' : '#DBEAFE'
          }}>
            {confirmData.type === 'danger' ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            ) : confirmData.type === 'warning' ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2">
                <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1a1a1a', marginBottom: '8px' }}>
            {confirmData.title}
          </h3>
          <p style={{ fontSize: '14px', color: '#666', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
            {confirmData.message}
          </p>
        </div>
        
        <div style={{ padding: '16px 20px 24px 20px', display: 'flex', gap: '12px' }}>
          {confirmData.cancelText && (
            <button 
              onClick={() => setShowConfirmModal(false)}
              style={{
                flex: 1,
                padding: '12px',
                background: '#f5f5f5',
                border: 'none',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#666',
                cursor: 'pointer'
              }}
            >
              {confirmData.cancelText}
            </button>
          )}
          <button 
            onClick={() => {
              setShowConfirmModal(false);
              confirmData.onConfirm();
            }}
            style={{
              flex: confirmData.cancelText ? 1 : '100%',
              padding: '12px',
              background: confirmData.type === 'danger' ? '#EF4444' : confirmData.type === 'warning' ? '#F59E0B' : '#3B82F6',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '600',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            {confirmData.confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  // Modal Konfirmasi Hapus Notifikasi
  const DeleteConfirmModal = () => (
    <div 
      className="fixed inset-0 z-[250] flex items-center justify-center" 
      style={{ background: 'rgba(0,0,0,0.75)' }}
    >
      <div 
        className="bg-white rounded-2xl w-full max-w-sm mx-4 animate-slide-up overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '24px 20px 20px 20px', textAlign: 'center' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '28px',
            margin: '0 auto 16px',
            background: '#FEE2E2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
              <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1a1a1a', marginBottom: '8px' }}>
            {deleteTarget === 'all' ? 'Hapus Semua Notifikasi?' : 'Hapus Notifikasi?'}
          </h3>
          <p style={{ fontSize: '14px', color: '#666', lineHeight: 1.5 }}>
            {deleteTarget === 'all' 
              ? 'Apakah Anda yakin ingin menghapus semua notifikasi? Tindakan ini tidak dapat dibatalkan.' 
              : 'Apakah Anda yakin ingin menghapus notifikasi ini? Tindakan ini tidak dapat dibatalkan.'}
          </p>
        </div>
        
        <div style={{ padding: '16px 20px 24px 20px', display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => {
              setShowDeleteConfirmModal(false);
              setSelectedDeleteId(null);
              setDeleteTarget(null);
            }}
            style={{
              flex: 1,
              padding: '12px',
              background: '#f5f5f5',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#666',
              cursor: 'pointer'
            }}
          >
            Batal
          </button>
          <button 
            onClick={() => {
              if (deleteTarget === 'all') {
                deleteAllNotifications();
              } else if (deleteTarget === 'single' && selectedDeleteId) {
                deleteNotification(selectedDeleteId);
              }
            }}
            style={{
              flex: 1,
              padding: '12px',
              background: '#EF4444',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '600',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            Ya, Hapus
          </button>
        </div>
      </div>
    </div>
  );

  // Modal Notifikasi Detail
  const NotificationDetailModal = () => (
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center" 
      style={{ background: 'rgba(0,0,0,0.75)' }}
    >
      <div 
        className="bg-white rounded-2xl w-full max-w-md mx-4 animate-slide-up overflow-hidden"
        style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ 
          padding: '20px',
          borderBottom: '1px solid #f0f0f0',
          background: 'white',
          position: 'sticky',
          top: 0
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: selectedNotification?.type === 'warning' ? '#FEF3C7' : selectedNotification?.type === 'success' ? '#D1FAE5' : '#DBEAFE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {selectedNotification?.type === 'warning' ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                ) : selectedNotification?.type === 'success' ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2">
                    <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1a1a1a' }}>Detail Notifikasi</h3>
            </div>
            <button 
              onClick={() => setShowNotificationDetailModal(false)}
              style={{
                width: '32px',
                height: '32px',
                background: '#f5f5f5',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px' }}>
          {selectedNotification && (
            <>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1a1a1a', marginBottom: '12px' }}>
                {selectedNotification.title}
              </h2>
              <div style={{ 
                fontSize: '14px', 
                color: '#475569', 
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {selectedNotification.message}
              </div>
              <div style={{ 
                marginTop: '16px', 
                paddingTop: '16px', 
                borderTop: '1px solid #f0f0f0',
                fontSize: '11px',
                color: '#94A3B8'
              }}>
                {new Date(selectedNotification.createdAt).toLocaleString('id-ID', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </>
          )}
        </div>
        
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid #f0f0f0',
          background: 'white'
        }}>
          <button 
            onClick={() => setShowNotificationDetailModal(false)}
            style={{
              width: '100%',
              padding: '12px',
              background: '#3B82F6',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '600',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );

  // Notification Modal Component yang sudah diperbaiki
  const NotificationModal = () => {
    const [localLoading, setLocalLoading] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);
    
    const handleClose = () => {
      if (localLoading) return;
      setShowNotificationModal(false);
    };
    
    const handleOpenDetail = (notif: any) => {
      if (localLoading) return;
      
      if (!notif.isRead) {
        markAsRead(notif.id);
      }
      setSelectedNotification(notif);
      setShowNotificationDetailModal(true);
    };
    
    // Handle click outside - hanya tutup jika klik di overlay
    const handleOverlayClick = (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        handleClose();
      }
    };
    
    // Handle escape key
    useEffect(() => {
      const handleEscKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          handleClose();
        }
      };
      
      if (showNotificationModal) {
        document.addEventListener('keydown', handleEscKey);
        document.body.style.overflow = 'hidden';
      }
      
      return () => {
        document.removeEventListener('keydown', handleEscKey);
        document.body.style.overflow = 'unset';
      };
    }, [showNotificationModal]);
    
    return (
      <div 
        className="fixed inset-0 z-[200] flex items-end justify-center" 
        style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={handleOverlayClick}
      >
        <div 
          ref={modalRef}
          className="bg-white rounded-t-3xl w-full animate-slide-up"
          style={{ 
            width: '100%',
            maxWidth: '100%',
            margin: 0,
            borderTopLeftRadius: '28px',
            borderTopRightRadius: '28px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ 
            padding: '24px 20px 16px 20px',
            borderBottom: '1px solid #f0f0f0',
            position: 'sticky',
            top: 0,
            background: 'white',
            zIndex: 10,
            borderTopLeftRadius: '28px',
            borderTopRightRadius: '28px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <h3 style={{ fontSize: '22px', fontWeight: 'bold', color: '#1a1a1a' }}>Notifikasi</h3>
              <button 
                onClick={handleClose}
                disabled={localLoading}
                style={{
                  width: '36px',
                  height: '36px',
                  background: '#f5f5f5',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  cursor: 'pointer',
                  opacity: localLoading ? 0.5 : 1
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p style={{ fontSize: '13px', color: '#999', marginTop: '4px' }}>
              {unreadCount > 0 ? `${unreadCount} notifikasi belum dibaca` : 'Semua notifikasi sudah dibaca'}
            </p>
            <p style={{ fontSize: '11px', color: '#bbb', marginTop: '2px' }}>
              Menampilkan notifikasi 24 jam terakhir
            </p>
          </div>
          
          <div style={{ overflowY: 'auto', flex: 1, padding: '16px 16px 80px 16px' }}>
            {notifications.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '60px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg 
                  width="80" 
                  height="80" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="#94A3B8" 
                  strokeWidth="1.5"
                >
                  <path d="M18 8C18 4.5 15 2 12 2C9 2 6 4.5 6 8C6 12 4 14 4 14H20C20 14 18 12 18 8Z" />
                  <path d="M9 17C9 18.5 10.5 20 12 20C13.5 20 15 18.5 15 17" />
                  <path d="M4 14H20" />
                </svg>
                <p style={{ 
                  color: '#999', 
                  marginTop: '16px', 
                  fontSize: '15px'
                }}>
                  Tidak ada notifikasi
                </p>
                <p style={{ 
                  color: '#bbb', 
                  marginTop: '6px', 
                  fontSize: '13px'
                }}>
                  Notifikasi akan muncul di sini
                </p>
              </div>
            ) : (
              notifications.map((notif: any) => (
                <div 
                  key={notif.id} 
                  style={{
                    background: !notif.isRead ? '#f0f7ff' : '#fafafa',
                    borderRadius: '16px',
                    padding: '16px',
                    marginBottom: '12px',
                    border: !notif.isRead ? '1px solid #d4e4ff' : '1px solid #eee',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', gap: '14px' }}>
                    <div 
                      style={{ flex: 1, cursor: 'pointer' }}
                      onClick={() => handleOpenDetail(notif)}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                          <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '14px',
                            background: notif.type === 'warning' ? '#fff3e0' : notif.type === 'success' ? '#e8f5e9' : '#e3f2fd',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {notif.type === 'warning' ? (
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff9800" strokeWidth="2">
                                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                            ) : notif.type === 'success' ? (
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4caf50" strokeWidth="2">
                                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            ) : (
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2196f3" strokeWidth="2">
                                <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <p style={{ fontWeight: 'bold', fontSize: '15px', color: '#1a1a1a' }}>{notif.title}</p>
                              {!notif.isRead && (
                                <div style={{ 
                                  width: '8px', 
                                  height: '8px', 
                                  background: '#2196f3', 
                                  borderRadius: '50%',
                                  flexShrink: 0
                                }} />
                              )}
                            </div>
                            <p style={{ fontSize: '13px', color: '#666', marginTop: '6px', lineHeight: 1.4 }}>
                              {truncateText(notif.message, 80)}
                            </p>
                            <p style={{ fontSize: '11px', color: '#999', marginTop: '8px' }}>
                              {new Date(notif.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                            {notif.message.length > 80 && (
                              <p style={{ fontSize: '11px', color: '#3B82F6', marginTop: '4px' }}>
                                Ketuk untuk baca selengkapnya →
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        confirmDeleteNotification(notif.id);
                      }}
                      disabled={localLoading}
                      style={{
                        width: '32px',
                        height: '32px',
                        background: '#FEE2E2',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: 'none',
                        cursor: 'pointer',
                        flexShrink: 0,
                        marginTop: '8px',
                        opacity: localLoading ? 0.5 : 1
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div style={{
            padding: '16px 20px 30px 20px',
            borderTop: '1px solid #f0f0f0',
            background: 'white',
            position: 'sticky',
            bottom: 0
          }}>
            <button 
              onClick={handleClose}
              disabled={localLoading}
              style={{
                width: '100%',
                padding: '14px',
                background: '#f5f5f5',
                border: 'none',
                borderRadius: '14px',
                fontSize: '15px',
                fontWeight: '600',
                color: '#333',
                cursor: 'pointer',
                opacity: localLoading ? 0.5 : 1
              }}
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    );
  };

  const RiwayatView = () => (
    <div style={{ padding: '0 20px', paddingBottom: '20px' }}>
      <div style={{ marginTop: '16px', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0A1628' }}>Riwayat Absensi</h3>
        <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>Semua riwayat kehadiran Anda</p>
      </div>
      
      {riwayatAbsen.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '16px', padding: '40px 20px', textAlign: 'center', border: '0.5px solid rgba(59,130,246,0.12)' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <p style={{ color: '#475569', marginTop: '12px', fontWeight: 500 }}>Belum ada riwayat</p>
          <p style={{ color: '#94A3B8', fontSize: '12px', marginTop: '4px' }}>Silakan lakukan absen terlebih dahulu</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {riwayatAbsen.map((item: any) => (
            <div key={item.id} style={{ background: '#fff', borderRadius: '14px', padding: '14px 16px', border: '0.5px solid rgba(59,130,246,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: item.status === 'hadir' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.status === 'hadir' ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  )}
                </div>
                <div>
                  <p style={{ fontWeight: 600, fontSize: '14px', color: '#0A1628' }}>{formatDate(item.timestamp)}</p>
                  <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>{new Date(item.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</p>
                </div>
              </div>
              <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, background: item.status === 'hadir' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', color: item.status === 'hadir' ? '#10B981' : '#F59E0B' }}>
                {item.status === 'hadir' ? 'Hadir' : 'Terlambat'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const ProfilView = () => (
    <div style={{ padding: '0 20px', paddingBottom: '20px' }}>
      <div style={{ marginTop: '16px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0A1628' }}>Profil Saya</h3>
      </div>
      
      <div style={{ background: '#fff', borderRadius: '20px', padding: '24px', border: '0.5px solid rgba(59,130,246,0.12)', textAlign: 'center' }}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: profileImage ? 'transparent' : 'linear-gradient(135deg, #3B82F6, #6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', overflow: 'hidden' }}>
            {profileImage ? (
              <img src={profileImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Profile" />
            ) : (
              <span style={{ fontSize: '32px', fontWeight: 'bold', color: '#fff' }}>{getInitial()}</span>
            )}
          </div>
          <label style={{ position: 'absolute', bottom: '-4px', right: '-4px', background: '#fff', borderRadius: '50%', padding: '4px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/></svg>
            <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
          </label>
        </div>
        
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0A1628', marginTop: '16px' }}>{namaUser}</h3>
        <p style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>{emailUser}</p>
        <span style={{ display: 'inline-block', marginTop: '8px', padding: '4px 12px', background: 'rgba(16,185,129,0.1)', borderRadius: '20px', fontSize: '11px', fontWeight: 600, color: '#10B981' }}>Karyawan Aktif</span>
      </div>
      
      <div style={{ marginTop: '16px', background: '#fff', borderRadius: '16px', padding: '20px', border: '0.5px solid rgba(59,130,246,0.12)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '0.5px solid #E2E8F0' }}>
          <span style={{ color: '#475569', fontSize: '14px' }}>Status</span>
          <span style={{ fontWeight: 600, color: '#0A1628' }}>Karyawan Tetap</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '0.5px solid #E2E8F0' }}>
          <span style={{ color: '#475569', fontSize: '14px' }}>Total Kehadiran</span>
          <span style={{ fontWeight: 600, color: '#0A1628' }}>{stats.hadir + stats.terlambat} Hari</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
          <span style={{ color: '#475569', fontSize: '14px' }}>Tingkat Kehadiran</span>
          <span style={{ fontWeight: 600, color: '#0A1628' }}>
            {stats.hadir + stats.terlambat > 0 ? Math.round((stats.hadir / (stats.hadir + stats.terlambat)) * 100) : 0}%
          </span>
        </div>
      </div>
      
      <button 
        onClick={handleLogout} 
        style={{ 
          width: '100%', 
          marginTop: '20px', 
          padding: '12px', 
          background: '#FEF2F2', 
          border: '0.5px solid #FECACA', 
          borderRadius: '14px', 
          color: '#EF4444', 
          fontWeight: 600, 
          fontSize: '14px', 
          cursor: 'pointer' 
        }}
      >
        Logout
      </button>
    </div>
  );

  const IzinView = () => (
    <div style={{ padding: '0 16px', paddingBottom: '20px' }}>
      <div style={{ marginTop: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0A1628' }}>Pengajuan Izin</h3>
            <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>
              Ajukan izin (minimal H-3 sebelum tanggal)
            </p>
          </div>
          <button
            onClick={() => setShowIzinModal(true)}
            disabled={!quota.canApply}
            style={{
              background: quota.canApply ? '#3B82F6' : '#94A3B8',
              color: 'white',
              border: 'none',
              padding: '10px 18px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: quota.canApply ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: quota.canApply ? 1 : 0.6
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 4v16m8-8H4" />
            </svg>
            Ajukan Izin
          </button>
        </div>
        
        {/* Card Sisa Jatah Izin */}
        <div style={{
          background: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)',
          borderRadius: '16px',
          padding: '16px',
          marginBottom: '20px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>Sisa Jatah Izin Bulan Ini</p>
              <p style={{ fontSize: '28px', fontWeight: 'bold' }}>
                {quota.remaining} / {quota.quota}
              </p>
              <p style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>
                Sudah digunakan: {quota.used} kali
              </p>
            </div>
            <div style={{
              width: '48px',
              height: '48px',
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
      
      {izinList.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '16px', padding: '40px 20px', textAlign: 'center', border: '0.5px solid rgba(59,130,246,0.12)' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5">
            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <p style={{ color: '#475569', marginTop: '12px', fontWeight: 500 }}>Belum ada pengajuan izin</p>
          <p style={{ color: '#94A3B8', fontSize: '12px', marginTop: '4px' }}>Klik tombol + Ajukan Izin untuk mengajukan</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {izinList.map((item: any) => {
            const status = getStatusBadge(item.status);
            const tanggalFormatted = new Date(item.tanggal).toLocaleDateString('id-ID', { 
              weekday: 'long', 
              day: 'numeric', 
              month: 'long', 
              year: 'numeric' 
            });
            
            return (
              <div 
                key={item.id} 
                style={{ 
                  background: '#fff', 
                  borderRadius: '16px', 
                  padding: '16px', 
                  border: '0.5px solid rgba(59,130,246,0.12)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                    <div style={{ 
                      width: '36px', 
                      height: '36px', 
                      borderRadius: '12px', 
                      background: status.bg, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={status.color} strokeWidth="2">
                        <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: '#0A1628', marginBottom: '4px' }}>
                        {tanggalFormatted}
                      </div>
                      <span style={{ 
                        background: status.bg, 
                        color: status.color, 
                        padding: '4px 10px', 
                        borderRadius: '20px', 
                        fontSize: '10px', 
                        fontWeight: 600,
                        display: 'inline-block'
                      }}>
                        {status.text}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div style={{ 
                  background: '#F8FAFC', 
                  borderRadius: '12px', 
                  padding: '12px', 
                  marginBottom: '12px'
                }}>
                  <p style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '6px' }}>Alasan Izin:</p>
                  <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>{item.alasan}</p>
                </div>
                
                {item.keterangan && (
                  <div style={{ 
                    background: '#FEF3C7', 
                    borderRadius: '12px', 
                    padding: '12px',
                    marginBottom: '8px'
                  }}>
                    <p style={{ fontSize: '11px', color: '#D97706', marginBottom: '6px' }}>Keterangan Admin:</p>
                    <p style={{ fontSize: '12px', color: '#92400E' }}>{item.keterangan}</p>
                  </div>
                )}
                
                <div style={{ fontSize: '10px', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  Diajukan: {new Date(item.diajukanPada).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F0F4FF]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", maxWidth: '390px', margin: '0 auto', position: 'relative' }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(100%); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-in-right {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
        .animate-slide-in-right { animation: slide-in-right 0.3s ease-out; }
        .animate-spin { animation: spin 1s linear infinite; }
        
        button:active {
          transform: scale(0.98);
          transition: transform 0.05s;
        }
        
        input:focus, textarea:focus {
          outline: none;
        }
      `}</style>

      <div className="phone" style={{ background: '#F0F4FF', minHeight: '100vh', position: 'relative', overflow: 'hidden', paddingBottom: '70px' }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: '-80px', right: '-60px', width: '220px', height: '220px', background: 'radial-gradient(circle,rgba(59,130,246,0.12) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '40px', left: '-80px', width: '180px', height: '180px', background: 'radial-gradient(circle,rgba(99,102,241,0.08) 0%,transparent 70%)', pointerEvents: 'none' }} />

        {/* Header */}
        <div className="header" style={{ padding: '12px 20px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div className="logo-wrap" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="logo-icon" style={{ width: '36px', height: '36px', background: '#3B82F6', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
            </div>
            <div>
              <div className="logo-text" style={{ fontSize: '18px', fontWeight: 700, color: '#0A1628', letterSpacing: '-0.3px' }}>AbsenEase</div>
              <div className="logo-sub" style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 500, textTransform: 'uppercase' }}>Attendance System</div>
            </div>
          </div>
          <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div 
              className="notif-btn" 
              onClick={() => setShowNotificationModal(true)}
              style={{ width: '38px', height: '38px', background: '#fff', borderRadius: '12px', border: '0.5px solid rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: 'pointer', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
              {unreadCount > 0 && <div style={{ position: 'absolute', top: '8px', right: '8px', width: '8px', height: '8px', background: '#F43F5E', borderRadius: '50%', border: '2px solid #fff' }}></div>}
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {activeNav === 'beranda' && (
            <>
              {/* Greeting */}
              <div className="greeting" style={{ padding: '0 20px 20px' }}>
                <div className="greeting-row" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div className="avatar-lg" style={{ width: '52px', height: '52px', borderRadius: '16px', background: profileImage ? 'transparent' : 'linear-gradient(135deg,#3B82F6,#6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '20px', color: '#fff', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                    {profileImage ? (
                      <img src={profileImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Profile" />
                    ) : (
                      getInitial()
                    )}
                    <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '14px', height: '14px', background: '#10B981', borderRadius: '50%', border: '2px solid #F0F4FF' }}></div>
                  </div>
                  <div className="greet-text">
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0A1628', letterSpacing: '-0.3px' }}>{getGreeting()} 👋</h2>
                    <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '2px', fontWeight: 500 }}>{namaUser}</p>
                    <span className="role" style={{ fontSize: '11px', background: '#E8EEFF', color: '#3B82F6', padding: '2px 8px', borderRadius: '6px', fontWeight: 600, display: 'inline-block', marginTop: '4px', border: '0.5px solid rgba(59,130,246,0.2)' }}>Karyawan</span>
                  </div>
                </div>
              </div>

              {/* Time Card */}
              <div className="time-card" style={{ margin: '0 20px 16px', background: '#0A1628', borderRadius: '20px', padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '-40px', right: '-30px', width: '140px', height: '140px', background: 'rgba(59,130,246,0.2)', borderRadius: '50%' }}></div>
                <div style={{ position: 'absolute', bottom: '-30px', left: '-20px', width: '100px', height: '100px', background: 'rgba(99,102,241,0.15)', borderRadius: '50%' }}></div>
                <div className="time-label" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px', position: 'relative', zIndex: 1 }}>Waktu Sekarang</div>
                <div className="time-big" style={{ fontSize: '40px', fontWeight: 700, color: '#fff', letterSpacing: '-1px', lineHeight: 1, position: 'relative', zIndex: 1 }}>{currentTime}<span style={{ fontSize: '26px', opacity: 0.5 }}> WIB</span></div>
                <div className="time-date" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', marginTop: '6px', fontWeight: 500, position: 'relative', zIndex: 1, textTransform: 'capitalize' }}>{currentDate}</div>
                <div className="time-bottom" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px', position: 'relative', zIndex: 1 }}>
                  <div className="time-chip" style={{ background: 'rgba(59,130,246,0.25)', border: '0.5px solid rgba(59,130,246,0.4)', borderRadius: '8px', padding: '5px 10px', fontSize: '11px', fontWeight: 600, color: '#93C5FD', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '6px', height: '6px', background: '#10B981', borderRadius: '50%', animation: 'pulse 1.5s infinite' }}></div>
                    Live
                  </div>
                  <div className="status-chip" style={{ 
                    background: smoothedDistance !== null && smoothedDistance <= settings.radius ? 'rgba(16,185,129,0.2)' : smoothedDistance !== null ? 'rgba(239,68,68,0.2)' : 'rgba(100,116,139,0.2)', 
                    border: smoothedDistance !== null && smoothedDistance <= settings.radius ? '0.5px solid rgba(16,185,129,0.4)' : smoothedDistance !== null ? '0.5px solid rgba(239,68,68,0.4)' : '0.5px solid rgba(100,116,139,0.4)', 
                    borderRadius: '8px', 
                    padding: '5px 10px', 
                    fontSize: '11px', 
                    fontWeight: 600, 
                    color: smoothedDistance !== null && smoothedDistance <= settings.radius ? '#10B981' : smoothedDistance !== null ? '#EF4444' : '#64748B', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '5px' 
                  }}>
                    {smoothedDistance !== null && smoothedDistance <= settings.radius ? (
                      <>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/>
                          <circle cx="12" cy="10" r="3"/>
                        </svg>
                        Dalam Jangkauan (~{smoothedDistance}m)
                      </>
                    ) : smoothedDistance !== null ? (
                      <>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                          <line x1="12" y1="9" x2="12" y2="13"/>
                          <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        Di Luar Jangkauan (~{smoothedDistance}m)
                      </>
                    ) : (
                      <>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="12" y1="8" x2="12" y2="12"/>
                          <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        Mendeteksi Lokasi...
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Info jarak realtime */}
              {smoothedDistance !== null && (
                <div style={{ margin: '0 20px 10px', fontSize: '11px', color: smoothedDistance <= settings.radius ? '#10B981' : '#EF4444', textAlign: 'center' }}>
                  {smoothedDistance <= settings.radius ? (
                    `✓ Dalam jangkauan (estimasi ${smoothedDistance}m dari kantor, maksimal ${settings.radius}m)`
                  ) : (
                    `✗ Di luar jangkauan (estimasi ${smoothedDistance}m dari kantor, maksimal ${settings.radius}m)`
                  )}
                </div>
              )}

              {/* Absen Button */}
              <div className="absen-wrap" style={{ padding: '0 20px 16px' }}>
                <button onClick={handleAbsen} className="absen-btn" style={{ width: '100%', background: '#3B82F6', borderRadius: '20px', padding: '16px', display: 'flex', alignItems: 'center', gap: '10px', border: 'none', cursor: 'pointer', position: 'relative', overflow: 'hidden', transition: 'transform 0.15s', boxShadow: '0 8px 24px rgba(59,130,246,0.35)' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,rgba(255,255,255,0.1),transparent)' }}></div>
                  <div className="absen-icon" style={{ width: '36px', height: '36px', background: 'rgba(255,255,255,0.2)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  </div>
                  <div className="absen-label" style={{ flex: 1 }}>
                    <p style={{ fontSize: '15px', fontWeight: 700, color: '#fff', letterSpacing: '-0.2px' }}>Absen Masuk</p>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>Verifikasi wajah diperlukan</span>
                  </div>
                  <div className="absen-arrow" style={{ width: '32px', height: '32px', background: 'rgba(255,255,255,0.15)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </div>
                </button>
              </div>

              {/* Camera Section */}
              {showCamera && (
                <div style={{ margin: '0 20px 16px' }}>
                  <div style={{ background: '#fff', borderRadius: '16px', padding: '16px', border: '0.5px solid rgba(59,130,246,0.12)' }}>
                    <div className="relative rounded-lg overflow-hidden bg-black" style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#000' }}>
                      <Webcam ref={webcamRef} className="w-full aspect-video object-cover" screenshotFormat="image/jpeg" mirrored={false} videoConstraints={{ facingMode: "user", width: { ideal: 480 }, height: { ideal: 360 } }} style={{ width: '100%', aspectRatio: 'video', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', inset: 0, border: '2px solid #3B82F6', borderRadius: '12px', pointerEvents: 'none' }}></div>
                      <div style={{ position: 'absolute', bottom: '8px', left: '8px', right: '8px', textAlign: 'center' }}>
                        <p style={{ color: '#fff', fontSize: '11px', background: 'rgba(0,0,0,0.6)', display: 'inline-block', padding: '4px 12px', borderRadius: '20px' }}>Posisikan wajah</p>
                      </div>
                    </div>
                    <button onClick={handleAbsen} disabled={isProcessing} style={{ width: '100%', marginTop: '12px', background: '#3B82F6', color: '#fff', padding: '10px', borderRadius: '10px', fontWeight: 600, border: 'none', cursor: 'pointer', opacity: isProcessing ? 0.5 : 1 }}>
                      {isProcessing ? 'Memproses...' : 'Ambil Foto'}
                    </button>
                    <button onClick={() => setShowCamera(false)} style={{ width: '100%', marginTop: '8px', background: '#fff', color: '#475569', padding: '10px', borderRadius: '10px', fontSize: '13px', border: '0.5px solid #E2E8F0', cursor: 'pointer' }}>Batal</button>
                  </div>
                </div>
              )}

              {/* Status Already */}
              {todayStatus.sudahAbsen && (
                <div className="status-done" style={{ margin: '0 20px 16px', background: '#ECFDF5', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', border: '0.5px solid rgba(16,185,129,0.2)' }}>
                  <div className="status-done-icon" style={{ width: '32px', height: '32px', background: '#10B981', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                  </div>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#065F46' }}>Absen Hari Ini Tercatat</p>
                    <span style={{ fontSize: '11px', color: '#6EE7B7', fontWeight: 500 }}>{todayStatus.status === 'hadir' ? 'Hadir' : 'Terlambat'} {todayStatus.waktu && `• ${todayStatus.waktu} WIB`}</span>
                  </div>
                </div>
              )}

              {/* Stats Row */}
              <div className="stats-row" style={{ margin: '0 20px 20px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px' }}>
                <div className="stat-card" style={{ background: '#fff', borderRadius: '12px', padding: '14px 12px', border: '0.5px solid rgba(59,130,246,0.12)', textAlign: 'center' }}>
                  <div className="stat-icon" style={{ width: '32px', height: '32px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', background: 'rgba(59,130,246,0.1)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  </div>
                  <div className="stat-num" style={{ fontSize: '20px', fontWeight: 700, color: '#0A1628', letterSpacing: '-0.5px' }}>{stats.hadir}</div>
                  <div className="stat-label" style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>Hadir</div>
                </div>
                <div className="stat-card" style={{ background: '#fff', borderRadius: '12px', padding: '14px 12px', border: '0.5px solid rgba(59,130,246,0.12)', textAlign: 'center' }}>
                  <div className="stat-icon" style={{ width: '32px', height: '32px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', background: 'rgba(245,158,11,0.1)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </div>
                  <div className="stat-num" style={{ fontSize: '20px', fontWeight: 700, color: '#F59E0B', letterSpacing: '-0.5px' }}>{stats.terlambat}</div>
                  <div className="stat-label" style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>Terlambat</div>
                </div>
                <div className="stat-card" style={{ background: '#fff', borderRadius: '12px', padding: '14px 12px', border: '0.5px solid rgba(59,130,246,0.12)', textAlign: 'center' }}>
                  <div className="stat-icon" style={{ width: '32px', height: '32px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', background: 'rgba(16,185,129,0.1)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  </div>
                  <div className="stat-num" style={{ fontSize: '20px', fontWeight: 700, color: '#10B981', letterSpacing: '-0.5px' }}>{stats.izin}</div>
                  <div className="stat-label" style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>Izin Disetujui</div>
                </div>
              </div>

              {/* Artikel Section */}
              <div className="section" style={{ padding: '0 20px 20px' }}>
                <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div className="section-title" style={{ fontSize: '14px', fontWeight: 700, color: '#0A1628', letterSpacing: '-0.2px' }}>Artikel Terbaru</div>
                  <div 
                    className="see-all" 
                    style={{ fontSize: '12px', color: '#3B82F6', fontWeight: 600, cursor: 'pointer' }}
                    onClick={handleLihatSemuaArtikel}
                  >
                    Lihat semua →
                  </div>
                </div>
                <div className="article-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {articles.slice(0, 2).map((article: any) => {
                    const publishDate = article.publishedAt || article.createdAt;
                    const formattedDate = publishDate ? new Date(publishDate).toLocaleDateString('id-ID') : 'Tanggal tidak tersedia';
                    
                    return (
                      <div 
                        key={article.id} 
                        className="article-card" 
                        style={{ background: '#fff', borderRadius: '12px', padding: '14px 16px', border: '0.5px solid rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                        onClick={() => openArticlePage(article.id)}
                      >
                        <div className="article-thumb" style={{ width: '60px', height: '60px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: '#EEF2FF', overflow: 'hidden' }}>
                          {article.imageUrl && article.imageUrl !== '' ? (
                            <img 
                              src={article.imageUrl} 
                              alt={article.title} 
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.style.display = 'flex';
                                  parent.style.alignItems = 'center';
                                  parent.style.justifyContent = 'center';
                                  parent.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
                                }
                              }}
                            />
                          ) : (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2">
                              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                              <polyline points="14 2 14 8 20 8"/>
                              <line x1="16" y1="13" x2="8" y2="13"/>
                              <line x1="16" y1="17" x2="8" y2="17"/>
                            </svg>
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div className="article-title" style={{ fontSize: '13px', fontWeight: 600, color: '#0A1628', lineHeight: 1.3, marginBottom: '4px' }}>
                            {article.title}
                          </div>
                          <div className="article-meta" style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 500 }}>
                            {article.category && <span style={{ background: '#E8EEFF', color: '#3B82F6', padding: '2px 6px', borderRadius: '4px', marginRight: '6px', fontSize: '10px' }}>{article.category}</span>}
                            {formattedDate} • By {article.author || 'Admin'}
                          </div>
                        </div>
                        <div className="article-arrow" style={{ color: '#94A3B8', flexShrink: 0 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M9 18l6-6-6-6"/>
                          </svg>
                        </div>
                      </div>
                    );
                  })}
                  {articles.length === 0 && (
                    <div className="text-center py-4 text-gray-400 text-sm">Belum ada artikel</div>
                  )}
                </div>
              </div>

              {/* Pemberitahuan Section */}
              <div className="section" style={{ padding: '0 20px 20px' }}>
                <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div className="section-title" style={{ fontSize: '14px', fontWeight: 700, color: '#0A1628', letterSpacing: '-0.2px' }}>Pemberitahuan</div>
                  <div className="see-all" style={{ fontSize: '12px', color: '#3B82F6', fontWeight: 600, cursor: 'pointer' }} onClick={() => setShowNotificationModal(true)}>Lihat semua →</div>
                </div>
                <div className="notif-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {notifications.slice(0, 2).map((notif: any) => (
                    <div 
                      key={notif.id} 
                      className="notif-card" 
                      style={{ background: '#fff', borderRadius: '12px', padding: '14px 16px', border: '0.5px solid rgba(59,130,246,0.12)', display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }} 
                      onClick={() => {
                        if (!notif.isRead) markAsRead(notif.id);
                        setSelectedNotification(notif);
                        setShowNotificationDetailModal(true);
                      }}
                    >
                      <div className="notif-icon" style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: notif.type === 'warning' ? '#FFFBEB' : notif.type === 'success' ? '#F0FDF4' : '#EEF2FF' }}>
                        {notif.type === 'warning' ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        ) : notif.type === 'success' ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="notif-title" style={{ fontSize: '13px', fontWeight: 600, color: '#0A1628', lineHeight: 1.3 }}>{notif.title}</div>
                        <div className="notif-desc" style={{ fontSize: '11px', color: '#94A3B8', marginTop: '3px', fontWeight: 500, lineHeight: 1.4 }}>
                          {truncateText(notif.message, 60)}
                        </div>
                        <div className="notif-time" style={{ fontSize: '10px', color: '#3B82F6', fontWeight: 600, marginTop: '4px' }}>{new Date(notif.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</div>
                      </div>
                      {!notif.isRead && <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>}
                    </div>
                  ))}
                  {notifications.length === 0 && (
                    <div className="text-center py-4 text-gray-400 text-sm">Tidak ada pemberitahuan</div>
                  )}
                </div>
              </div>
            </>
          )}

          {activeNav === 'riwayat' && <RiwayatView />}
          {activeNav === 'profil' && <ProfilView />}
          {activeNav === 'izin' && <IzinView />}
          {activeNav === 'laporan' && (
            <div style={{ padding: '0 20px', textAlign: 'center', marginTop: '40px' }}>
              <p style={{ color: '#94A3B8' }}>Fitur laporan sedang dikembangkan</p>
            </div>
          )}
        </div>

        {/* Bottom Navigation */}
        <div className="bottom-nav" role="navigation" style={{ 
          position: 'fixed', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          maxWidth: '390px', 
          margin: '0 auto',
          background: 'rgba(240,244,255,0.95)', 
          backdropFilter: 'blur(20px)', 
          borderTop: '0.5px solid rgba(59,130,246,0.1)', 
          display: 'flex', 
          justifyContent: 'space-around', 
          alignItems: 'center', 
          padding: '10px 0 20px',
          zIndex: 100
        }}>
          <div onClick={() => setActiveNav('beranda')} className={`nav-item ${activeNav === 'beranda' ? 'active' : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer', flex: 1, padding: '4px 0' }}>
            <div className="nav-icon" style={{ width: '40px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px', transition: 'background 0.15s', background: activeNav === 'beranda' ? 'rgba(59,130,246,0.1)' : 'transparent' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={activeNav === 'beranda' ? '#3B82F6' : '#94A3B8'} strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <span className="nav-label" style={{ fontSize: '10px', fontWeight: 600, color: activeNav === 'beranda' ? '#3B82F6' : '#94A3B8', letterSpacing: '0.3px' }}>Beranda</span>
            {activeNav === 'beranda' && <div style={{ width: '4px', height: '4px', background: '#3B82F6', borderRadius: '50%', marginTop: '2px' }}></div>}
          </div>
          <div onClick={() => setActiveNav('riwayat')} className={`nav-item ${activeNav === 'riwayat' ? 'active' : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer', flex: 1, padding: '4px 0' }}>
            <div className="nav-icon" style={{ width: '40px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px', transition: 'background 0.15s', background: activeNav === 'riwayat' ? 'rgba(59,130,246,0.1)' : 'transparent' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={activeNav === 'riwayat' ? '#3B82F6' : '#94A3B8'} strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </div>
            <span className="nav-label" style={{ fontSize: '10px', fontWeight: 600, color: activeNav === 'riwayat' ? '#3B82F6' : '#94A3B8', letterSpacing: '0.3px' }}>Riwayat</span>
          </div>
          <div onClick={() => setActiveNav('izin')} className={`nav-item ${activeNav === 'izin' ? 'active' : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer', flex: 1, padding: '4px 0' }}>
            <div className="nav-icon" style={{ width: '40px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px', transition: 'background 0.15s', background: activeNav === 'izin' ? 'rgba(59,130,246,0.1)' : 'transparent' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={activeNav === 'izin' ? '#3B82F6' : '#94A3B8'} strokeWidth="2">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </div>
            <span className="nav-label" style={{ fontSize: '10px', fontWeight: 600, color: activeNav === 'izin' ? '#3B82F6' : '#94A3B8', letterSpacing: '0.3px' }}>Izin</span>
            {activeNav === 'izin' && <div style={{ width: '4px', height: '4px', background: '#3B82F6', borderRadius: '50%', marginTop: '2px' }}></div>}
          </div>
          <div onClick={() => setActiveNav('laporan')} className={`nav-item ${activeNav === 'laporan' ? 'active' : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer', flex: 1, padding: '4px 0' }}>
            <div className="nav-icon" style={{ width: '40px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px', transition: 'background 0.15s', background: activeNav === 'laporan' ? 'rgba(59,130,246,0.1)' : 'transparent' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={activeNav === 'laporan' ? '#3B82F6' : '#94A3B8'} strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            </div>
            <span className="nav-label" style={{ fontSize: '10px', fontWeight: 600, color: activeNav === 'laporan' ? '#3B82F6' : '#94A3B8', letterSpacing: '0.3px' }}>Laporan</span>
          </div>
          <div onClick={() => setActiveNav('profil')} className={`nav-item ${activeNav === 'profil' ? 'active' : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer', flex: 1, padding: '4px 0' }}>
            <div className="nav-icon" style={{ width: '40px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px', transition: 'background 0.15s', background: activeNav === 'profil' ? 'rgba(59,130,246,0.1)' : 'transparent' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={activeNav === 'profil' ? '#3B82F6' : '#94A3B8'} strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <span className="nav-label" style={{ fontSize: '10px', fontWeight: 600, color: activeNav === 'profil' ? '#3B82F6' : '#94A3B8', letterSpacing: '0.3px' }}>Profil</span>
          </div>
        </div>
      </div>

      {/* MODALS */}
      {showConfirmModal && <ConfirmModal />}
      {showDeleteConfirmModal && <DeleteConfirmModal />}
      {showNotificationModal && <NotificationModal />}
      {showNotificationDetailModal && <NotificationDetailModal />}
      
      {/* Modal Ajukan Izin */}
      {showIzinModal && (
        <div 
          className="fixed inset-0 z-[200] flex items-end justify-center" 
          style={{ background: 'rgba(0,0,0,0.5)' }}
        >
          <div 
            className="bg-white rounded-t-3xl w-full animate-slide-up"
            style={{ 
              width: '100%',
              maxWidth: '100%',
              margin: 0,
              borderTopLeftRadius: '28px',
              borderTopRightRadius: '28px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ 
              padding: '24px 20px 16px 20px',
              borderBottom: '1px solid #f0f0f0',
              position: 'sticky',
              top: 0,
              background: 'white',
              zIndex: 10,
              borderTopLeftRadius: '28px',
              borderTopRightRadius: '28px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '14px',
                    background: '#EEF2FF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2">
                      <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1a1a1a' }}>Ajukan Izin</h3>
                    <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '2px' }}>Isi form di bawah ini</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowIzinModal(false)}
                  style={{
                    width: '36px',
                    height: '36px',
                    background: '#f5f5f5',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <form onSubmit={handleAjukanIzin} style={{ overflowY: 'auto', flex: 1, padding: '20px' }}>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1a1a1a', marginBottom: '8px' }}>
                  Tanggal Izin <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="date"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    border: '1px solid #E2E8F0',
                    borderRadius: '14px',
                    fontSize: '14px',
                    color: '#1a1a1a',
                    background: '#F8FAFC',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                  value={izinForm.tanggal}
                  onChange={(e) => setIzinForm({ ...izinForm, tanggal: e.target.value })}
                  required
                  min={new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                  onFocus={(e) => e.target.style.borderColor = '#3B82F6'}
                  onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p style={{ fontSize: '11px', color: '#F59E0B' }}>Minimal H-3 sebelum tanggal izin</p>
                </div>
              </div>
              
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1a1a1a', marginBottom: '8px' }}>
                  Alasan Izin <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <textarea
                  rows={4}
                  placeholder="Tulis alasan izin di sini..."
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    border: '1px solid #E2E8F0',
                    borderRadius: '14px',
                    fontSize: '14px',
                    color: '#1a1a1a',
                    background: '#F8FAFC',
                    resize: 'none',
                    outline: 'none',
                    fontFamily: 'inherit',
                    transition: 'all 0.2s'
                  }}
                  value={izinForm.alasan}
                  onChange={(e) => setIzinForm({ ...izinForm, alasan: e.target.value })}
                  required
                  onFocus={(e) => e.target.style.borderColor = '#3B82F6'}
                  onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
                />
              </div>
            </form>
            
            <div style={{
              padding: '16px 20px 30px 20px',
              borderTop: '1px solid #f0f0f0',
              background: 'white',
              position: 'sticky',
              bottom: 0
            }}>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <button 
                  type="button"
                  onClick={() => setShowIzinModal(false)}
                  style={{
                    flex: 1,
                    padding: '14px',
                    background: '#f5f5f5',
                    border: 'none',
                    borderRadius: '14px',
                    fontSize: '15px',
                    fontWeight: '600',
                    color: '#666',
                    cursor: 'pointer'
                  }}
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  onClick={handleAjukanIzin}
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '14px',
                    background: '#3B82F6',
                    border: 'none',
                    borderRadius: '14px',
                    fontSize: '15px',
                    fontWeight: '600',
                    color: 'white',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25"/>
                        <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.75"/>
                      </svg>
                      Memproses...
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                      Ajukan Izin
                    </>
                  )}
                </button>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                <p style={{ fontSize: '11px', color: '#94A3B8', textAlign: 'center' }}>
                  Pengajuan izin akan diproses oleh admin dalam waktu maksimal 1x24 jam
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Message */}
      {message && (
        <div className="fixed bottom-20 left-4 right-4 z-[200] animate-slide-in-right">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl ${
            message.type === 'success' 
              ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white' 
              : message.type === 'error'
              ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white'
              : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white'
          }`}>
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              {message.type === 'success' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : message.type === 'error' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">
                {message.type === 'success' ? 'Berhasil!' : message.type === 'error' ? 'Gagal!' : 'Informasi'}
              </p>
              <p className="text-xs opacity-90 mt-0.5 whitespace-pre-line">{message.text}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}