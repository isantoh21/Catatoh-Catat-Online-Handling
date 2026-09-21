import React, { useState, useEffect, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from '@vladmandic/face-api';
import { supabase } from '../../lib/supabaseClient';
import { verifyAttendanceWithGemini, checkGeminiHealth, generateGeminiGreeting } from '../../lib/geminiVision';
import { googleFaceMeshService, drawGoogleFaceMesh } from '../../lib/googleFaceMesh';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import {
  ArrowLeft, RefreshCw, UserCheck, ShieldCheck, Camera, Users, Clock, Copy, 
  CheckCircle2, RotateCcw, Volume2, VolumeX, Sparkles, Bot, AlertTriangle, 
  ScanFace, Sun, Moon, LogIn, LogOut, Lock
} from 'lucide-react';
import { logActivity } from '../../lib/activityLogger';
import { generateKioskToken } from '../../lib/kioskAuth';
import { autoPurgeSnapshotsIfNeeded } from '../../lib/snapshotPurge';
import { purgeDuplicateStudentAttendanceLogs } from '../../lib/studentAttendancePurge';

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

interface StudentAttendanceKioskProps {
  onClose?: () => void;
  targetUserId?: string;
  schoolSettings?: { name: string; logo: string } | null;
  onSwitchToRegister?: () => void;
}

interface StudentRecord {
  id: string;
  nama_lengkap: string;
  nomor_whatsapp?: string;
  kelompok?: string;
  nominal_spp?: number;
  face_descriptor?: string;
  user_id?: string;
  descriptorArray?: Float32Array;
  photo?: string;
}

interface AttendanceLogItem {
  id: string;
  student_id: string;
  type: 'in' | 'out';
  status: string;
  tanggal: string;
  waktu: string;
  created_at?: string;
  snapshot?: string;
  student?: {
    nama_lengkap: string;
    kelompok?: string;
  };
}

export default function StudentAttendanceKiosk({ 
  onClose, 
  targetUserId, 
  schoolSettings, 
  onSwitchToRegister 
}: StudentAttendanceKioskProps) {
  const webcamRef = useRef<Webcam>(null);
  const canvasOverlayRef = useRef<HTMLCanvasElement>(null);

  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const studentsRef = useRef<StudentRecord[]>([]);
  studentsRef.current = students;

  const [todayLogs, setTodayLogs] = useState<AttendanceLogItem[]>([]);
  const todayLogsRef = useRef<AttendanceLogItem[]>([]);
  todayLogsRef.current = todayLogs;

  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [isModelsLoaded, setIsModelsLoaded] = useState<boolean>(false);
  const [modelsLoadingProgress, setModelsLoadingProgress] = useState<string>('Memulai AI Biometrik Siswa...');

  // Attendance Mode: auto | in | out
  const [attendanceType, setAttendanceType] = useState<'auto' | 'in' | 'out'>('auto');
  const attendanceTypeRef = useRef<'auto' | 'in' | 'out'>('auto');
  attendanceTypeRef.current = attendanceType;

  // Sound & Speech
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const activeUtterancesRef = useRef<SpeechSynthesisUtterance[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Gemini AI Status
  const [geminiActive, setGeminiActive] = useState<boolean>(true);
  const [isGeminiAnalyzing, setIsGeminiAnalyzing] = useState<boolean>(false);
  const [lastAiVerification, setLastAiVerification] = useState<{
    studentName: string;
    confidence: number;
    greeting?: string;
  } | null>(null);

  // Face Mesh & Recognition State
  const [isFaceDetected, setIsFaceDetected] = useState<boolean>(false);
  const isFaceDetectedRef = useRef<boolean>(false);
  const [liveMatchInfo, setLiveMatchInfo] = useState<{
    name: string;
    percent: number;
    isMatch: boolean;
    kelompok?: string;
    alreadyAttended?: boolean;
  } | null>(null);

  // Hold recognition timer
  const [holdProgress, setHoldProgress] = useState<number>(0);
  const [holdRemainingSeconds, setHoldRemainingSeconds] = useState<number>(1.2);
  const holdStartTimeRef = useRef<number>(0);
  const holdingStudentIdRef = useRef<string | null>(null);
  const isSavingAttendanceRef = useRef<boolean>(false);

  // Success Toast / Modal
  const [activeSuccess, setActiveSuccess] = useState<{
    student: StudentRecord;
    type: 'in' | 'out';
    time: string;
    snapshot?: string;
    greeting?: string;
  } | null>(null);

  // Anti-spam debounce
  const lastProcessedTimeRef = useRef<{ [studentId: string]: number }>({});
  const lastSpokenAlreadyAttendedRef = useRef<{ [studentId: string]: number }>({});
  const alreadyAttendedNoticeRef = useRef<{ studentId: string; firstShownTime: number; dismissed: boolean }>({
    studentId: '',
    firstShownTime: 0,
    dismissed: false
  });

  const [scanStatus, setScanStatus] = useState<{
    state: 'idle' | 'scanning' | 'success' | 'already_attended' | 'cooldown';
    studentName?: string;
    message?: string;
  }>({ state: 'idle' });

  // Reset Camera state
  const [cameraKey, setCameraKey] = useState<number>(0);
  const [isResettingCamera, setIsResettingCamera] = useState<boolean>(false);
  const [resetToastMessage, setResetToastMessage] = useState<string>('');
  const [isCopiedLink, setIsCopiedLink] = useState(false);

  // Security & Auth State
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [activeSessionUserId, setActiveSessionUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const checkAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (mounted) {
          setActiveSessionUserId(data.session?.user?.id || null);
          setIsAuthChecking(false);
        }
      } catch (e) {
        if (mounted) setIsAuthChecking(false);
      }
    };
    checkAuth();
    
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        setActiveSessionUserId(session?.user?.id || null);
      }
    });
    
    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // User ID Resolution
  const effectiveUserId = targetUserId || activeSessionUserId;

  // Digital clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Check Gemini, warm up Face Mesh, and auto-purge snapshots > 2 days
  useEffect(() => {
    checkGeminiHealth().then(res => {
      if (res.status === 'ok') setGeminiActive(true);
    }).catch(() => {});

    googleFaceMeshService.initialize().catch(() => {});
    autoPurgeSnapshotsIfNeeded(effectiveUserId);
  }, [effectiveUserId]);

  // Web Audio Context initialization
  const getAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return null;
    try {
      if (!audioCtxRef.current) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) {
          audioCtxRef.current = new AudioCtxClass();
        }
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      return audioCtxRef.current;
    } catch (e) {
      return null;
    }
  }, []);

  // Pleasant Success Beep Chime
  const playSuccessBeep = useCallback(() => {
    if (isMuted) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      // Dual tone chord (E5: 659Hz -> G#5: 830Hz)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.18); // A5

      osc2.frequency.setValueAtTime(739.99, now); // F#5
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.18); // D6

      gainNode.gain.setValueAtTime(0.01, now);
      gainNode.gain.linearRampToValueAtTime(0.25, now + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.36);
      osc2.stop(now + 0.36);
    } catch (e) {
      console.warn('Audio chime error:', e);
    }
  }, [isMuted, getAudioContext]);

  // Natural Indonesian Text-to-Speech
  const speakText = useCallback((text: string) => {
    if (isMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
      }

      const msg = new SpeechSynthesisUtterance(text);
      msg.lang = 'id-ID';
      msg.rate = 1.05;
      msg.pitch = 1.05;
      msg.volume = 1.0;

      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const idVoice = voices.find(v => 
          v.lang.toLowerCase() === 'id-id' || 
          v.lang.toLowerCase() === 'id_id' || 
          v.lang.toLowerCase().startsWith('id') ||
          v.name.toLowerCase().includes('indonesia')
        );
        if (idVoice) {
          msg.voice = idVoice;
        }
      }

      activeUtterancesRef.current.push(msg);
      msg.onend = () => {
        activeUtterancesRef.current = activeUtterancesRef.current.filter(u => u !== msg);
      };
      msg.onerror = () => {
        activeUtterancesRef.current = activeUtterancesRef.current.filter(u => u !== msg);
      };

      setTimeout(() => {
        try {
          if (window.speechSynthesis.paused) window.speechSynthesis.resume();
          window.speechSynthesis.speak(msg);
        } catch (e) {}
      }, 50);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }, [isMuted]);

  // Fetch Students and Today's Logs
  const fetchData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const uid = session?.user?.id || activeSessionUserId;

      let fetchedStudents: StudentRecord[] = [];
      if (uid) {
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .eq('user_id', uid)
          .order('nama_lengkap', { ascending: true });

        if (!error && data) {
          fetchedStudents = data.map(s => {
            let descriptorArray: Float32Array | undefined = undefined;
            if (s.face_descriptor) {
              try {
                const parsed = JSON.parse(s.face_descriptor);
                if (Array.isArray(parsed) && parsed.length === 128) {
                  descriptorArray = new Float32Array(parsed);
                }
              } catch (e) {}
            }
            return {
              ...s,
              descriptorArray
            };
          });
        }
      }

      setStudents(fetchedStudents);

      // Fetch today's student attendance logs
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      let query = supabase
        .from('student_attendance_logs')
        .select('*')
        .eq('tanggal', todayStr)
        .order('created_at', { ascending: false });

      if (uid) {
        query = query.eq('user_id', uid);
      }

      const { data: logsData } = await query;
      if (logsData) {
        // Dedup logs in-memory: ensure max 1 log per student per day (keeping earliest)
        const seenStudentIds = new Set<string>();
        const dedupedLogs: AttendanceLogItem[] = [];
        const sortedAsc = [...logsData].sort(
          (a, b) => new Date(a.waktu || a.created_at || '').getTime() - new Date(b.waktu || b.created_at || '').getTime()
        );
        sortedAsc.forEach(log => {
          if (!seenStudentIds.has(log.student_id)) {
            seenStudentIds.add(log.student_id);
            dedupedLogs.push(log);
          }
        });
        const finalLogs = dedupedLogs.reverse();
        setTodayLogs(finalLogs);
        todayLogsRef.current = finalLogs;

        // Auto purge any duplicate student logs in database in background
        purgeDuplicateStudentAttendanceLogs(uid, todayStr).catch(err =>
          console.warn('Auto purge duplicate student logs notice:', err)
        );
      }
    } catch (e) {
      console.error('Failed to fetch student data:', e);
    } finally {
      setIsLoadingData(false);
    }
  }, [effectiveUserId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load face-api.js neural network models
  useEffect(() => {
    let isMounted = true;
    const loadModels = async () => {
      try {
        setModelsLoadingProgress('Memuat AI TinyFace...');
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        
        setModelsLoadingProgress('Memuat AI Landmarks...');
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        
        setModelsLoadingProgress('Memuat AI Face Recognition...');
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

        if (isMounted) {
          setIsModelsLoaded(true);
          setModelsLoadingProgress('Model AI siap');
        }
      } catch (err) {
        console.error('Error loading face-api models:', err);
        if (isMounted) {
          setModelsLoadingProgress('Gagal memuat model. Menggunakan fallback AI.');
        }
      }
    };
    loadModels();
    return () => { isMounted = false; };
  }, []);

  // Determine Effective Attendance Type (In vs Out)
  const getEffectiveAttendanceType = useCallback((studentId: string): 'in' | 'out' => {
    if (attendanceTypeRef.current === 'in') return 'in';
    if (attendanceTypeRef.current === 'out') return 'out';

    // Auto Mode: if student already has 'in' log today, record as 'out'
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const existingLogs = todayLogsRef.current.filter(l => l.student_id === studentId && l.tanggal === todayStr);
    const hasIn = existingLogs.some(l => l.type === 'in');

    if (!hasIn) return 'in';
    return 'out';
  }, []);

  // Capture Live Snapshot from Video Stream
  const captureSnapshot = useCallback((): string | null => {
    try {
      if (webcamRef.current) {
        const screenshot = webcamRef.current.getScreenshot();
        if (screenshot) return screenshot;
      }
      if (canvasOverlayRef.current) {
        const video = (webcamRef.current as any)?.video;
        if (video && video.videoWidth > 0) {
          const offscreen = document.createElement('canvas');
          offscreen.width = Math.min(640, video.videoWidth);
          offscreen.height = Math.min(480, video.videoHeight);
          const ctx = offscreen.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, offscreen.width, offscreen.height);
            return offscreen.toDataURL('image/jpeg', 0.85);
          }
        }
      }
    } catch (e) {}
    return null;
  }, []);

  // Handle Attendance Verification & DB Saving
  const handleAttendance = useCallback(async (matchedStudent: StudentRecord) => {
    if (isSavingAttendanceRef.current) return;
    isSavingAttendanceRef.current = true;

    const studentId = matchedStudent.id;
    const studentName = matchedStudent.nama_lengkap;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const actualType = 'in';

    // STRICT RULE: Only 1 attendance per student per day
    const existingLogs = todayLogsRef.current.filter(l => l.student_id === studentId && l.tanggal === todayStr);

    if (existingLogs.length > 0) {
      setScanStatus({
        state: 'already_attended',
        studentName,
        message: `${studentName} sudah absen hari ini.`
      });
      const now = Date.now();
      const lastSpoken = lastSpokenAlreadyAttendedRef.current[studentId] || 0;
      if (now - lastSpoken > 8000) {
        lastSpokenAlreadyAttendedRef.current[studentId] = now;
        speakText(`${studentName}, kamu sudah absen hari ini.`);
      }
      setTimeout(() => {
        setScanStatus({ state: 'idle' });
        isSavingAttendanceRef.current = false;
      }, 2500);
      return;
    }

    // Capture Snapshot for Audit & Report Proof
    const snapshot = captureSnapshot();

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const uid = session?.user?.id || activeSessionUserId;

      if (!uid) {
        throw new Error('Sesi Kiosk tidak valid atau telah berakhir. Harap login kembali sebagai Admin/Guru.');
      }

      // Generate Smart Gemini Indonesian Voice Greeting in Background
      const timeStr = format(new Date(), 'HH:mm');
      const schoolName = schoolSettings?.name || 'Sekolah';
      
      const greetingPromise = generateGeminiGreeting({
        name: studentName,
        attendanceType: actualType,
        time: timeStr,
        schoolName,
        role: 'student'
      });

      // Insert log into Supabase Database
      const { data: insertedLog, error } = await supabase
        .from('student_attendance_logs')
        .insert([{
          user_id: uid,
          student_id: studentId,
          tanggal: todayStr,
          waktu: new Date().toISOString(),
          status: 'Hadir',
          type: actualType,
          snapshot: snapshot || null,
          photo: snapshot || null
        }])
        .select()
        .single();

      if (error) {
        console.error('Error inserting student log:', error);
        speakText('Maaf, terjadi gangguan koneksi database. Silakan coba lagi atau lapor guru.');
        setScanStatus({
          state: 'idle',
          message: `Gagal mencatat: ${error.message}`
        });
        isSavingAttendanceRef.current = false;
        return;
      } else if (insertedLog) {
        setTodayLogs(prev => [insertedLog, ...prev.filter(l => l.student_id !== studentId)]);
        todayLogsRef.current = [insertedLog, ...todayLogsRef.current.filter(l => l.student_id !== studentId)];
        purgeDuplicateStudentAttendanceLogs(uid, todayStr).catch(() => {});
      }

      // Play Audio Beep Chime
      playSuccessBeep();

      // Retrieve Gemini Greeting
      let aiGreeting = '';
      try {
        aiGreeting = await greetingPromise;
      } catch (e) {
        aiGreeting = actualType === 'in'
          ? `Selamat pagi ${studentName}, absensi hadirmu berhasil dicatat! Semangat belajarnya hari ini!`
          : `Terima kasih ${studentName}, absensi pulangmu tercatat. Hati-hati di jalan ya!`;
      }

      // Speak Greeting with Natural Voice
      speakText(aiGreeting);

      // Show Rich Success Card
      setActiveSuccess({
        student: matchedStudent,
        type: actualType,
        time: timeStr,
        snapshot: snapshot || undefined,
        greeting: aiGreeting
      });

      setScanStatus({
        state: 'success',
        studentName,
        message: `${actualType === 'in' ? 'Absen Datang' : 'Absen Pulang'} Berhasil: ${studentName}`
      });

      await logActivity(
        'Absensi Siswa AI Kiosk',
        `Siswa ${studentName} berhasil ${actualType === 'in' ? 'Absen Datang' : 'Absen Pulang'} via Kiosk Biometrik Wajah Gemini`
      );

      // Reset Hold Progress
      holdStartTimeRef.current = 0;
      holdingStudentIdRef.current = null;
      setHoldProgress(0);

      setTimeout(() => {
        setActiveSuccess(null);
        setScanStatus({ state: 'idle' });
        isSavingAttendanceRef.current = false;
      }, 4500);

    } catch (err) {
      console.error('Attendance processing failed:', err);
      isSavingAttendanceRef.current = false;
    }
  }, [effectiveUserId, getEffectiveAttendanceType, captureSnapshot, playSuccessBeep, speakText, schoolSettings]);

  // Main Biometric Tracking & Face Mesh Loop
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    let isRunning = true;

    const processFrame = async () => {
      if (!isRunning) return;

      const video = (webcamRef.current as any)?.video;
      const canvas = canvasOverlayRef.current;

      if (!video || video.readyState !== 4 || !canvas || video.videoWidth === 0) {
        animationFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      // 1. Google Face Mesh Overlay Detection
      let faceMeshResults: any = null;
      try {
        faceMeshResults = await googleFaceMeshService.send(video);
      } catch (e) {}

      // 2. Face API Detection & Recognition
      let detection: any = null;
      if (isModelsLoaded) {
        try {
          const detectorOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.18 });
          detection = await faceapi.detectSingleFace(video, detectorOptions).withFaceLandmarks().withFaceDescriptor();
        } catch (e) {}
      }

      const vW = video.videoWidth;
      const vH = video.videoHeight;

      if (detection && detection.descriptor) {
        setIsFaceDetected(true);
        isFaceDetectedRef.current = true;

        // Draw Google Face Mesh Overlay if available
        if (ctx && faceMeshResults && faceMeshResults.multiFaceLandmarks && faceMeshResults.multiFaceLandmarks[0]) {
          drawGoogleFaceMesh(canvas, faceMeshResults.multiFaceLandmarks[0], {
            color: '#10b981',
            showContours: true,
            showIrises: true,
            showMeshPoints: true
          });
        }

        // Compare Descriptor with Registered Students
        let bestMatch: { student: StudentRecord; distance: number } | null = null;
        const currentDescriptor = detection.descriptor;

        for (const st of studentsRef.current) {
          if (st.descriptorArray) {
            const dist = faceapi.euclideanDistance(currentDescriptor, st.descriptorArray);
            if (dist < 0.58) { // Confident threshold
              if (!bestMatch || dist < bestMatch.distance) {
                bestMatch = { student: st, distance: dist };
              }
            }
          }
        }

        const box = detection.detection.box;
        // Flip box for mirror view
        const flippedBox = new faceapi.Rect(
          vW - box.x - box.width,
          box.y,
          box.width,
          box.height
        );

        if (bestMatch) {
          const student = bestMatch.student;
          const matchPercent = Math.round(Math.max(65, Math.min(99, (1 - bestMatch.distance / 0.65) * 100)));
          
          // Check if already attended today
          const todayStr = format(new Date(), 'yyyy-MM-dd');
          
          // STRICT RULE: If already has ANY log today, block (as per user request: "1 kali saja per hari")
          const hasAnyLogToday = todayLogsRef.current.some(l => 
            l.student_id === student.id && 
            l.tanggal === todayStr
          );
          
          const isBlocked = hasAnyLogToday;

          setLiveMatchInfo({
            name: student.nama_lengkap,
            percent: matchPercent,
            isMatch: true,
            kelompok: student.kelompok,
            alreadyAttended: isBlocked
          });

          // Draw HUD Sci-Fi Box
          if (ctx) {
            ctx.save();
            ctx.strokeStyle = isBlocked ? '#f59e0b' : '#10b981';
            ctx.lineWidth = 3;
            ctx.strokeRect(flippedBox.x, flippedBox.y, flippedBox.width, flippedBox.height);

            // Draw Corner Accents
            const accentColor = isBlocked ? '#fbbf24' : '#34d399';
            const cLen = 18;
            ctx.lineWidth = 4;
            ctx.strokeStyle = accentColor;
            // Top-left
            ctx.beginPath();
            ctx.moveTo(flippedBox.x, flippedBox.y + cLen);
            ctx.lineTo(flippedBox.x, flippedBox.y);
            ctx.lineTo(flippedBox.x + cLen, flippedBox.y);
            ctx.stroke();
            // Top-right
            ctx.beginPath();
            ctx.moveTo(flippedBox.x + flippedBox.width - cLen, flippedBox.y);
            ctx.lineTo(flippedBox.x + flippedBox.width, flippedBox.y);
            ctx.lineTo(flippedBox.x + flippedBox.width, flippedBox.y + cLen);
            ctx.stroke();
            // Bottom-left
            ctx.beginPath();
            ctx.moveTo(flippedBox.x, flippedBox.y + flippedBox.height - cLen);
            ctx.lineTo(flippedBox.x, flippedBox.y + flippedBox.height);
            ctx.lineTo(flippedBox.x + cLen, flippedBox.y + flippedBox.height);
            ctx.stroke();
            // Bottom-right
            ctx.beginPath();
            ctx.moveTo(flippedBox.x + flippedBox.width - cLen, flippedBox.y + flippedBox.height);
            ctx.lineTo(flippedBox.x + flippedBox.width, flippedBox.y + flippedBox.height);
            ctx.lineTo(flippedBox.x + flippedBox.width, flippedBox.y + flippedBox.height - cLen);
            ctx.stroke();

            // Label text banner
            ctx.fillStyle = isBlocked ? 'rgba(120, 53, 15, 0.85)' : 'rgba(6, 78, 59, 0.85)';
            ctx.fillRect(flippedBox.x, Math.max(0, flippedBox.y - 32), flippedBox.width, 28);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 13px sans-serif';
            const labelPrefix = isBlocked ? '✓ SUDAH ABSEN: ' : '';
            ctx.fillText(`${labelPrefix}${student.nama_lengkap} (${matchPercent}%)`, flippedBox.x + 8, Math.max(18, flippedBox.y - 12));
            ctx.restore();
          }

          // Trigger Hold Timer to Confirm
          const now = Date.now();
          if (holdingStudentIdRef.current === student.id) {
            // Only progress if NOT already attended
            if (isBlocked) {
              setHoldProgress(0);
              holdingStudentIdRef.current = student.id;
              
              // Spasmodic notice if they keep staying there
              const lastSpoken = lastSpokenAlreadyAttendedRef.current[student.id] || 0;
              if (now - lastSpoken > 12000) {
                lastSpokenAlreadyAttendedRef.current[student.id] = now;
                speakText(`${student.nama_lengkap}, kamu sudah absen hari ini. Terima kasih.`);
              }
            } else {
              const elapsed = (now - holdStartTimeRef.current) / 1000;
              const requiredHold = 1.0; // 1.0 second hold
              const progress = Math.min(100, Math.round((elapsed / requiredHold) * 100));
              setHoldProgress(progress);
              setHoldRemainingSeconds(Math.max(0, parseFloat((requiredHold - elapsed).toFixed(1))));

              if (elapsed >= requiredHold && !isSavingAttendanceRef.current) {
                const lastProcessed = lastProcessedTimeRef.current[student.id] || 0;
                if (now - lastProcessed > 4000) {
                  lastProcessedTimeRef.current[student.id] = now;
                  handleAttendance(student);
                }
              }
            }
          } else {
            holdingStudentIdRef.current = student.id;
            holdStartTimeRef.current = now;
            setHoldProgress(0);
            setHoldRemainingSeconds(1.0);
          }

        } else {
          // Face detected but not recognized yet
          const scorePercent = Math.round(detection.detection.score * 100);
          setLiveMatchInfo({
            name: 'Wajah Terdeteksi',
            percent: scorePercent,
            isMatch: false
          });

          holdingStudentIdRef.current = null;
          holdStartTimeRef.current = 0;
          setHoldProgress(0);

          if (ctx) {
            ctx.save();
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2;
            ctx.strokeRect(flippedBox.x, flippedBox.y, flippedBox.width, flippedBox.height);
            ctx.fillStyle = 'rgba(120, 53, 15, 0.85)';
            ctx.fillRect(flippedBox.x, Math.max(0, flippedBox.y - 28), flippedBox.width, 24);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px sans-serif';
            ctx.fillText(`Mencocokkan Biometrik... (${scorePercent}%)`, flippedBox.x + 6, Math.max(16, flippedBox.y - 10));
            ctx.restore();
          }
        }
      } else {
        setIsFaceDetected(false);
        isFaceDetectedRef.current = false;
        setLiveMatchInfo(null);
        holdingStudentIdRef.current = null;
        holdStartTimeRef.current = 0;
        setHoldProgress(0);
      }

      animationFrameRef.current = requestAnimationFrame(processFrame);
    };

    animationFrameRef.current = requestAnimationFrame(processFrame);

    return () => {
      isRunning = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isModelsLoaded, handleAttendance]);

  // Handle Reset Camera
  const handleResetCamera = useCallback(() => {
    setIsResettingCamera(true);
    setResetToastMessage('Sensor & kamera di-reset...');
    
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }

    holdStartTimeRef.current = 0;
    holdingStudentIdRef.current = null;
    isSavingAttendanceRef.current = false;
    isFaceDetectedRef.current = false;
    setHoldProgress(0);
    setLiveMatchInfo(null);
    setActiveSuccess(null);

    const canvas = canvasOverlayRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    setCameraKey(prev => prev + 1);

    setTimeout(() => {
      setIsResettingCamera(false);
      setResetToastMessage('');
    }, 1200);
  }, []);

  // Handle Copy Kiosk Link
  const handleCopyKioskLink = async () => {
    let uid = effectiveUserId;
    const token = uid ? generateKioskToken(uid, 'scan') : '';
    const kioskUrl = uid ? `${window.location.origin}/absen-siswa/${uid}?auth=${token}` : window.location.href;
    
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(kioskUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = kioskUrl;
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

  return (
    <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col font-sans overflow-hidden select-none">
      {/* Security Overlay for Authenticated Access Only */}
      {!isAuthChecking && !activeSessionUserId && (
        <div className="absolute inset-0 bg-slate-950/98 z-[100] flex items-center justify-center p-6 text-center backdrop-blur-md">
          <div className="max-w-sm space-y-6 animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 bg-rose-500/20 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-rose-500/30 rotate-12 shadow-2xl shadow-rose-500/20">
              <Lock className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white tracking-tight">Sesi Terbatas</h2>
              <p className="text-slate-400 text-sm leading-relaxed px-4">
                Kiosk Presensi Wajah hanya dapat dioperasikan oleh akun terdaftar. Sesi publik tidak diizinkan untuk keamanan data siswa.
              </p>
            </div>
            {onClose && (
              <button 
                onClick={onClose} 
                className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold transition-all border border-slate-700 active:scale-95 flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Kembali ke Dashboard
              </button>
            )}
            <p className="text-[10px] text-slate-600 font-mono">ERR_UNAUTHENTICATED_KIOSK_ACCESS</p>
          </div>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="p-3 sm:p-4 flex items-center justify-between bg-slate-900 border-b border-slate-800 text-white shadow-lg z-20">
        <div className="flex items-center gap-3">
          {onClose && (
            <button 
              onClick={onClose} 
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors"
              title="Kembali"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          {schoolSettings?.logo && (
            <img 
              src={schoolSettings.logo} 
              alt="Logo Sekolah" 
              className="w-10 h-10 object-contain rounded-xl bg-white/10 p-1 shrink-0" 
              referrerPolicy="no-referrer"
            />
          )}

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white">
                {schoolSettings?.name || 'Stand Absensi Wajah Siswa'}
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>Gemini Face Mesh</span>
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {format(currentTime, 'EEEE, dd MMMM yyyy • HH:mm:ss', { locale: id })} WIB
            </p>
          </div>
        </div>

        {/* Action Controls & Session Mode Toggle */}
        <div className="flex items-center gap-2">
          {/* Mode Selector (Removed for Student Kiosk - Strictly 1 scan per day) */}

          {/* Sound Mute Toggle */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`p-2 rounded-xl border transition-colors ${
              isMuted ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title={isMuted ? 'Suara Dinonaktifkan' : 'Suara Aktif'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Reset Camera */}
          <button
            onClick={handleResetCamera}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-xl transition-all border border-slate-700"
            title="Reset Sensor Kamera"
          >
            <RotateCcw className={`w-4 h-4 ${isResettingCamera ? 'animate-spin' : ''}`} />
          </button>

          {/* Copy Link */}
          <button
            onClick={handleCopyKioskLink}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-slate-700 shadow-sm"
            title="Salin Link Kiosk Siswa"
          >
            {isCopiedLink ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
            <span className="hidden md:inline">{isCopiedLink ? 'Tersalin!' : 'Salin Link'}</span>
          </button>

          {/* Switch to Register */}
          {onSwitchToRegister && (
            <button
              onClick={onSwitchToRegister}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">Daftar Wajah</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Kiosk Stage Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 relative">
        {/* Title and Instruction */}
        <div className="text-center mb-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/90 border border-slate-700 text-slate-300 text-xs font-semibold mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Kamera Biometrik AI & Face Mesh Aktif</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">
            Posisikan Wajah Menghadap Kamera
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Sistem otomatis mengenali wajah siswa, mencatat kehadiran, dan memberikan sapaan suara ramah.
          </p>
        </div>

        {/* Video Frame & HUD Layer */}
        <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-black w-full max-w-3xl border-4 border-slate-800 aspect-video flex items-center justify-center">
          {!isModelsLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-30 text-slate-400 gap-3">
              <RefreshCw className="w-10 h-10 animate-spin text-indigo-400" />
              <p className="font-bold text-white text-sm">{modelsLoadingProgress}</p>
            </div>
          )}

          {/* @ts-ignore */}
          <Webcam
            key={cameraKey}
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            mirrored={true}
            videoConstraints={{
              facingMode: 'user',
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }}
            className="w-full h-full object-cover"
          />

          <canvas
            ref={canvasOverlayRef}
            className="absolute inset-0 w-full h-full pointer-events-none z-10"
          />

          {/* Circular Hold Progress Indicator */}
          {holdProgress > 0 && holdProgress < 100 && (
            <div className="absolute top-6 right-6 z-20 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-emerald-500/40 text-white shadow-xl animate-in zoom-in-90">
              <div className="relative w-8 h-8 flex items-center justify-center">
                <svg className="w-8 h-8 -rotate-90">
                  <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="3" className="text-slate-700" fill="transparent" />
                  <circle
                    cx="16" cy="16" r="13"
                    stroke="currentColor" strokeWidth="3"
                    className="text-emerald-400 transition-all duration-75"
                    strokeDasharray={81.68}
                    strokeDashoffset={81.68 - (81.68 * holdProgress) / 100}
                    fill="transparent"
                  />
                </svg>
                <span className="absolute text-[10px] font-bold font-mono text-emerald-300">{holdRemainingSeconds}s</span>
              </div>
              <div className="text-left">
                <p className="text-[11px] font-bold text-emerald-300">Tahan Posisi Wajah</p>
                <p className="text-[10px] text-slate-400">Verifikasi Presensi...</p>
              </div>
            </div>
          )}

          {/* Dynamic Live Detection Pill */}
          {liveMatchInfo && (
            <div className="absolute bottom-6 inset-x-0 flex justify-center pointer-events-none px-4 z-20 animate-in fade-in duration-150">
              <div className={`px-4 py-2 rounded-full backdrop-blur-md border text-xs font-semibold shadow-2xl flex items-center gap-2.5 transition-all duration-150 ${
                liveMatchInfo.isMatch 
                  ? (liveMatchInfo.alreadyAttended ? 'bg-amber-900/90 border-amber-500/60 text-amber-200' : 'bg-slate-900/95 border-emerald-500/60 text-emerald-300') 
                  : 'bg-slate-900/95 border-amber-500/50 text-amber-300'
              }`}>
                <span className={`w-2.5 h-2.5 rounded-full ${liveMatchInfo.isMatch ? (liveMatchInfo.alreadyAttended ? 'bg-amber-400' : 'bg-emerald-400 animate-ping') : 'bg-amber-400 animate-pulse'} shrink-0`} />
                <span className="font-bold text-white text-sm">
                  {liveMatchInfo.alreadyAttended ? '✓ Sudah Absen: ' : ''}{liveMatchInfo.name}
                </span>
                {liveMatchInfo.kelompok && (
                  <span className="text-slate-400 text-xs">({liveMatchInfo.kelompok})</span>
                )}
                <span className="text-slate-600">•</span>
                <span className={`font-mono font-bold ${liveMatchInfo.isMatch ? (liveMatchInfo.alreadyAttended ? 'text-amber-400' : 'text-emerald-400') : 'text-amber-400'}`}>
                  {liveMatchInfo.percent}% {liveMatchInfo.isMatch ? 'Cocok' : 'Deteksi'}
                </span>
              </div>
            </div>
          )}

          {/* SUCCESS MODAL / POPUP CARD WITH GEMINI GREETING */}
          {activeSuccess && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-40 flex items-center justify-center p-4 animate-in zoom-in-95 duration-200">
              <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-emerald-500/40 p-6 sm:p-8 rounded-3xl shadow-2xl text-center max-w-md w-full relative overflow-hidden">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4 shadow-inner">
                  <UserCheck className="w-9 h-9" />
                </div>

                <span className="inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-2">
                  {activeSuccess.type === 'in' ? 'Absen Datang Berhasil' : 'Absen Pulang Berhasil'}
                </span>

                <h3 className="text-xl sm:text-2xl font-black text-white">
                  {activeSuccess.student.nama_lengkap}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {activeSuccess.student.kelompok || 'Siswa'} • Pukul {activeSuccess.time} WIB
                </p>

                {/* Gemini AI Voice Greeting Box */}
                {activeSuccess.greeting && (
                  <div className="mt-4 p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl text-xs text-emerald-200 text-left flex items-start gap-2.5">
                    <Bot className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-[10px] text-emerald-400 uppercase tracking-wider block">Sapaan Suara AI:</span>
                      <p className="italic leading-relaxed mt-0.5 font-medium">"{activeSuccess.greeting}"</p>
                    </div>
                  </div>
                )}

                <div className="mt-5 flex items-center justify-center gap-2">
                  <button
                    onClick={() => speakText(activeSuccess.greeting || `Selamat datang ${activeSuccess.student.nama_lengkap}`)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>Ulangi Suara</span>
                  </button>
                  <button
                    onClick={() => setActiveSuccess(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
                  >
                    Selesai
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Already Attended Notice */}
          {scanStatus.state === 'already_attended' && !activeSuccess && (
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-30 flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-slate-900 border border-amber-500/40 p-6 rounded-3xl shadow-2xl text-center max-w-sm w-full">
                <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-2" />
                <h4 className="text-lg font-bold text-white">Sudah Tercatat</h4>
                <p className="text-xs text-slate-300 mt-1">{scanStatus.message}</p>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Metric Badges */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span>Terdaftar Biometrik: <strong className="text-white">{students.filter(s => !!s.descriptorArray).length}</strong> / {students.length} Siswa</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Absen Hari Ini: <strong className="text-white">{todayLogs.length}</strong> Siswa</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Verifikasi Gemini 2.5 Flash Aktif</span>
          </div>
        </div>
      </div>
    </div>
  );
}
