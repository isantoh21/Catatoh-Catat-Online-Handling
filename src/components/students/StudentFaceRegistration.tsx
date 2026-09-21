import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import * as faceapi from '@vladmandic/face-api';
import { Camera, ArrowLeft, CheckCircle2, User, RefreshCw, AlertTriangle, Monitor, Search, ShieldCheck, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { generateKioskToken } from '../../lib/kioskAuth';

interface StudentFaceRegistrationProps {
  onClose?: () => void;
  targetUserId?: string;
  schoolSettings?: { name: string; logo: string } | null;
  onSwitchToAttendance?: () => void;
  initialStudents?: any[];
}

export default function StudentFaceRegistration({ 
  onClose, 
  targetUserId, 
  schoolSettings, 
  onSwitchToAttendance,
  initialStudents 
}: StudentFaceRegistrationProps) {
  const [students, setStudents] = useState<any[]>(initialStudents || []);
  const [loading, setLoading] = useState(initialStudents && initialStudents.length > 0 ? false : true);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [isCopiedLink, setIsCopiedLink] = useState(false);

  const handleCopyRegisterLink = async () => {
    let uid = targetUserId;
    if (!uid) {
      const session = (await supabase.auth.getSession()).data.session;
      uid = session?.user?.id;
    }
    const token = uid ? generateKioskToken(uid, 'manage') : '';
    const registerUrl = uid ? `${window.location.origin}/daftar-wajah-siswa/${uid}?auth=${token}` : window.location.href;
    
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(registerUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = registerUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setIsCopiedLink(true);
      setTimeout(() => setIsCopiedLink(false), 2500);
    } catch (e) {
      console.error(e);
    }
  };
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackingIntervalRef = useRef<any>(null);
  const isDetectingRef = useRef<boolean>(false);
  const [detectedScore, setDetectedScore] = useState<number | null>(null);

  useEffect(() => {
    fetchStudents();
    loadModels();

    const channel = supabase
      .channel('realtime-kiosk-students')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => {
        fetchStudents();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
        trackingIntervalRef.current = null;
      }
      if (videoRef.current && videoRef.current.srcObject) {
        try {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(t => t.stop());
          videoRef.current.srcObject = null;
        } catch (e) {}
      }
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    };
  }, [targetUserId]);

  const fetchStudents = async () => {
    try {
      let uid = targetUserId;
      if (!uid) {
        const session = (await supabase.auth.getSession()).data.session;
        uid = session?.user?.id;
      }
      if (!uid) {
        try {
          const cached = localStorage.getItem('cached_kiosk_user_id');
          if (cached) uid = cached;
        } catch (e) {}
      }

      let fetchedData: any[] = [];

      // 1. Try querying with user_id if available
      if (uid) {
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .eq('user_id', uid)
          .order('nama_lengkap', { ascending: true });
        
        if (!error && data) {
          fetchedData = data;
        }
      }

      setStudents(fetchedData);
    } catch (err) {
      console.error('Error fetching students for face registration:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadModels = async () => {
    try {
      const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);
      setModelsLoaded(true);
      startVideo();
    } catch (e) {
      console.error(e);
      setStatusMsg('Gagal memuat model face-api');
    }
  };

  const startVideo = () => {
    navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 640, max: 1280 },
        height: { ideal: 480, max: 720 },
        frameRate: { ideal: 24, max: 30 }
      }
    })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(err => {
        console.error(err);
        setStatusMsg('Akses kamera ditolak / tidak tersedia.');
      });
  };

  const handleRegister = async () => {
    if (!selectedStudent) {
      setStatusMsg('Pilih siswa terlebih dahulu!');
      return;
    }
    if (!videoRef.current) return;

    setIsRegistering(true);
    setStatusMsg('Memindai wajah, harap diam...');
    
    try {
      const detection = await faceapi.detectSingleFace(
        videoRef.current,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
      ).withFaceLandmarks().withFaceDescriptor();
      if (!detection) {
        setStatusMsg('Wajah tidak terdeteksi. Coba lagi, pastikan terang dan menghadap kamera.');
        setIsRegistering(false);
        return;
      }

      const descriptorArr = Array.from(detection.descriptor);
      const studentName = students.find(s => s.id === selectedStudent)?.nama_lengkap;

      const { error } = await supabase
        .from('students')
        .update({ face_descriptor: JSON.stringify(descriptorArr) })
        .eq('id', selectedStudent);

      if (error) {
        setStatusMsg('Gagal menyimpan ke server: ' + error.message);
      } else {
        setStatusMsg(`Berhasil! Wajah "${studentName}" berhasil didaftarkan.`);
        fetchStudents(); // refresh to show updated
      }
    } catch (err: any) {
      console.error(err);
      setStatusMsg('Terjadi kesalahan: ' + err.message);
    }
    setIsRegistering(false);
  };

  const handleResetFace = async (id: string, name: string) => {
    if (!window.confirm(`Hapus data wajah siswa ${name}?`)) return;
    const { error } = await supabase.from('students').update({ face_descriptor: null }).eq('id', id);
    if (!error) {
      setStatusMsg(`Wajah ${name} telah direset.`);
      fetchStudents();
    }
  };

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(s => 
      s.nama_lengkap?.toLowerCase().includes(q) || 
      s.kelompok?.toLowerCase().includes(q) ||
      s.nis?.toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  const registeredCount = useMemo(() => {
    return students.filter(s => !!s.face_descriptor).length;
  }, [students]);

  return (
    <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col font-sans overflow-y-auto">
      {/* Header */}
      <div className="p-3 sm:p-4 flex items-center justify-between bg-slate-800 text-white shadow-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          {onClose && (
            <button 
              onClick={onClose} 
              className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-xl transition-colors"
              title="Kembali"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          {schoolSettings?.logo && (
            <img 
              src={schoolSettings.logo} 
              alt="Logo Sekolah" 
              className="w-10 h-10 object-contain rounded-lg bg-white/10 p-1 shrink-0" 
              referrerPolicy="no-referrer"
            />
          )}

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                {schoolSettings?.name || 'Kiosk Pendaftaran Wajah'}
              </h1>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                Pendaftaran Biometrik
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Daftarkan wajah siswa • {registeredCount} dari {students.length} Siswa Sudah Terdaftar
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleCopyRegisterLink}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
            title="Salin Link Kiosk Pendaftaran Wajah Siswa"
          >
            {isCopiedLink ? <CheckCircle2 className="w-4 h-4 text-indigo-400" /> : <Copy className="w-4 h-4 text-slate-300" />}
            <span className="hidden sm:inline">{isCopiedLink ? 'Tersalin!' : 'Salin Link'}</span>
          </button>

          {onSwitchToAttendance && (
            <button
              onClick={onSwitchToAttendance}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all shadow-md active:scale-95"
            >
              <Monitor className="w-4 h-4" />
              <span className="hidden md:inline">Buka Stand Absensi</span>
              <span className="md:hidden">Stand Absensi</span>
            </button>
          )}

          <div className="flex items-center gap-2 text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-bold">
            <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
            <span>Online</span>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 flex-1 flex flex-col md:flex-row gap-6 max-w-7xl mx-auto w-full">
        {/* Kiri: Kamera & Snapshot Register */}
        <div className="w-full md:w-1/2 flex flex-col items-center">
          <div className="bg-slate-800 rounded-3xl p-5 w-full shadow-xl border border-slate-700 relative overflow-hidden flex flex-col items-center justify-center min-h-[420px]">
            {!modelsLoaded ? (
              <div className="flex flex-col items-center justify-center text-slate-400 gap-4">
                <RefreshCw className="w-10 h-10 animate-spin text-indigo-400" />
                <p className="font-semibold text-white">Memuat model biometrik wajah...</p>
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden shadow-inner bg-black w-full max-w-[420px] aspect-square flex items-center justify-center">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  muted 
                  playsInline 
                  className="w-full h-full object-cover scale-x-[-1]" 
                  onPlay={() => {
                    const canvasEl = canvasRef.current;
                    const videoEl = videoRef.current;
                    if (canvasEl && videoEl) {
                      if (trackingIntervalRef.current) {
                        clearInterval(trackingIntervalRef.current);
                      }
                      
                      const detectorOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.35 });
                      
                      trackingIntervalRef.current = setInterval(async () => {
                        if (isRegistering || isDetectingRef.current) return;
                        isDetectingRef.current = true;
                        
                        try {
                          const vW = videoEl.videoWidth;
                          const vH = videoEl.videoHeight;
                          if (vW === 0 || vH === 0) {
                            isDetectingRef.current = false;
                            return;
                          }
                          
                          if (canvasEl.width !== vW || canvasEl.height !== vH) {
                            canvasEl.width = vW;
                            canvasEl.height = vH;
                          }
                          
                          const displaySize = { width: vW, height: vH };
                          const detection = await faceapi.detectSingleFace(videoEl, detectorOptions);
                          
                          const ctx = canvasEl.getContext('2d');
                          if (ctx) ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
                          
                          if (detection) {
                            const scorePercent = Math.round(detection.score * 100);
                            setDetectedScore(scorePercent);
                            
                            const resized = faceapi.resizeResults(detection, displaySize);
                            const box = resized.box;
                            const flippedBox = new faceapi.Rect(
                              displaySize.width - box.x - box.width,
                              box.y,
                              box.width,
                              box.height
                            );
                            const drawBox = new faceapi.draw.DrawBox(flippedBox, { 
                              label: `Wajah Terdeteksi (${scorePercent}%)`,
                              lineWidth: 2,
                              boxColor: '#10b981'
                            });
                            drawBox.draw(canvasEl);
                          } else {
                            setDetectedScore(null);
                          }
                        } catch (e) {
                          setDetectedScore(null);
                        } finally {
                          isDetectingRef.current = false;
                        }
                      }, 220);
                    }
                  }} 
                />
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
                
                {/* Dynamic Live Detection Pill - Only shows when face is detected */}
                {detectedScore != null && (
                  <div className="absolute bottom-3 inset-x-0 flex justify-center pointer-events-none px-3 z-10 animate-in fade-in duration-150">
                    <div className="px-3 py-1.5 rounded-full backdrop-blur-md bg-zinc-900/90 border border-emerald-500/60 text-xs font-semibold shadow-lg text-emerald-300 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span className="text-white font-bold">Wajah Terdeteksi</span>
                      <span className="text-zinc-500">•</span>
                      <span className="font-mono text-emerald-400 font-bold">{detectedScore}%</span>
                    </div>
                  </div>
                )}

                <div className="absolute inset-0 border-4 border-indigo-500/30 rounded-2xl pointer-events-none"></div>
              </div>
            )}
            
            {statusMsg && (
              <div className="mt-4 p-3.5 bg-slate-900 border border-slate-700 text-amber-300 rounded-xl text-center w-full text-sm font-medium shadow-inner">
                {statusMsg}
              </div>
            )}

            {/* Registration Controls Moved Here for Better Access */}
            <div className="w-full mt-6 space-y-3 p-4 bg-slate-800/40 rounded-2xl border border-slate-700">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Aksi Pendaftaran</h3>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-bold px-2 py-0.5 rounded-md border border-indigo-500/30">
                  {registeredCount}/{students.length} Terdaftar
                </span>
              </div>

              {/* Quick Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama siswa..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 text-white placeholder-slate-500 rounded-xl text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <select 
                className="w-full p-3 bg-slate-900 border border-slate-700 text-white rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                disabled={loading || students.length === 0}
              >
                <option value="">
                  {loading ? '-- Memuat data siswa... --' : students.length === 0 ? '-- Belum ada data siswa --' : '-- Pilih Siswa dari Daftar --'}
                </option>
                {filteredStudents.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.nama_lengkap} {s.kelompok ? `(${s.kelompok})` : ''} {s.face_descriptor ? '✓ (Sudah Terdaftar)' : ''}
                  </option>
                ))}
              </select>
              
              <button 
                onClick={handleRegister}
                disabled={!selectedStudent || isRegistering || !modelsLoaded}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 active:scale-[0.98]"
              >
                <Camera className="w-5 h-5" />
                {isRegistering ? 'Memindai & Mendaftarkan...' : 'Scan & Daftarkan Wajah'}
              </button>
            </div>

            <div className="w-full mt-4 bg-slate-900/40 p-3 rounded-2xl border border-slate-700/60 text-[10px] text-slate-500 space-y-1">
              <p className="font-bold text-slate-400 uppercase tracking-tighter">Tips:</p>
              <p>• Posisikan wajah tegak lurus menghadap kamera</p>
              <p>• Pastikan pencahayaan cukup terang & hindari kacamata hitam/masker</p>
            </div>
          </div>
        </div>

        {/* Kanan: Daftar Siswa */}
        <div className="w-full md:w-1/2 bg-slate-800 rounded-3xl shadow-xl border border-slate-700 flex flex-col overflow-hidden max-h-[85vh]">
          <div className="p-4 sm:p-5 border-b border-slate-700 bg-slate-800/95 sticky top-0 z-10">
            <h3 className="text-base font-bold text-white">Daftar Siswa</h3>
            <p className="text-xs text-slate-400 mt-1">Pilih nama siswa di bawah untuk pendaftaran cepat</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Daftar Siswa ({filteredStudents.length})
            </h4>

            {loading ? (
              <div className="p-8 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-2.5">
                <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
                <span>Memuat daftar siswa...</span>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                {students.length === 0 
                  ? 'Belum ada data siswa tersimpan di akun Anda.' 
                  : 'Tidak ada siswa yang cocok dengan pencarian.'}
              </div>
            ) : (
              filteredStudents.map(s => (
                <div 
                  key={s.id} 
                  onClick={() => setSelectedStudent(s.id)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    selectedStudent === s.id 
                      ? 'border-indigo-500 bg-indigo-600/15 ring-1 ring-indigo-500/50' 
                      : 'border-slate-700/70 bg-slate-900/50 hover:bg-slate-900 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold ${
                      s.face_descriptor 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {s.nama_lengkap ? s.nama_lengkap.substring(0, 2).toUpperCase() : 'SW'}
                    </div>
                    <div>
                      <div className="text-slate-200 font-bold text-sm">{s.nama_lengkap}</div>
                      <div className="text-xs text-slate-400">{s.kelompok || 'Tanpa Kelompok'} {s.nis ? `• NIS: ${s.nis}` : ''}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {s.face_descriptor ? (
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-emerald-400 text-xs font-bold bg-emerald-400/10 border border-emerald-400/20 px-2 py-1 rounded-lg">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Terdaftar
                        </span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResetFace(s.id, s.nama_lengkap);
                          }} 
                          className="text-xs text-rose-400 hover:text-rose-300 hover:underline px-1.5 py-1"
                          title="Hapus biometrik"
                        >
                          Reset
                        </button>
                      </div>
                    ) : (
                      <span className="flex items-center gap-1 text-slate-500 text-xs font-medium bg-slate-800/80 px-2 py-1 rounded-lg">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500/70" /> Belum Ada Wajah
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

