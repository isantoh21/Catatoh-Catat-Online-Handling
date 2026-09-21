import React, { useState, useEffect, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from '@vladmandic/face-api';
import { supabase } from '../../lib/supabaseClient';
import { verifyAttendanceWithGemini, registerFaceWithGemini, checkGeminiHealth, generateGeminiGreeting } from '../../lib/geminiVision';
import { googleFaceMeshService, drawGoogleFaceMesh } from '../../lib/googleFaceMesh';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Clock,
  UserPlus,
  RefreshCw,
  Users,
  X,
  ShieldCheck,
  ShieldAlert,
  Building2,
  ScanFace,
  RotateCcw,
  Sparkles,
  Search,
  Trash2,
  Lock,
  UserCheck,
  AlertTriangle,
  Bot,
  Cpu,
  Zap
} from 'lucide-react';

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

interface TeacherKioskViewProps {
  targetUserId?: string;
  schoolSettings: { name: string; logo: string } | null;
  attendanceSettings: any;
  initialMode?: 'manage' | 'scan';
}

// --- Biometric & Liveness Verification via 68 Landmarks ---
interface LivenessResult {
  valid: boolean;
  reason?: string;
}

function checkStrictLiveness(
  detection: any,
  videoWidth: number,
  videoHeight: number
): LivenessResult {
  if (!detection || !detection.detection || !detection.landmarks) {
    return { valid: false, reason: 'Arahkan wajah ke kamera' };
  }

  const box = detection.detection.box;
  const score = detection.detection.score;

  // Relaxed minimum confidence score for reliable detection in varying lighting
  if (score < 0.12) {
    return { valid: false, reason: 'Posisikan wajah lebih jelas' };
  }

  // Relaxed face scale & distance check
  if (box.width < 25 || box.height < 25) {
    return { valid: false, reason: 'Posisikan wajah menghadap kamera' };
  }

  return { valid: true };
}

interface TeacherRecord {
  id: string;
  name: string;
  nip?: string;
  username?: string;
  pin?: string;
  profile_picture?: string;
  face_descriptor?: string;
  user_id?: string;
  descriptorArray?: Float32Array;
}

interface AttendanceLogItem {
  id: string;
  teacher_id: string;
  type: 'in' | 'out';
  created_at: string;
  photo?: string;
  teacher?: {
    name: string;
    profile_picture?: string;
  };
}

export default function TeacherKioskView({
  targetUserId,
  schoolSettings,
  attendanceSettings,
  initialMode
}: TeacherKioskViewProps) {
  // --- Webcam & Canvas Refs ---
  const webcamRef = useRef<Webcam>(null);
  const canvasOverlayRef = useRef<HTMLCanvasElement>(null);

  // --- Kiosk Mode: Murni Absensi (default) vs Kelola Wajah (Pendaftaran & Reset) ---
  const [isManageMode, setIsManageMode] = useState<boolean>(initialMode === 'manage');

  // --- Clock State ---
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // --- Face API Loading States ---
  const [isModelsLoaded, setIsModelsLoaded] = useState<boolean>(false);
  const [modelsLoadingProgress, setModelsLoadingProgress] = useState<string>('Memulai AI Recognition...');

  // --- Teachers & Attendance Data ---
  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const teachersRef = useRef<TeacherRecord[]>([]);
  teachersRef.current = teachers;

  const [todayLogs, setTodayLogs] = useState<AttendanceLogItem[]>([]);
  const todayLogsRef = useRef<AttendanceLogItem[]>([]);
  todayLogsRef.current = todayLogs;
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);

  // --- Attendance Session Control (Auto, Masuk, Pulang) ---
  const [sessionMode, setSessionMode] = useState<'auto' | 'in' | 'out'>('auto');
  const sessionModeRef = useRef<'auto' | 'in' | 'out'>('auto');
  sessionModeRef.current = sessionMode;

  // Throttle speech for "Anda Sudah Absen Tolong Gantian Dengan Guru Yang lain"
  const lastSpokenAlreadyAttendedRef = useRef<{ [teacherId: string]: number }>({});

  // 2-second timer and auto-clear for teachers who already attended or in cooldown
  const alreadyAttendedNoticeRef = useRef<{
    teacherId: string;
    firstShownTime: number;
    dismissed: boolean;
  }>({ teacherId: '', firstShownTime: 0, dismissed: false });

  const cooldownNoticeRef = useRef<{
    teacherId: string;
    firstShownTime: number;
    dismissed: boolean;
  }>({ teacherId: '', firstShownTime: 0, dismissed: false });

  const lastFaceSeenTimeRef = useRef<number>(0);

  // --- Right Panel Tabs (in Manage Mode: 'logs' or 'teachers') ---
  const [rightPanelTab, setRightPanelTab] = useState<'logs' | 'teachers'>('logs');
  const [teacherSearchQuery, setTeacherSearchQuery] = useState<string>('');

  // --- Scanning & Status Engine ---
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [scanStatus, setScanStatus] = useState<{
    state: 'idle' | 'detecting' | 'holding' | 'matched' | 'cooldown' | 'unrecognized' | 'liveness_failed' | 'already_attended';
    message: string;
    teacherName?: string;
  }>({
    state: 'idle',
    message: isManageMode ? 'Mode Registrasi: Arahkan wajah guru ke kamera' : 'Arahkan wajah ke kamera'
  });

  // --- Dynamic Percentage ---
  const [scanPercent, setScanPercent] = useState<number>(0);
  const [isFaceDetected, setIsFaceDetected] = useState<boolean>(false);
  const isFaceDetectedRef = useRef<boolean>(false);

  // --- Hold for 3 Seconds State & Refs ---
  const [holdProgress, setHoldProgress] = useState<number>(0);
  const [holdRemainingSeconds, setHoldRemainingSeconds] = useState<number>(3.0);
  const [holdTeacherName, setHoldTeacherName] = useState<string>('');

  const holdProgressRef = useRef<number>(0);
  const holdStartTimeRef = useRef<number>(0);
  const holdingTeacherIdRef = useRef<string | null>(null);

  // Keep track of recent attendance to prevent double check-ins
  const lastProcessedTimeRef = useRef<{ [teacherId: string]: number }>({});
  const isSavingAttendanceRef = useRef<boolean>(false);
  const isLoopRunningRef = useRef<boolean>(false);

  // --- Recognition Audio & Feedback ---
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true);
  const [activeSuccess, setActiveSuccess] = useState<{
    teacherName: string;
    type: 'in' | 'out';
    time: string;
    photo?: string;
    aiGreeting?: string;
  } | null>(null);

  // --- Google Gemini 2.5 Flash Multimodal Vision Engine States ---
  const [geminiActive, setGeminiActive] = useState<boolean>(true);
  const [isGeminiAnalyzing, setIsGeminiAnalyzing] = useState<boolean>(false);
  const [lastAiVerification, setLastAiVerification] = useState<{
    teacherName: string;
    confidence: number;
    greeting?: string;
    livenessReason?: string;
  } | null>(null);

  const isGeminiVerifyingRef = useRef<boolean>(false);
  const lastGeminiCallTimeRef = useRef<number>(0);

  // Check Gemini Vision & Google Face Mesh health status
  useEffect(() => {
    checkGeminiHealth().then(res => {
      if (res.status === 'ok') {
        setGeminiActive(true);
      }
    }).catch(() => {});

    // Warm up Google MediaPipe Face Mesh
    googleFaceMeshService.initialize().catch(() => {});
  }, []);

  // Fullscreen State
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // --- Camera & Sensor Reset Control ---
  const [cameraKey, setCameraKey] = useState<number>(0);
  const [isResettingCamera, setIsResettingCamera] = useState<boolean>(false);
  const [resetToastMessage, setResetToastMessage] = useState<string>('');

  const handleResetCamera = useCallback(() => {
    setIsResettingCamera(true);
    setResetToastMessage('Sensor & kamera di-reset...');
    
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }

    // 1. Reset all scanning loop state & tracking refs
    holdStartTimeRef.current = 0;
    holdingTeacherIdRef.current = null;
    holdProgressRef.current = 0;
    isSavingAttendanceRef.current = false;
    isFaceDetectedRef.current = false;
    alreadyAttendedNoticeRef.current = { teacherId: '', firstShownTime: 0, dismissed: false };
    cooldownNoticeRef.current = { teacherId: '', firstShownTime: 0, dismissed: false };
    lastFaceSeenTimeRef.current = 0;
    lastSpokenAlreadyAttendedRef.current = {};
    lastProcessedTimeRef.current = {};

    // 2. Clear canvas overlay immediately
    const canvas = canvasOverlayRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    // 3. Reset React UI states
    setHoldProgress(0);
    setHoldRemainingSeconds(1.5);
    setHoldTeacherName('');
    setScanPercent(0);
    setIsFaceDetected(false);
    setActiveSuccess(null);
    setScanStatus({
      state: 'idle',
      message: isManageMode ? 'Mode Registrasi: Arahkan wajah guru ke kamera' : 'Arahkan wajah ke kamera'
    });

    // 4. Force remount webcam stream to clear any hardware buffer/lock
    setCameraKey(prev => prev + 1);

    setTimeout(() => {
      setIsResettingCamera(false);
      setResetToastMessage('');
    }, 1500);
  }, [isManageMode]);

  // --- Modal State (Registration Direct from Kiosk) ---
  const [showManageModal, setShowManageModal] = useState<boolean>(false);
  const [manageTab, setManageTab] = useState<'new' | 'update' | 'reset'>('new');
  
  // Form fields for "new" teacher
  const [newTeacherName, setNewTeacherName] = useState<string>('');
  const [newTeacherNip, setNewTeacherNip] = useState<string>('');
  
  // Selection for "update" or "reset"
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  
  const [manageError, setManageError] = useState<string>('');
  const [manageSuccess, setManageSuccess] = useState<string>('');
  const [isProcessingManage, setIsProcessingManage] = useState<boolean>(false);

  // Active Teacher Biometric Registration Workflow (Keep teacher context and scan on main kiosk view)
  const [activeRegistrationTeacher, setActiveRegistrationTeacher] = useState<{
    id: string;
    name: string;
    nip?: string;
    isNew?: boolean;
  } | null>(null);
  const activeRegistrationTeacherRef = useRef<{
    id: string;
    name: string;
    nip?: string;
    isNew?: boolean;
  } | null>(null);

  useEffect(() => {
    activeRegistrationTeacherRef.current = activeRegistrationTeacher;
  }, [activeRegistrationTeacher]);

  const [isScanningActiveFace, setIsScanningActiveFace] = useState<boolean>(false);
  const [registrationFaceStatus, setRegistrationFaceStatus] = useState<{
    type: 'idle' | 'success' | 'error';
    message: string;
  } | null>(null);

  // User ID Resolution (Ensures strict multi-tenant isolation per school)
  const [resolvedUserId, setResolvedUserId] = useState<string>(targetUserId || '');

  useEffect(() => {
    if (targetUserId) {
      setResolvedUserId(targetUserId);
      try {
        localStorage.setItem('cached_kiosk_user_id', targetUserId);
      } catch (e) {}
    } else {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user?.id) {
          setResolvedUserId(data.session.user.id);
        } else {
          try {
            const cached = localStorage.getItem('cached_kiosk_user_id');
            if (cached) setResolvedUserId(cached);
          } catch (e) {}
        }
      });
    }
  }, [targetUserId]);

  const effectiveUserId = targetUserId || resolvedUserId;

  // Confirmation Modals State
  const [kioskResetTarget, setKioskResetTarget] = useState<{ id: string; name: string } | null>(null);
  const [kioskDeleteTarget, setKioskDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingTeacher, setIsDeletingTeacher] = useState<boolean>(false);

  // Digital clock interval
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- Robust Web Speech & Audio Synthesis Engine ---
  const activeUtterancesRef = useRef<SpeechSynthesisUtterance[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Initialize or resume shared AudioContext on user interaction
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
      console.warn('AudioContext initialization error:', e);
      return null;
    }
  }, []);

  // Unlock Audio & Speech on any user gesture
  useEffect(() => {
    const handleUnlock = () => {
      getAudioContext();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
        } catch (e) {}
      }
    };

    window.addEventListener('click', handleUnlock);
    window.addEventListener('touchstart', handleUnlock);
    window.addEventListener('keydown', handleUnlock);

    // Keep-alive heartbeat for Chromium SpeechSynthesis (prevents synthesis engine from freezing)
    const keepAliveInterval = setInterval(() => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
        } catch (e) {}
      }
    }, 10000);

    return () => {
      window.removeEventListener('click', handleUnlock);
      window.removeEventListener('touchstart', handleUnlock);
      window.removeEventListener('keydown', handleUnlock);
      clearInterval(keepAliveInterval);
    };
  }, [getAudioContext]);

  // Pre-load and cache voices
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const updateVoices = () => {
        try {
          const v = window.speechSynthesis.getVoices();
          if (v && v.length > 0) {
            setAvailableVoices(v);
          }
        } catch (e) {}
      };

      updateVoices();
      window.speechSynthesis.addEventListener('voiceschanged', updateVoices);
      return () => {
        window.speechSynthesis.removeEventListener('voiceschanged', updateVoices);
      };
    }
  }, []);

  // Beep sound feedback via Web Audio API
  const playBeep = useCallback((success: boolean = true) => {
    if (!isAudioEnabled) return;
    try {
      const audioCtx = getAudioContext();
      if (!audioCtx) return;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      const now = audioCtx.currentTime;
      if (success) {
        // High-definition pleasant double chime (C6 -> G6)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1046.50, now); // C6
        osc.frequency.setValueAtTime(1567.98, now + 0.09); // G6
        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else {
        // Error buzzer
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.setValueAtTime(146.83, now + 0.12);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      }
    } catch (e) {
      console.warn('Audio synthesis warning:', e);
    }
  }, [isAudioEnabled, getAudioContext]);

  // High-reliability Speech Announcement (Robot / AI voice)
  const speakText = useCallback((text: string) => {
    if (!isAudioEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    
    try {
      // Resume if paused
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      // Cancel current speech if any
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
      }

      // Create new utterance
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      utterance.rate = 0.95; // Clear and polite natural Indonesian pacing
      utterance.pitch = 1.05; // Friendly and enthusiastic greeting tone
      utterance.volume = 1.0;

      // Select best Indonesian voice if available
      const voices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const idVoice = voices.find(v => 
          v.lang.toLowerCase() === 'id-id' || 
          v.lang.toLowerCase() === 'id_id' || 
          v.lang.toLowerCase().startsWith('id') ||
          v.name.toLowerCase().includes('indonesia') ||
          v.name.toLowerCase().includes('indonesian') ||
          v.name.toLowerCase().includes('gadis') ||
          v.name.toLowerCase().includes('damayanti')
        ) || voices.find(v => v.lang.toLowerCase().includes('id'));
        if (idVoice) {
          utterance.voice = idVoice;
        }
      }

      // Prevent Chromium garbage collection bug by storing reference until speech completes
      activeUtterancesRef.current.push(utterance);
      utterance.onend = () => {
        activeUtterancesRef.current = activeUtterancesRef.current.filter(u => u !== utterance);
      };
      utterance.onerror = (e) => {
        console.warn('Speech synthesis utterance error:', e);
        activeUtterancesRef.current = activeUtterancesRef.current.filter(u => u !== utterance);
      };

      // Slight timeout ensures previous cancelled queue in Chromium finishes clearing
      setTimeout(() => {
        try {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
          window.speechSynthesis.speak(utterance);
        } catch (speakErr) {
          console.warn('SpeechSynthesis.speak failed:', speakErr);
        }
      }, 50);

    } catch (e) {
      console.warn('Speech synthesis outer error:', e);
    }
  }, [isAudioEnabled, availableVoices]);

  // --- Auto-Purge Attendance Logs older than 7 days (Super Minimal Storage) ---
  const purgeOldAttendanceLogs = useCallback(async () => {
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      let query = supabase
        .from('attendance_logs')
        .delete()
        .lt('created_at', oneWeekAgo.toISOString());
        
      if (effectiveUserId) {
        query = query.eq('user_id', effectiveUserId);
      }
      
      await query;
    } catch (err) {
      console.warn('Auto purge old attendance logs warning:', err);
    }
  }, [effectiveUserId]);

  // --- Load Face-API Models ---
  useEffect(() => {
    let isMounted = true;
    const loadAiModels = async () => {
      try {
        setModelsLoadingProgress('Mengunduh model biometrik wajah...');
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        if (isMounted) {
          setIsModelsLoaded(true);
          setModelsLoadingProgress('');
        }
      } catch (err: any) {
        console.error('Gagal memuat face-api models:', err);
        if (isMounted) {
          setModelsLoadingProgress('Gagal memuat model biometrik. Periksa koneksi internet.');
        }
      }
    };
    loadAiModels();
    return () => {
      isMounted = false;
    };
  }, []);

  // --- Fetch Teachers and Today's Attendance Logs ---
  const fetchData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      // 1. Run auto-purge for logs older than 7 days to keep database super lightweight
      await purgeOldAttendanceLogs();

      if (!effectiveUserId) {
        // Prevent showing any teacher data if school ID cannot be resolved
        setTeachers([]);
        setIsLoadingData(false);
        return;
      }

      // 2. Fetch teachers strictly belonging to this school's user_id
      const teacherQuery = supabase
        .from('teachers')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('name');

      const { data: teachersData, error: teachersError } = await teacherQuery;
      if (teachersError) throw teachersError;

      const parsedTeachers: TeacherRecord[] = (teachersData || []).map((t: any) => {
        let descriptorArray: Float32Array | undefined = undefined;
        if (t.face_descriptor) {
          try {
            const raw = typeof t.face_descriptor === 'string' ? JSON.parse(t.face_descriptor) : t.face_descriptor;
            if (Array.isArray(raw) && raw.length > 0) {
              descriptorArray = new Float32Array(raw);
            }
          } catch (e) {
            console.warn(`Error parsing descriptor for ${t.name}:`, e);
          }
        }
        return {
          ...t,
          descriptorArray
        };
      });

      setTeachers(parsedTeachers);

      // 3. Fetch today's logs
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      let logsDataToUse: any[] = [];
      const teacherIds = parsedTeachers.map(t => t.id);

      if (teacherIds.length > 0) {
        // Query by teacher_id strictly isolated to current school tenant
        let logQuery = supabase
          .from('attendance_logs')
          .select('id, teacher_id, type, created_at')
          .in('teacher_id', teacherIds)
          .gte('created_at', startOfDay.toISOString())
          .lte('created_at', endOfDay.toISOString())
          .order('created_at', { ascending: false });

        if (effectiveUserId) {
          logQuery = logQuery.eq('user_id', effectiveUserId);
        }

        const { data: logsData, error: logsError } = await logQuery;
        if (!logsError && logsData && logsData.length > 0) {
          logsDataToUse = logsData;
        } else {
          // Fallback: query with in('teacher_id', teacherIds) without user_id filter
          let fallbackQ = supabase
            .from('attendance_logs')
            .select('id, teacher_id, type, created_at')
            .in('teacher_id', teacherIds)
            .gte('created_at', startOfDay.toISOString())
            .lte('created_at', endOfDay.toISOString())
            .order('created_at', { ascending: false });

          const fbRes = await fallbackQ;
          if (fbRes.data) {
            logsDataToUse = fbRes.data;
          }
        }
      }

      const teacherMap = new Map(parsedTeachers.map(t => [t.id, t]));
      const formattedLogs: AttendanceLogItem[] = logsDataToUse.map((l: any) => {
        const t = teacherMap.get(l.teacher_id);
        return {
          id: l.id,
          teacher_id: l.teacher_id,
          type: l.type,
          created_at: l.created_at,
          photo: t?.profile_picture,
          teacher: t ? { name: t.name, profile_picture: t.profile_picture } : undefined
        };
      });

      setTodayLogs(formattedLogs);
    } catch (err) {
      console.error('Error fetching kiosk data:', err);
    } finally {
      setIsLoadingData(false);
    }
  }, [effectiveUserId, purgeOldAttendanceLogs]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 45000); // refresh every 45s
    return () => clearInterval(interval);
  }, [fetchData]);

  // Helper to capture an ultra-compressed thumbnail snapshot (~2-3 KB) to minimize storage
  const captureCompressedSnapshot = useCallback((): string | undefined => {
    if (!webcamRef.current || !webcamRef.current.video) return undefined;
    try {
      const video = webcamRef.current.video;
      if (!video.videoWidth || !video.videoHeight) {
        return webcamRef.current.getScreenshot() || undefined;
      }
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 120;
      thumbCanvas.height = 90;
      const ctx = thumbCanvas.getContext('2d');
      if (!ctx) return undefined;

      // Flip horizontally to match mirrored camera preview
      ctx.translate(120, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, 120, 90);

      return thumbCanvas.toDataURL('image/jpeg', 0.35);
    } catch (e) {
      return undefined;
    }
  }, []);

  // --- Active Session Resolution (Masuk vs Pulang) ---
  // --- Active Session Resolution (Masuk vs Pulang) ---
  const getActiveTargetType = useCallback((teacherId?: string): 'in' | 'out' => {
    if (sessionModeRef.current === 'in') return 'in';
    if (sessionModeRef.current === 'out') return 'out';

    // Auto mode: check individual teacher attendance status if teacherId is provided
    if (teacherId) {
      const currentLogs = todayLogsRef.current || [];
      const hasIn = currentLogs.some(l => l.teacher_id === teacherId && l.type === 'in');
      const hasOut = currentLogs.some(l => l.teacher_id === teacherId && l.type === 'out');
      if (!hasIn) return 'in';
      if (!hasOut) return 'out';
      return 'out';
    }

    // Generic fallback based on departure start or 12:00
    const depStart = attendanceSettings?.departure_start; // e.g. "15:00:00" or "15:20:00"
    if (depStart) {
      const nowD = new Date();
      const curH = String(nowD.getHours()).padStart(2, '0');
      const curM = String(nowD.getMinutes()).padStart(2, '0');
      const curS = String(nowD.getSeconds()).padStart(2, '0');
      const curTimeStr = `${curH}:${curM}:${curS}`;
      return curTimeStr >= depStart ? 'out' : 'in';
    }

    // Default fallback: before 12:00 = 'in', 12:00 onwards = 'out'
    return new Date().getHours() >= 12 ? 'out' : 'in';
  }, [attendanceSettings]);

  // --- Attendance Record Handler ---
  const handleProcessAttendance = useCallback(
    async (
      teacher: TeacherRecord,
      snapshotPhoto?: string,
      forcedType?: 'in' | 'out',
      customAiGreeting?: string
    ) => {
      if (isSavingAttendanceRef.current) return;
      isSavingAttendanceRef.current = true;

      // Determine attendance type (Masuk vs Pulang) accurately
      const attendType: 'in' | 'out' = forcedType || getActiveTargetType(teacher.id);

      // 1. Strict Departure Time Validation (Check-Out Only in Auto mode)
      if (attendType === 'out' && attendanceSettings && sessionModeRef.current === 'auto') {
        const depStart = attendanceSettings.departure_start;
        const depEnd = attendanceSettings.departure_end;
        if (depStart && depEnd) {
          const nowD = new Date();
          const curH = String(nowD.getHours()).padStart(2, '0');
          const curM = String(nowD.getMinutes()).padStart(2, '0');
          const curTimeStr = `${curH}:${curM}`;
          
          const startStr = depStart.substring(0, 5);
          const endStr = depEnd.substring(0, 5);

          if (curTimeStr < startStr || curTimeStr > endStr) {
            console.warn('Prevented early/late clock out attempt:', teacher.name);
            playBeep(false);
            speakText('Belum masuk waktu absen pulang.');
            setScanStatus({
              state: 'error',
              message: `${teacher.name}: Waktu absen pulang adalah ${startStr} - ${endStr}. Saat ini jam ${curTimeStr}.`,
              teacherName: teacher.name
            });
            setTimeout(() => {
              setScanStatus(prev => (prev.state === 'error' ? { state: 'idle', message: 'Arahkan wajah ke kamera' } : prev));
            }, 3000);
            isSavingAttendanceRef.current = false;
            return;
          }
        }
      }

      // 2. Strict Anti-Duplicate Memory Check (Instant rejection)
      const currentLogs = todayLogsRef.current || [];
      const teacherLogsToday = currentLogs.filter(l => l.teacher_id === teacher.id);
      const hasCheckedIn = teacherLogsToday.some(l => l.type === 'in');
      const hasCheckedOut = teacherLogsToday.some(l => l.type === 'out');

      if (hasCheckedIn && hasCheckedOut) {
        console.warn('Teacher already completed both attendance today:', teacher.name);
        playBeep(false);
        setScanStatus({
          state: 'already_attended',
          message: `${teacher.name}: Anda sudah selesai absen masuk & pulang hari ini. Tolong gantian dengan guru yang lain.`,
          teacherName: teacher.name
        });
        setTimeout(() => {
          setScanStatus(prev => (prev.state === 'already_attended' ? { state: 'idle', message: 'Arahkan wajah ke kamera' } : prev));
        }, 2500);
        isSavingAttendanceRef.current = false;
        return;
      }

      if (attendType === 'in' && hasCheckedIn) {
        console.warn('Prevented duplicate in attendance attempt for teacher:', teacher.name);
        playBeep(false);
        setScanStatus({
          state: 'already_attended',
          message: `${teacher.name}: Anda sudah absen masuk hari ini. Tolong gantian dengan guru yang lain.`,
          teacherName: teacher.name
        });
        setTimeout(() => {
          setScanStatus(prev => (prev.state === 'already_attended' ? { state: 'idle', message: 'Arahkan wajah ke kamera' } : prev));
        }, 2500);
        isSavingAttendanceRef.current = false;
        return;
      }

      if (attendType === 'out' && hasCheckedOut) {
        console.warn('Prevented duplicate out attendance attempt for teacher:', teacher.name);
        playBeep(false);
        setScanStatus({
          state: 'already_attended',
          message: `${teacher.name}: Anda sudah absen pulang hari ini. Tolong gantian dengan guru yang lain.`,
          teacherName: teacher.name
        });
        setTimeout(() => {
          setScanStatus(prev => (prev.state === 'already_attended' ? { state: 'idle', message: 'Arahkan wajah ke kamera' } : prev));
        }, 2500);
        isSavingAttendanceRef.current = false;
        return;
      }

      try {
        // Direct Supabase double-check for today's logs (Prevents any race condition)
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        let duplicateCheckQ = supabase
          .from('attendance_logs')
          .select('id, type')
          .eq('teacher_id', teacher.id)
          .eq('type', attendType)
          .gte('created_at', startOfDay.toISOString())
          .lte('created_at', endOfDay.toISOString());

        const resolvedTeacherUserId = effectiveUserId || teacher.user_id || teachersRef.current[0]?.user_id;
        if (resolvedTeacherUserId) {
          duplicateCheckQ = duplicateCheckQ.eq('user_id', resolvedTeacherUserId);
        }

        const { data: dbExistingLogs } = await duplicateCheckQ;

        if (dbExistingLogs && dbExistingLogs.length > 0) {
          console.warn('Supabase duplicate check caught duplicate:', teacher.name, attendType);
          playBeep(false);
          setScanStatus({
            state: 'already_attended',
            message: `${teacher.name}: Anda sudah absen ${attendType === 'in' ? 'masuk' : 'pulang'} hari ini. Tolong gantian dengan guru yang lain.`,
            teacherName: teacher.name
          });
          setTimeout(() => {
            setScanStatus(prev => (prev.state === 'already_attended' ? { state: 'idle', message: 'Arahkan wajah ke kamera' } : prev));
          }, 2500);
          isSavingAttendanceRef.current = false;
          return;
        }

        // Build payload strictly with columns present in Supabase attendance_logs
        const payload: any = {
          teacher_id: teacher.id,
          type: attendType,
          created_at: new Date().toISOString()
        };

        if (resolvedTeacherUserId) {
          payload.user_id = resolvedTeacherUserId;
        }

        let insertedData: any = null;

        // Execute save to Supabase
        const { data: inserted, error: insertError } = await supabase
          .from('attendance_logs')
          .insert([payload])
          .select('id, teacher_id, type, created_at, user_id')
          .single();

        if (insertError) {
          console.warn('Initial insert with select failed, trying plain insert:', insertError);
          // Try plain insert with user_id
          const plainRes = await supabase.from('attendance_logs').insert([payload]);
          if (plainRes.error) {
            console.warn('Plain insert with user_id failed, trying fallback without user_id:', plainRes.error);
            const retryPayload = {
              teacher_id: teacher.id,
              type: attendType,
              created_at: payload.created_at
            };
            const fallbackRes = await supabase.from('attendance_logs').insert([retryPayload]);
            if (fallbackRes.error) {
              console.error('All insert attempts failed:', fallbackRes.error);
              throw fallbackRes.error;
            }
          }

          insertedData = {
            id: crypto.randomUUID(),
            teacher_id: teacher.id,
            type: attendType,
            created_at: payload.created_at,
            user_id: resolvedTeacherUserId
          };
        } else {
          insertedData = inserted;
        }

        // Attendance successfully recorded in DB: apply cooldown
        lastProcessedTimeRef.current[teacher.id] = Date.now();

        // Attach teacher relation object and real-time photo for immediate UI display
        const finalLogItem: AttendanceLogItem = {
          id: insertedData?.id || crypto.randomUUID(),
          teacher_id: teacher.id,
          type: attendType,
          created_at: insertedData?.created_at || payload.created_at,
          photo: snapshotPhoto || teacher.profile_picture,
          teacher: {
            name: teacher.name,
            profile_picture: teacher.profile_picture
          }
        };

        // Update BOTH ref and state immediately so duplicate check and presence count update instantaneously!
        todayLogsRef.current = [finalLogItem, ...todayLogsRef.current.filter(x => x.id !== finalLogItem.id)];
        setTodayLogs(prev => [finalLogItem, ...prev.filter(x => x.id !== finalLogItem.id)]);

        // Feedback sound and speech (Gemini Text-to-Speech Announcement)
        playBeep(true);
        const timeFormatted = format(new Date(), 'HH:mm');
        const hourNow = new Date().getHours();
        const timeGreeting = hourNow < 11 ? 'pagi' : hourNow < 15 ? 'siang' : 'sore';

        const isDatang = attendType === 'in';
        let initialSpeech = customAiGreeting;

        if (!initialSpeech) {
          initialSpeech = isDatang
            ? `Selamat ${timeGreeting} Bapak atau Ibu ${teacher.name}. Absensi datang Anda berhasil dicatat pukul ${timeFormatted}. Selamat bertugas dan semangat mendidik!`
            : `Terima kasih Bapak atau Ibu ${teacher.name}. Absensi pulang Anda berhasil dicatat pukul ${timeFormatted}. Selamat beristirahat dan hati-hati di perjalanan pulang!`;
        }

        // Trigger Indonesian Text to Speech immediately
        speakText(initialSpeech);

        // Show prominent celebratory toast
        setActiveSuccess({
          teacherName: teacher.name,
          type: attendType,
          time: timeFormatted,
          photo: snapshotPhoto || teacher.profile_picture,
          aiGreeting: initialSpeech
        });

        // Request Gemini to generate dynamic celebratory greeting if not already provided
        if (!customAiGreeting) {
          generateGeminiGreeting({
            name: teacher.name,
            attendanceType: attendType,
            time: timeFormatted,
            schoolName: schoolSettings?.name
          }).then((geminiText) => {
            if (geminiText) {
              setActiveSuccess(prev => (prev && prev.teacherName === teacher.name ? { ...prev, aiGreeting: geminiText } : prev));
            }
          }).catch(() => {});
        }

        setScanStatus({
          state: 'matched',
          message: `Absensi ${attendType === 'in' ? 'Masuk' : 'Pulang'} Berhasil: ${teacher.name} (${timeFormatted})`,
          teacherName: teacher.name
        });

        setTimeout(() => {
          setActiveSuccess(null);
        }, 4000);

      } catch (err: any) {
        console.error('Error saving attendance log:', err);
        lastProcessedTimeRef.current[teacher.id] = 0;
        playBeep(false);
        setScanStatus({
          state: 'unrecognized',
          message: `Gagal mencatat absensi: ${err.message || 'Kesalahan database'}. Silakan coba lagi.`
        });
      } finally {
        isSavingAttendanceRef.current = false;
      }
    },
    [targetUserId, effectiveUserId, attendanceSettings, schoolSettings, playBeep, speakText, getActiveTargetType]
  );

  // --- Render Google Face Mesh & Biometric Tracking Overlay onto Canvas ---
  const renderTrackingBox = useCallback((
    box?: faceapi.Box,
    labelText?: string,
    boxColor: string = '#10b981',
    meshLandmarks?: any
  ) => {
    const canvas = canvasOverlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const video = webcamRef.current?.video;
    if (!video || !video.videoWidth || !video.videoHeight) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    if (canvas.width !== displaySize.width || canvas.height !== displaySize.height) {
      canvas.width = displaySize.width;
      canvas.height = displaySize.height;
      faceapi.matchDimensions(canvas, displaySize);
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!box && !meshLandmarks) {
      return;
    }

    // 1. Draw Google MediaPipe Face Mesh (468+ Points & Iris Contours)
    if (meshLandmarks) {
      drawGoogleFaceMesh(canvas, meshLandmarks, {
        color: boxColor,
        showMeshPoints: true,
        showContours: true,
        showIrises: true
      });
    }

    // 2. Draw Sleek Cyber HUD Bounding Box
    if (box) {
      // Mirror coordinate flip so text remains upright and box aligns with flipped video
      const flippedBox = new faceapi.Rect(
        displaySize.width - box.x - box.width,
        box.y,
        box.width,
        box.height
      );

      const drawBox = new faceapi.draw.DrawBox(flippedBox, {
        label: labelText || 'Wajah Terdeteksi',
        lineWidth: 2,
        boxColor: boxColor
      });
      drawBox.draw(canvas);
    }
  }, []);

  // --- AI Video Recognition Loop ---
  useEffect(() => {
    if (!isModelsLoaded || !isScanning) {
      renderTrackingBox(undefined);
      if (isFaceDetectedRef.current) {
        isFaceDetectedRef.current = false;
        setIsFaceDetected(false);
      }
      return;
    }

    let animFrameId: number;
    let lastScanTime = 0;
    isLoopRunningRef.current = true;
    let lastMatchedTeacherSeenTime = 0;

    const runRecognitionLoop = async () => {
      if (!isLoopRunningRef.current) return;

      try {
        const now = Date.now();
        // Scan at ~160ms for smooth continuous video tracking and high frame rate
        if (now - lastScanTime >= 160) {
          lastScanTime = now;

        if (
          webcamRef.current &&
          webcamRef.current.video &&
          webcamRef.current.video.readyState === 4 &&
          !activeSuccess
        ) {
          const video = webcamRef.current.video;
          const videoW = video.videoWidth || 640;
          const videoH = video.videoHeight || 480;

          try {
            // 1. Parallel Google MediaPipe Face Mesh processing for 468 3D contour points & irises
            let meshLandmarks: any = null;
            try {
              const meshResults = await googleFaceMeshService.send(video);
              if (meshResults && meshResults.multiFaceLandmarks && meshResults.multiFaceLandmarks.length > 0) {
                meshLandmarks = meshResults.multiFaceLandmarks[0];
              }
            } catch (meshErr) {}

            // 2. Balanced input size with relaxed scoreThreshold for effortless detection
            const detection = await faceapi.detectSingleFace(
              video,
              new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.15 })
            ).withFaceLandmarks().withFaceDescriptor();

            if (detection && detection.descriptor && detection.landmarks) {
              lastFaceSeenTimeRef.current = now;
              if (!isFaceDetectedRef.current) {
                isFaceDetectedRef.current = true;
                setIsFaceDetected(true);
              }
              const box = detection.detection.box;

              // Liveness & Visibility Verification (Relaxed with 1.5s grace period)
              const liveness = checkStrictLiveness(detection, videoW, videoH);
              if (!liveness.valid) {
                // If liveness fails for more than 1500ms grace period, reset hold timer
                if (holdingTeacherIdRef.current && now - lastMatchedTeacherSeenTime > 1500) {
                  holdStartTimeRef.current = 0;
                  holdingTeacherIdRef.current = null;
                  holdProgressRef.current = 0;
                  setHoldProgress(0);
                  setHoldRemainingSeconds(3.0);
                  setHoldTeacherName('');
                }
                setScanPercent(30);
                renderTrackingBox(box, liveness.reason || 'Posisikan Wajah Tegak', '#10b981', meshLandmarks);
                setScanStatus({
                  state: 'liveness_failed',
                  message: liveness.reason || 'Posisikan wajah stabil dan tegak'
                });
              } else {
                // When in active teacher registration scan mode:
                if (activeRegistrationTeacherRef.current) {
                  const liveScore = Math.round(detection.detection.score * 100);
                  setScanPercent(liveScore);
                  renderTrackingBox(box, `${activeRegistrationTeacherRef.current.name} (Siap Pindai)`, '#10b981', meshLandmarks);
                  setScanStatus({
                    state: 'detecting',
                    message: `Wajah terdeteksi jelas — Klik tombol "Pindai & Simpan Wajah ${activeRegistrationTeacherRef.current.name}" di bawah.`
                  });
                } else if (isManageMode) {
                  // In Manage Mode: ONLY register or preview face biometrics. NEVER process attendance!
                  const liveDescriptor = detection.descriptor;
                  const registeredWithBiometrics = teachersRef.current.filter(t => t.descriptorArray);

                  let bestTeacher: TeacherRecord | null = null;
                  let minDistance = 999;
                  const relaxedThreshold = 0.62;

                  for (const teacher of registeredWithBiometrics) {
                    if (teacher.descriptorArray) {
                      const distance = faceapi.euclideanDistance(liveDescriptor, teacher.descriptorArray);
                      if (distance < minDistance) {
                        minDistance = distance;
                        bestTeacher = teacher;
                      }
                    }
                  }

                  if (bestTeacher && minDistance <= relaxedThreshold) {
                    const liveMatchPercentage = Math.round(Math.max(50, Math.min(100, (1 - (minDistance / 0.70)) * 100)));
                    setScanPercent(liveMatchPercentage);
                    renderTrackingBox(box, `${bestTeacher.name} (${liveMatchPercentage}%)`, '#10b981', meshLandmarks);
                    setScanStatus({
                      state: 'detecting',
                      message: `Wajah terdeteksi: ${bestTeacher.name} (${liveMatchPercentage}% Cocok). Siap scan ulang jika perlu.`,
                      teacherName: bestTeacher.name
                    });
                  } else {
                    const liveScore = Math.round(detection.detection.score * 100);
                    setScanPercent(liveScore);
                    renderTrackingBox(box, `Wajah Terdeteksi (${liveScore}%)`, '#10b981', meshLandmarks);
                    setScanStatus({
                      state: 'detecting',
                      message: `Wajah terdeteksi jelas (${liveScore}%) — Siap didaftarkan ke sistem.`
                    });
                  }
                } else {
                  // Trigger Gemini 2.5 Flash Multimodal Vision when a face is present in attendance mode
                  if (
                    !isManageMode &&
                    !activeRegistrationTeacherRef.current &&
                    !activeSuccess &&
                    !isSavingAttendanceRef.current &&
                    teachersRef.current.length > 0 &&
                    now - lastGeminiCallTimeRef.current > 1200 &&
                    !isGeminiVerifyingRef.current
                  ) {
                    isGeminiVerifyingRef.current = true;
                    lastGeminiCallTimeRef.current = now;
                    setIsGeminiAnalyzing(true);
                    const currentTargetType = getActiveTargetType();

                    const snapshot = captureCompressedSnapshot();
                    if (snapshot) {
                      verifyAttendanceWithGemini({
                        liveImage: snapshot,
                        candidates: teachersRef.current.map(t => ({
                          id: t.id,
                          name: t.name,
                          nip: t.nip,
                          photo: t.profile_picture || (typeof t.face_descriptor === 'string' && t.face_descriptor.startsWith('data:') ? t.face_descriptor : undefined)
                        })),
                        attendanceType: currentTargetType,
                        schoolName: schoolSettings?.name
                      }).then(res => {
                        setIsGeminiAnalyzing(false);
                        isGeminiVerifyingRef.current = false;
                        if (res.success && res.data && res.data.matched && res.data.matchedTeacherId) {
                          const matched = teachersRef.current.find(t => t.id === res.data!.matchedTeacherId);
                          if (matched && !isSavingAttendanceRef.current && !activeSuccess) {
                            setLastAiVerification({
                              teacherName: matched.name,
                              confidence: res.data.confidence,
                              greeting: res.data.greeting,
                              livenessReason: res.data.livenessReason
                            });
                            handleProcessAttendance(matched, snapshot, undefined, res.data.greeting);
                          }
                        }
                      }).catch(err => {
                        setIsGeminiAnalyzing(false);
                        isGeminiVerifyingRef.current = false;
                      });
                    } else {
                      setIsGeminiAnalyzing(false);
                      isGeminiVerifyingRef.current = false;
                    }
                  }

                  // Biometric Matching for Daily Attendance
                  const liveDescriptor = detection.descriptor;
                  const registeredWithBiometrics = teachersRef.current.filter(t => t.descriptorArray);

                  if (registeredWithBiometrics.length === 0) {
                    const liveScore = Math.round(detection.detection.score * 100);
                    setScanPercent(liveScore);
                    renderTrackingBox(box, `Wajah Terdeteksi (${liveScore}%)`, '#10b981', meshLandmarks);
                    setScanStatus({
                      state: 'detecting',
                      message: 'Wajah terdeteksi. Silakan daftarkan guru melalui tombol di bawah.'
                    });
                  } else {
                    let minDistance = 999;
                    let bestTeacher: TeacherRecord | null = null;

                    // Relaxed Euclidean threshold (0.62) for effortless recognition
                    const relaxedThreshold = 0.62;

                    for (const teacher of registeredWithBiometrics) {
                      if (teacher.descriptorArray) {
                        const distance = faceapi.euclideanDistance(liveDescriptor, teacher.descriptorArray);
                        if (distance < minDistance) {
                          minDistance = distance;
                          bestTeacher = teacher;
                        }
                      }
                    }

                    if (bestTeacher && minDistance <= relaxedThreshold) {
                      lastMatchedTeacherSeenTime = now;
                      const liveMatchPercentage = Math.round(Math.max(50, Math.min(100, (1 - (minDistance / 0.70)) * 100)));
                      
                      // Match found!
                      const lastProcessed = lastProcessedTimeRef.current[bestTeacher.id] || 0;

                      // Duplicate Attendance Protection
                      const currentLogs = todayLogsRef.current || [];
                      const teacherLogsToday = currentLogs.filter(l => l.teacher_id === bestTeacher.id);
                      const hasIn = teacherLogsToday.some(l => l.type === 'in');
                      const hasOut = teacherLogsToday.some(l => l.type === 'out');
                      const activeTarget = getActiveTargetType(bestTeacher.id);

                      let alreadyAttendedReason: string | null = null;
                      if (hasIn && hasOut) {
                        alreadyAttendedReason = 'Anda sudah selesai absen masuk & pulang hari ini. Tolong gantian dengan guru yang lain.';
                      } else if (sessionModeRef.current === 'in' && hasIn) {
                        alreadyAttendedReason = 'Anda sudah absen masuk hari ini. Tolong gantian dengan guru yang lain.';
                      } else if (sessionModeRef.current === 'out' && hasOut) {
                        alreadyAttendedReason = 'Anda sudah absen pulang hari ini. Tolong gantian dengan guru yang lain.';
                      }

                      if (alreadyAttendedReason) {
                        if (
                          alreadyAttendedNoticeRef.current.teacherId === bestTeacher.id &&
                          alreadyAttendedNoticeRef.current.dismissed
                        ) {
                          holdStartTimeRef.current = 0;
                          holdingTeacherIdRef.current = null;
                          holdProgressRef.current = 0;
                          setHoldProgress(0);
                          setHoldRemainingSeconds(3.0);
                          setHoldTeacherName('');
                          setScanPercent(0);
                          renderTrackingBox(undefined);
                          setScanStatus(prev => (prev.state !== 'idle' ? { state: 'idle', message: 'Arahkan wajah ke kamera' } : prev));
                          return;
                        }

                        if (
                          alreadyAttendedNoticeRef.current.teacherId !== bestTeacher.id ||
                          alreadyAttendedNoticeRef.current.firstShownTime === 0
                        ) {
                          alreadyAttendedNoticeRef.current = {
                            teacherId: bestTeacher.id,
                            firstShownTime: now,
                            dismissed: false
                          };
                        }

                        const elapsedNotice = now - alreadyAttendedNoticeRef.current.firstShownTime;
                        if (elapsedNotice < 2000) {
                          holdStartTimeRef.current = 0;
                          holdingTeacherIdRef.current = null;
                          holdProgressRef.current = 0;
                          setHoldProgress(0);
                          setHoldRemainingSeconds(3.0);
                          setHoldTeacherName('');
                          setScanPercent(liveMatchPercentage);
                          renderTrackingBox(box, `${bestTeacher.name} (Sudah Selesai Absen)`, '#f59e0b', meshLandmarks);

                          setScanStatus({
                            state: 'already_attended',
                            message: `${bestTeacher.name}: ${alreadyAttendedReason}`,
                            teacherName: bestTeacher.name
                          });

                          const lastSpoken = lastSpokenAlreadyAttendedRef.current[bestTeacher.id] || 0;
                          if (now - lastSpoken > 8000) {
                            lastSpokenAlreadyAttendedRef.current[bestTeacher.id] = now;
                            playBeep(false);
                          }
                          return;
                        } else {
                          alreadyAttendedNoticeRef.current = {
                            teacherId: bestTeacher.id,
                            firstShownTime: 0,
                            dismissed: true
                          };
                          holdStartTimeRef.current = 0;
                          holdingTeacherIdRef.current = null;
                          holdProgressRef.current = 0;
                          setHoldProgress(0);
                          setHoldRemainingSeconds(3.0);
                          setHoldTeacherName('');
                          setScanPercent(0);
                          renderTrackingBox(undefined);
                          setScanStatus({
                            state: 'idle',
                            message: 'Arahkan wajah ke kamera'
                          });
                          return;
                        }
                      }

                      if (now - lastProcessed < 15000) {
                        if (
                          cooldownNoticeRef.current.teacherId === bestTeacher.id &&
                          cooldownNoticeRef.current.dismissed
                        ) {
                          holdStartTimeRef.current = 0;
                          holdingTeacherIdRef.current = null;
                          holdProgressRef.current = 0;
                          setHoldProgress(0);
                          setHoldRemainingSeconds(3.0);
                          setHoldTeacherName('');
                          setScanPercent(0);
                          renderTrackingBox(undefined);
                          setScanStatus(prev => (prev.state !== 'idle' ? { state: 'idle', message: 'Arahkan wajah ke kamera' } : prev));
                          return;
                        }

                        if (
                          cooldownNoticeRef.current.teacherId !== bestTeacher.id ||
                          cooldownNoticeRef.current.firstShownTime === 0
                        ) {
                          cooldownNoticeRef.current = {
                            teacherId: bestTeacher.id,
                            firstShownTime: now,
                            dismissed: false
                          };
                        }

                        const elapsedCooldown = now - cooldownNoticeRef.current.firstShownTime;
                        if (elapsedCooldown < 2000) {
                          holdStartTimeRef.current = 0;
                          holdingTeacherIdRef.current = null;
                          holdProgressRef.current = 0;
                          setHoldProgress(0);
                          setHoldRemainingSeconds(3.0);
                          setHoldTeacherName('');
                          setScanPercent(liveMatchPercentage);
                          renderTrackingBox(box, `${bestTeacher.name} (${liveMatchPercentage}% - Cooldown)`, '#10b981', meshLandmarks);
                          setScanStatus({
                            state: 'cooldown',
                            message: `Wajah ${bestTeacher.name} (${liveMatchPercentage}% Cocok - Cooldown)`,
                            teacherName: bestTeacher.name
                          });
                          return;
                        } else {
                          cooldownNoticeRef.current = {
                            teacherId: bestTeacher.id,
                            firstShownTime: 0,
                            dismissed: true
                          };
                          holdStartTimeRef.current = 0;
                          holdingTeacherIdRef.current = null;
                          holdProgressRef.current = 0;
                          setHoldProgress(0);
                          setHoldRemainingSeconds(3.0);
                          setHoldTeacherName('');
                          setScanPercent(0);
                          renderTrackingBox(undefined);
                          setScanStatus({
                            state: 'idle',
                            message: 'Arahkan wajah ke kamera'
                          });
                          return;
                        }
                      } else if (isSavingAttendanceRef.current) {
                        renderTrackingBox(box, `Menyimpan: ${bestTeacher.name}...`, '#10b981', meshLandmarks);
                        setScanStatus({
                          state: 'matched',
                          message: `Sedang menyimpan data absensi ${bestTeacher.name}...`,
                          teacherName: bestTeacher.name
                        });
                      } else {
                        // 3.0 SECONDS STEADY HOLD VERIFICATION ENGINE
                        const HOLD_DURATION = 3000;
                        if (holdingTeacherIdRef.current !== bestTeacher.id) {
                          // Begin holding 3.0 seconds
                          holdingTeacherIdRef.current = bestTeacher.id;
                          holdStartTimeRef.current = now;
                          holdProgressRef.current = 5;
                          setHoldTeacherName(bestTeacher.name);
                          setHoldProgress(5);
                          setHoldRemainingSeconds(3.0);

                          setScanPercent(liveMatchPercentage);
                          renderTrackingBox(box, `${bestTeacher.name} (${liveMatchPercentage}%)`, '#10b981', meshLandmarks);

                          setScanStatus({
                            state: 'holding',
                            message: `Wajah ${bestTeacher.name} (${liveMatchPercentage}% Cocok). Tahan posisi 3.0 detik...`,
                            teacherName: bestTeacher.name
                          });
                        } else {
                          // Continuing hold: calculate elapsed time
                          const elapsed = now - holdStartTimeRef.current;
                          const progressPercent = Math.min(100, Math.round((elapsed / HOLD_DURATION) * 100));
                          const remainingSec = Math.max(0, (HOLD_DURATION - elapsed) / 1000);
                          
                          holdProgressRef.current = progressPercent;
                          setHoldProgress(progressPercent);
                          setHoldRemainingSeconds(Number(remainingSec.toFixed(1)));
                          setScanPercent(liveMatchPercentage);

                          if (elapsed >= HOLD_DURATION) {
                            // 3 SECONDS REACHED! COMPLETE ATTENDANCE
                            holdStartTimeRef.current = 0;
                            holdingTeacherIdRef.current = null;
                            holdProgressRef.current = 0;
                            setHoldProgress(100);
                            setHoldRemainingSeconds(0);
                            setScanPercent(100);

                            renderTrackingBox(box, `Terverifikasi: ${bestTeacher.name} (100%)`, '#10b981', meshLandmarks);

                            setScanStatus({
                              state: 'matched',
                              message: `Terverifikasi: ${bestTeacher.name}! Memproses absensi ${activeTarget === 'in' ? 'masuk' : 'pulang'}...`,
                              teacherName: bestTeacher.name
                            });
                            const snapshot = captureCompressedSnapshot();
                            handleProcessAttendance(bestTeacher, snapshot, activeTarget);
                          } else {
                            renderTrackingBox(box, `${bestTeacher.name} (${liveMatchPercentage}%)`, '#10b981', meshLandmarks);
                            setScanStatus({
                              state: 'holding',
                              message: `Wajah ${bestTeacher.name} (${liveMatchPercentage}% Cocok). Tahan posisi ${(remainingSec).toFixed(1)}s...`,
                              teacherName: bestTeacher.name
                            });
                          }
                        }
                      }
                    } else {
                      // Face present but no biometric match
                      // Generous 1500ms grace window
                      if (holdingTeacherIdRef.current && now - lastMatchedTeacherSeenTime > 1500) {
                        holdStartTimeRef.current = 0;
                        holdingTeacherIdRef.current = null;
                        holdProgressRef.current = 0;
                        setHoldProgress(0);
                        setHoldRemainingSeconds(3.0);
                        setHoldTeacherName('');
                      }
                      const liveScore = Math.round(detection.detection.score * 100);
                      setScanPercent(liveScore);
                      renderTrackingBox(box, `Wajah Terdeteksi (${liveScore}%)`, '#10b981', meshLandmarks);
                      setScanStatus({
                        state: 'unrecognized',
                        message: `Wajah terdeteksi (${liveScore}%). Arahkan wajah lurus ke kamera.`
                      });
                    }
                  }
                }
              }
            } else {
              // No face detected in this frame
              // Grace period: allow 1500ms before resetting hold timer
              if (holdingTeacherIdRef.current && now - lastMatchedTeacherSeenTime > 1500) {
                holdStartTimeRef.current = 0;
                holdingTeacherIdRef.current = null;
                holdProgressRef.current = 0;
                setHoldProgress(0);
                setHoldRemainingSeconds(3.0);
                setHoldTeacherName('');
              }
              if (now - lastFaceSeenTimeRef.current > 600) {
                if (alreadyAttendedNoticeRef.current.dismissed || alreadyAttendedNoticeRef.current.teacherId) {
                  alreadyAttendedNoticeRef.current = { teacherId: '', firstShownTime: 0, dismissed: false };
                }
                if (cooldownNoticeRef.current.dismissed || cooldownNoticeRef.current.teacherId) {
                  cooldownNoticeRef.current = { teacherId: '', firstShownTime: 0, dismissed: false };
                }
                renderTrackingBox(undefined);
                setScanPercent(0);
                if (isFaceDetectedRef.current) {
                  isFaceDetectedRef.current = false;
                  setIsFaceDetected(false);
                }
                setScanStatus(prev => (prev.state !== 'idle' ? { state: 'idle', message: isManageMode ? 'Mode Registrasi: Arahkan wajah guru ke kamera' : 'Arahkan wajah ke kamera' } : prev));
              }
            }
          } catch (loopErr) {
            console.warn('Face loop iteration warning:', loopErr);
          }
        }
      }
      } finally {
        if (isLoopRunningRef.current) {
          animFrameId = requestAnimationFrame(runRecognitionLoop);
        }
      }
    };

    animFrameId = requestAnimationFrame(runRecognitionLoop);

    return () => {
      isLoopRunningRef.current = false;
      cancelAnimationFrame(animFrameId);
      renderTrackingBox(undefined);
      if (isFaceDetectedRef.current) {
        isFaceDetectedRef.current = false;
        setIsFaceDetected(false);
      }
    };
  }, [
    isModelsLoaded,
    isScanning,
    isManageMode,
    activeSuccess,
    renderTrackingBox,
    handleProcessAttendance,
    getActiveTargetType,
    captureCompressedSnapshot,
    playBeep
  ]);

  // --- Fullscreen Toggle ---
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // --- Handle Registration on Kiosk (New Teacher or Select for Face Scan) ---
  const handleExecuteManageFace = async (e: React.FormEvent) => {
    e.preventDefault();
    setManageError('');
    setManageSuccess('');
    setIsProcessingManage(true);

    try {
      if (manageTab === 'new') {
        // Tab A: Register new teacher info first, keep context, return to camera scan view
        const cleanName = newTeacherName.trim();
        const cleanNip = newTeacherNip.trim();

        if (!cleanName) {
          throw new Error('Nama guru wajib diisi.');
        }

        const uniqueId = Date.now().toString(36);
        const payload: any = {
          name: cleanName,
          nip: cleanNip || null,
          username: `guru_${uniqueId}`,
          pin: '0000',
          ...(effectiveUserId ? { user_id: effectiveUserId } : {})
        };

        // Resilient Insert with NIP fallback
        let insertRes = await supabase
          .from('teachers')
          .insert([payload])
          .select('*')
          .single();

        if (insertRes.error && (insertRes.error.code === 'PGRST204' || insertRes.error.message?.toLowerCase().includes('nip'))) {
          delete payload.nip;
          insertRes = await supabase
            .from('teachers')
            .insert([payload])
            .select('*')
            .single();
        }

        if (insertRes.error) throw insertRes.error;
        const newTeacher = insertRes.data;

        // Add to local state (no face descriptor yet until captured)
        const parsedRecord: TeacherRecord = {
          ...newTeacher,
          descriptorArray: undefined
        };

        setTeachers(prev => [...prev, parsedRecord]);
        playBeep(true);
        speakText(`Guru ${cleanName} tersimpan. Silakan hadapkan wajah ke kamera.`);

        // Keep teacher context and activate prominent scan button on main kiosk screen
        setActiveRegistrationTeacher({
          id: newTeacher.id,
          name: cleanName,
          nip: cleanNip || undefined,
          isNew: true
        });

        setRegistrationFaceStatus({
          type: 'idle',
          message: `Data guru "${cleanName}" tersimpan. Silakan posisikan wajah menghadap kamera lalu tekan tombol "Pindai Wajah Guru".`
        });

        setShowManageModal(false);
        setNewTeacherName('');
        setNewTeacherNip('');

      } else if (manageTab === 'update') {
        // Tab B: Select existing teacher to scan face
        if (!selectedTeacherId) {
          throw new Error('Silakan pilih guru terlebih dahulu.');
        }

        const targetTeacher = teachers.find(t => t.id === selectedTeacherId);
        if (!targetTeacher) throw new Error('Data guru tidak ditemukan.');

        setActiveRegistrationTeacher({
          id: targetTeacher.id,
          name: targetTeacher.name,
          nip: targetTeacher.nip || undefined,
          isNew: false
        });

        setRegistrationFaceStatus({
          type: 'idle',
          message: `Siap merekam biometrik wajah untuk "${targetTeacher.name}". Hadapkan wajah ke kamera lalu tekan tombol "Pindai Wajah Guru".`
        });

        playBeep(true);
        speakText(`Siap merekam wajah ${targetTeacher.name}.`);

        setShowManageModal(false);
        setSelectedTeacherId('');

      } else if (manageTab === 'reset') {
        // Tab C: Reset biometric face for an existing teacher
        if (!selectedTeacherId) {
          throw new Error('Silakan pilih guru yang ingin direset data biometrik wajahnya.');
        }

        const targetTeacher = teachers.find(t => t.id === selectedTeacherId);
        if (!targetTeacher) throw new Error('Data guru tidak ditemukan.');

        let resetQuery = supabase
          .from('teachers')
          .update({ face_descriptor: null })
          .eq('id', selectedTeacherId);

        if (effectiveUserId) {
          resetQuery = resetQuery.eq('user_id', effectiveUserId);
        }

        const { error: resetError } = await resetQuery;
        if (resetError) throw resetError;

        // Update local state
        setTeachers(prev =>
          prev.map(t =>
            t.id === selectedTeacherId
              ? { ...t, face_descriptor: undefined, descriptorArray: undefined }
              : t
          )
        );

        playBeep(true);
        speakText(`Data wajah guru ${targetTeacher.name} berhasil direset.`);
        setManageSuccess(`Data biometrik wajah guru "${targetTeacher.name}" berhasil direset! Guru dapat dipindai ulang kapan saja.`);

        setTimeout(() => {
          setShowManageModal(false);
          setSelectedTeacherId('');
          setManageSuccess('');
        }, 1800);
      }
    } catch (err: any) {
      console.error('Manage face error:', err);
      setManageError(err.message || 'Terjadi kesalahan saat memproses data guru.');
    } finally {
      setIsProcessingManage(false);
    }
  };

  // --- Scan & Save Face for Active Selected Teacher ---
  const handleScanActiveTeacherFace = async () => {
    if (!activeRegistrationTeacher) return;
    if (isScanningActiveFace) return;

    setIsScanningActiveFace(true);
    setRegistrationFaceStatus({
      type: 'idle',
      message: `Sedang mendeteksi dan merekam biometrik wajah untuk "${activeRegistrationTeacher.name}"...`
    });

    try {
      if (!webcamRef.current || !webcamRef.current.video) {
        throw new Error('Kamera kiosk belum siap atau tidak aktif.');
      }

      const video = webcamRef.current.video;
      if (video.readyState !== 4) {
        throw new Error('Aliran video kamera belum stabil. Silakan coba sesaat lagi.');
      }

      // 1. Capture high-res snapshot
      const snapshot = captureCompressedSnapshot();

      // 2. Validate and extract visual profile with Google Gemini 2.5 Flash Vision
      let geminiFeedback = '';
      if (snapshot) {
        setRegistrationFaceStatus({
          type: 'idle',
          message: `Google Gemini 2.5 Flash sedang menganalisis kualitas wajah "${activeRegistrationTeacher.name}"...`
        });

        try {
          const geminiRes = await registerFaceWithGemini({
            image: snapshot,
            teacherName: activeRegistrationTeacher.name
          });

          if (geminiRes.success && geminiRes.data) {
            if (!geminiRes.data.isValidFace) {
              throw new Error(geminiRes.data.feedback || 'Wajah tidak memenuhi syarat biometrik (kurang jelas / pencahayaan gelap).');
            }
            geminiFeedback = geminiRes.data.visualProfile ? ` (${geminiRes.data.visualProfile})` : '';
          }
        } catch (aiErr: any) {
          console.warn('Gemini register analysis notice:', aiErr);
        }
      }

      // 3. Local landmark & descriptor extraction
      let descriptorArray: number[] | undefined = undefined;
      let rawDescriptor: Float32Array | undefined = undefined;
      try {
        const detection = await faceapi.detectSingleFace(
          video,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.35 })
        ).withFaceLandmarks().withFaceDescriptor();

        if (detection && detection.descriptor) {
          descriptorArray = Array.from(detection.descriptor);
          rawDescriptor = detection.descriptor;
        }
      } catch (locErr) {
        console.warn('Local faceapi extraction note:', locErr);
      }

      // Save to Supabase database (both profile_picture snapshot and face_descriptor)
      const updatePayload: any = {};
      if (snapshot) {
        updatePayload.profile_picture = snapshot;
      }
      if (descriptorArray) {
        updatePayload.face_descriptor = JSON.stringify(descriptorArray);
      }

      let updateQuery = supabase
        .from('teachers')
        .update(updatePayload)
        .eq('id', activeRegistrationTeacher.id);

      if (effectiveUserId) {
        updateQuery = updateQuery.eq('user_id', effectiveUserId);
      }

      const { error: updateError } = await updateQuery;
      if (updateError) throw updateError;

      // Update local state in teachers list
      setTeachers(prev =>
        prev.map(t =>
          t.id === activeRegistrationTeacher.id
            ? {
                ...t,
                profile_picture: snapshot || t.profile_picture,
                face_descriptor: descriptorArray ? JSON.stringify(descriptorArray) : t.face_descriptor,
                descriptorArray: rawDescriptor || t.descriptorArray
              }
            : t
        )
      );

      playBeep(true);
      speakText(`Biometrik wajah guru ${activeRegistrationTeacher.name} berhasil disimpan dengan Gemini AI!`);

      setRegistrationFaceStatus({
        type: 'success',
        message: `Sukses! Wajah "${activeRegistrationTeacher.name}" diverifikasi oleh Google Gemini 2.5 Flash Vision${geminiFeedback} dan langsung aktif di Kiosk.`
      });

      // Automatically complete registration after 2.8s
      setTimeout(() => {
        setActiveRegistrationTeacher(null);
        setRegistrationFaceStatus(null);
      }, 2800);

    } catch (err: any) {
      console.error('Scan face error:', err);
      playBeep(false);
      setRegistrationFaceStatus({
        type: 'error',
        message: err.message || 'Gagal merekam biometrik wajah. Silakan coba lagi.'
      });
    } finally {
      setIsScanningActiveFace(false);
    }
  };

  // --- Direct Quick Reset Face from Teacher List with Modal Confirmation ---
  const handleQuickResetFace = (teacherId: string, teacherName: string) => {
    setKioskResetTarget({ id: teacherId, name: teacherName });
  };

  const handleConfirmKioskReset = async () => {
    if (!kioskResetTarget) return;
    const teacherId = kioskResetTarget.id;
    const teacherName = kioskResetTarget.name;

    setIsProcessingManage(true);
    setManageError('');
    setManageSuccess('');
    try {
      let resetQuery = supabase
        .from('teachers')
        .update({ face_descriptor: null })
        .eq('id', teacherId);

      if (effectiveUserId) {
        resetQuery = resetQuery.eq('user_id', effectiveUserId);
      }

      const { error: resetError } = await resetQuery;
      if (resetError) throw resetError;

      setTeachers(prev =>
        prev.map(t =>
          t.id === teacherId
            ? { ...t, face_descriptor: undefined, descriptorArray: undefined }
            : t
        )
      );

      playBeep(true);
      speakText(`Data wajah ${teacherName} berhasil direset.`);
      setManageSuccess(`Data biometrik wajah ${teacherName} berhasil direset!`);
      setKioskResetTarget(null);
      setTimeout(() => setManageSuccess(''), 3000);
    } catch (err: any) {
      console.error('Reset face error:', err);
      setManageError(err.message || 'Gagal mereset data wajah guru.');
    } finally {
      setIsProcessingManage(false);
    }
  };

  // --- Direct Delete Teacher from Kiosk Mode with Modal Confirmation ---
  const handleConfirmKioskDelete = async () => {
    if (!kioskDeleteTarget) return;
    const teacherId = kioskDeleteTarget.id;
    const teacherName = kioskDeleteTarget.name;

    setIsDeletingTeacher(true);
    try {
      // 1. Delete associated attendance logs
      let logQuery = supabase.from('attendance_logs').delete().eq('teacher_id', teacherId);
      if (effectiveUserId) {
        logQuery = logQuery.eq('user_id', effectiveUserId);
      }
      await logQuery;

      // 2. Delete teacher
      let teacherQuery = supabase.from('teachers').delete().eq('id', teacherId);
      if (effectiveUserId) {
        teacherQuery = teacherQuery.eq('user_id', effectiveUserId);
      }
      const { error: deleteError } = await teacherQuery;
      if (deleteError) throw deleteError;

      setTeachers(prev => prev.filter(t => t.id !== teacherId));
      setTodayLogs(prev => prev.filter(l => l.teacher_id !== teacherId));

      playBeep(true);
      speakText(`Guru ${teacherName} berhasil dihapus.`);
      setKioskDeleteTarget(null);
    } catch (err: any) {
      console.error('Delete teacher error:', err);
    } finally {
      setIsDeletingTeacher(false);
    }
  };

  // --- Statistics Calculations ---
  const totalTeachers = teachers.length;
  const uniquePresentTeacherIds = new Set(todayLogs.map(l => l.teacher_id));
  const presentCount = uniquePresentTeacherIds.size;
  const absentCount = Math.max(0, totalTeachers - presentCount);
  const attendancePercentage = totalTeachers > 0 ? Math.round((presentCount / totalTeachers) * 100) : 0;

  // Biometric registration statistics (specifically for Registration & Manage Mode)
  const registeredCount = teachers.filter(t => t.face_descriptor || t.descriptorArray).length;
  const unregisteredCount = Math.max(0, totalTeachers - registeredCount);
  const registrationPercentage = totalTeachers > 0 ? Math.round((registeredCount / totalTeachers) * 100) : 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans select-none overflow-x-hidden">
      {/* 1. KIOSK TOP HEADER - Clean, Minimalist, Hardware-Style */}
      <header className="bg-zinc-900/95 border-b border-zinc-800/80 px-4 sm:px-6 py-3.5 sticky top-0 z-40 flex items-center justify-between gap-4">
        {/* School Identity */}
        <div className="flex items-center gap-3.5">
          {schoolSettings?.logo ? (
            <img
              src={schoolSettings.logo}
              alt="Logo"
              className="w-10 h-10 rounded-xl object-contain bg-white p-1 border border-zinc-700 shadow-sm"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-emerald-400 shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight line-clamp-1">
                {schoolSettings?.name || 'Presensi Biometrik Guru'}
              </h1>
              {isManageMode ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold uppercase tracking-wider">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Mode Registrasi Wajah Saja</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>Kiosk Stand Absensi Murni</span>
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 font-medium">
              {isManageMode
                ? 'Panel Khusus Pendaftaran & Reset Biometrik Guru (Hanya Registrasi, Tanpa Scan Absen)'
                : 'Stand Presensi Wajah Otomatis (Tanpa Menu Pendaftaran/Reset)'}
            </p>
          </div>
        </div>

        {/* Live Clock & Action Controls */}
        <div className="flex items-center gap-2.5">
          {/* Switch Mode Button (if in manage mode, quick jump to pure attendance) */}
          {isManageMode && (
            <button
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.delete('mode');
                window.location.href = url.pathname;
              }}
              title="Beralih ke Stand Absensi Murni"
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold hidden sm:flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Buka Mode Stand</span>
            </button>
          )}

          {/* Digital Clock */}
          <div className="text-right px-3.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl hidden md:block">
            <div className="text-base font-bold font-mono tracking-wide text-zinc-100">
              {format(currentTime, 'HH:mm:ss')} <span className="text-xs text-zinc-500 font-normal">WIB</span>
            </div>
            <div className="text-[11px] text-zinc-400">
              {format(currentTime, 'EEEE, dd MMMM yyyy', { locale: id })}
            </div>
          </div>

          {/* Attendance Session Mode (Auto / Masuk / Pulang) */}
          {!isManageMode && (
            <div className="flex items-center p-1 bg-zinc-950 border border-zinc-800 rounded-xl">
              <button
                type="button"
                onClick={() => setSessionMode('auto')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  sessionMode === 'auto'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Otomatis tentukan Masuk atau Pulang berdasarkan jam"
              >
                Auto ({getActiveTargetType() === 'in' ? 'Masuk' : 'Pulang'})
              </button>
              <button
                type="button"
                onClick={() => setSessionMode('in')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  sessionMode === 'in'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Kunci sesi hanya untuk Absen Datang / Masuk"
              >
                Masuk
              </button>
              <button
                type="button"
                onClick={() => setSessionMode('out')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  sessionMode === 'out'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Kunci sesi hanya untuk Absen Pulang"
              >
                Pulang
              </button>
            </div>
          )}

          {/* Reset Camera Button */}
          <button
            onClick={handleResetCamera}
            title="Reset Sensor & Kamera (Muat ulang kamera jika macet)"
            className="p-2 sm:px-3 sm:py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-cyan-400 hover:text-cyan-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <RotateCcw className={`w-4 h-4 ${isResettingCamera ? 'animate-spin text-cyan-300' : 'text-cyan-400'}`} />
            <span className="hidden sm:inline">Reset Kamera</span>
          </button>

          {/* Audio toggle */}
          <button
            onClick={() => {
              const nextVal = !isAudioEnabled;
              setIsAudioEnabled(nextVal);
              if (nextVal) {
                playBeep(true);
                speakText('Suara absensi aktif.');
              }
            }}
            title={isAudioEnabled ? 'Suara Aktif (Klik untuk membisukan)' : 'Suara Bisu (Klik untuk mengaktifkan)'}
            className={`p-2 sm:px-3 sm:py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              isAudioEnabled
                ? 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-750'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-850'
            }`}
          >
            {isAudioEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{isAudioEnabled ? 'Suara Aktif' : 'Bisu'}</span>
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Keluar Layar Penuh' : 'Mode Layar Penuh'}
            className="p-2 sm:px-3 sm:py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            <span className="hidden lg:inline">{isFullscreen ? 'Normal' : 'Layar Penuh'}</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN KIOSK BODY */}
      <main className="flex-1 p-3 sm:p-5 max-w-[1600px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        
        {/* LEFT / CENTER COLUMN: CAM SCANNER VIEWFINDER (7 Cols) */}
        <section className="lg:col-span-7 flex flex-col gap-3.5">
          <div className="bg-zinc-900 rounded-3xl border border-zinc-800/80 p-4 sm:p-5 shadow-xl relative overflow-hidden">
            
            {/* Top Viewfinder Bar */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="relative flex h-2.5 w-2.5">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isGeminiAnalyzing ? 'bg-indigo-400' : 'bg-emerald-400'} opacity-75`}></span>
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isGeminiAnalyzing ? 'bg-indigo-500' : 'bg-emerald-500'}`}></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-zinc-300">
                    Sensor Biometrik Aktif
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950/80 border border-indigo-500/40 text-indigo-300 shadow-sm">
                    <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                    <span>Gemini 2.5 Flash AI</span>
                  </span>
                  {isGeminiAnalyzing && (
                    <span className="text-[10px] text-indigo-300 font-medium animate-pulse hidden sm:inline">
                      Menganalisis...
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetCamera}
                  title="Reset Sensor & Kamera"
                  className="px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border bg-zinc-800 hover:bg-zinc-700 text-cyan-300 border-zinc-700 hover:border-cyan-500/50 flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isResettingCamera ? 'animate-spin text-cyan-300' : 'text-cyan-400'}`} />
                  <span>Reset Kamera</span>
                </button>

                <button
                  onClick={() => setIsScanning(!isScanning)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer border ${
                    isScanning
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}
                >
                  {isScanning ? 'Scan Aktif' : 'Scan Dijeda'}
                </button>
              </div>
            </div>

            {/* CAMERA VIEWFINDER STAGE - Clean, No Distracting Reticle Box */}
            <div className="relative aspect-[4/3] sm:aspect-[16/10] bg-black rounded-2xl overflow-hidden border border-zinc-800 flex items-center justify-center shadow-inner">
              
              {/* @ts-ignore */}
              <Webcam
                key={cameraKey}
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={{
                  width: { ideal: 640, max: 1280 },
                  height: { ideal: 480, max: 720 },
                  facingMode: 'user',
                  frameRate: { ideal: 24, max: 30 }
                }}
                className="w-full h-full object-cover mirror-mode"
              />

              {/* Reset Notification Badge */}
              {resetToastMessage && (
                <div className="absolute top-4 inset-x-0 flex justify-center pointer-events-none px-4 z-20 animate-in fade-in duration-150">
                  <div className="px-4 py-2 rounded-full bg-cyan-950/90 border border-cyan-500/50 text-cyan-200 text-xs font-semibold shadow-xl flex items-center gap-2 backdrop-blur-md">
                    <RotateCcw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                    <span>Kamera & Sensor Berhasil Direset</span>
                  </div>
                </div>
              )}

              {/* Canvas Overlay for Green Biometric Landmark Dots */}
              <canvas
                ref={canvasOverlayRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />

              {/* Smooth Hold Progress Bar at bottom of viewfinder */}
              {scanStatus.state === 'holding' && (
                <div className="absolute bottom-0 inset-x-0 h-2 bg-zinc-950/80 overflow-hidden z-20">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 transition-all duration-100 ease-out shadow-[0_0_12px_rgba(16,185,129,0.7)]"
                    style={{ width: `${holdProgress}%` }}
                  />
                </div>
              )}

              {/* Minimalist Floating Status Pill (Only Visible When Face is Actively Detected AND Status is NOT idle) */}
              {isFaceDetected && !activeSuccess && scanStatus.state !== 'idle' && (
                <div className="absolute bottom-5 inset-x-0 flex justify-center pointer-events-none px-4 z-10 animate-in fade-in duration-150">
                  <div className={`px-4 py-2 rounded-full backdrop-blur-md border text-xs font-semibold shadow-xl flex items-center gap-2.5 transition-all duration-200 ${
                    scanStatus.state === 'already_attended'
                      ? 'bg-amber-950/95 border-amber-500/80 text-amber-200'
                      : scanStatus.state === 'holding'
                      ? 'bg-zinc-900/90 border-emerald-500/50 text-emerald-300'
                      : scanStatus.state === 'matched'
                      ? 'bg-emerald-950/90 border-emerald-400 text-white'
                      : scanStatus.state === 'liveness_failed'
                      ? 'bg-zinc-900/90 border-amber-500/40 text-amber-300'
                      : scanStatus.state === 'unrecognized'
                      ? 'bg-zinc-900/90 border-rose-500/40 text-rose-300'
                      : scanStatus.state === 'cooldown'
                      ? 'bg-zinc-900/90 border-zinc-700 text-zinc-300'
                      : 'bg-zinc-900/80 border-white/10 text-zinc-300'
                  }`}>
                    {scanStatus.state === 'already_attended' ? (
                      <>
                        <UserCheck className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="font-bold text-amber-300">{scanStatus.message}</span>
                      </>
                    ) : scanStatus.state === 'holding' ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                        <span className="font-bold text-white">{holdTeacherName}</span>
                        <span className="text-zinc-500">•</span>
                        <span className="font-mono text-emerald-400 font-bold">{scanPercent}% Cocok</span>
                        <span className="text-zinc-500">•</span>
                        <span className="text-zinc-400">Tahan {(holdRemainingSeconds != null ? holdRemainingSeconds : 3.0).toFixed(1)}s</span>
                      </>
                    ) : scanStatus.state === 'matched' ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="font-bold text-white">Presensi Berhasil Terverifikasi!</span>
                      </>
                    ) : scanStatus.state === 'liveness_failed' ? (
                      <>
                        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>{scanStatus.message}</span>
                      </>
                    ) : scanStatus.state === 'unrecognized' ? (
                      <>
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>Wajah belum cocok / belum terdaftar</span>
                        {scanPercent > 0 && (
                          <>
                            <span className="text-zinc-500">•</span>
                            <span className="font-mono text-rose-300">{scanPercent}% deteksi</span>
                          </>
                        )}
                      </>
                    ) : scanStatus.state === 'cooldown' ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{scanStatus.message}</span>
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <span>Arahkan wajah ke kamera</span>
                        {scanPercent > 0 && (
                          <>
                            <span className="text-zinc-500">•</span>
                            <span className="text-emerald-400 font-mono text-[11px]">{scanPercent}% live</span>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Models Loading Overlay */}
              {!isModelsLoaded && (
                <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
                  <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
                  <h3 className="text-sm font-bold text-white mb-1">Memuat Model Biometrik Wajah</h3>
                  <p className="text-xs text-zinc-400 max-w-xs">{modelsLoadingProgress}</p>
                </div>
              )}

              {/* SUCCESS TOAST OVERLAY */}
              {activeSuccess && (
                <div className="absolute inset-x-4 bottom-4 z-30 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="bg-emerald-950/95 border-2 border-emerald-500/80 rounded-2xl p-4 shadow-2xl backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                      <div className="w-11 h-11 rounded-xl bg-emerald-500 flex items-center justify-center text-white shrink-0 shadow-md">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                            activeSuccess.type === 'in' ? 'bg-emerald-500 text-zinc-950' : 'bg-blue-500 text-white'
                          }`}>
                            {activeSuccess.type === 'in' ? 'PRESENSI MASUK' : 'PRESENSI PULANG'}
                          </span>
                          <span className="text-xs font-mono font-bold text-emerald-300">{activeSuccess.time} WIB</span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded-md border border-indigo-500/30">
                            <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                            <span>Gemini TTS</span>
                          </span>
                        </div>
                        <h3 className="text-sm sm:text-base font-bold text-white mt-0.5 truncate">
                          {activeSuccess.teacherName}
                        </h3>
                        
                        {/* Gemini Voice Greeting Quote Bubble */}
                        {activeSuccess.aiGreeting && (
                          <div className="mt-1.5 p-2 bg-emerald-900/60 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-xs text-emerald-200">
                            <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse shrink-0" />
                            <span className="italic line-clamp-2">"{activeSuccess.aiGreeting}"</span>
                            <button
                              type="button"
                              onClick={() => speakText(activeSuccess.aiGreeting || '')}
                              title="Dengar Ulang Suara AI Gemini"
                              className="ml-auto px-2 py-1 bg-emerald-700/60 hover:bg-emerald-600 text-white rounded-lg text-[10px] font-bold shrink-0 transition-colors cursor-pointer"
                            >
                              🔊 Ulangi
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {activeSuccess.photo && (
                      <img
                        src={activeSuccess.photo}
                        alt="Face Snapshot"
                        className="w-12 h-12 rounded-xl object-cover border-2 border-emerald-400/80 shrink-0 self-end sm:self-center"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* KIOSK ACTION CONTROLS */}
            {!isManageMode ? (
              // 1. KIOSK STAND ABSENSI MURNI: Tidak ada tombol pendaftaran atau reset
              <div className="mt-3.5 py-3 px-4 bg-zinc-950/85 border border-zinc-800 rounded-2xl flex items-center justify-between text-xs text-zinc-300">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
                  <span className="font-medium">
                    Stand Presensi Siap — Hadapkan wajah ke kamera untuk deteksi cepat & presisi AI Gemini 2.5 Flash Vision.
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-indigo-400 font-mono">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden sm:inline">Gemini Vision AI</span>
                </div>
              </div>
            ) : (
              // 2. KIOSK REGISTRASI WAJAH: Action Panel & Tombol Pendaftaran/Scan
              <div className="mt-3.5 space-y-3">
                {/* ACTIVE FACE REGISTRATION ACTION PANEL (When a teacher is currently selected/created for face scan) */}
                {activeRegistrationTeacher ? (
                  <div className="p-4 bg-zinc-950 border-2 border-emerald-500 rounded-2xl shadow-xl space-y-3 animate-in fade-in zoom-in-95">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                          <ScanFace className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              {activeRegistrationTeacher.isNew ? 'Guru Baru' : 'Pindai Ulang'}
                            </span>
                            {activeRegistrationTeacher.nip && (
                              <span className="text-[11px] text-zinc-400 font-mono">NIP: {activeRegistrationTeacher.nip}</span>
                            )}
                          </div>
                          <h3 className="text-base font-bold text-white truncate mt-0.5">
                            {activeRegistrationTeacher.name}
                          </h3>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveRegistrationTeacher(null);
                          setRegistrationFaceStatus(null);
                        }}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Batal</span>
                      </button>
                    </div>

                    {/* Status Feedback Message */}
                    {registrationFaceStatus && (
                      <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                        registrationFaceStatus.type === 'success'
                          ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40'
                          : registrationFaceStatus.type === 'error'
                          ? 'bg-rose-500/20 text-rose-200 border border-rose-500/40'
                          : 'bg-zinc-900 text-zinc-300 border border-zinc-800'
                      }`}>
                        {registrationFaceStatus.type === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : registrationFaceStatus.type === 'error' ? (
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        ) : (
                          <Camera className="w-4 h-4 text-emerald-400 shrink-0" />
                        )}
                        <span>{registrationFaceStatus.message}</span>
                      </div>
                    )}

                    {/* Prominent Biometric Scan Button */}
                    <button
                      type="button"
                      onClick={handleScanActiveTeacherFace}
                      disabled={isScanningActiveFace}
                      className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
                    >
                      {isScanningActiveFace ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin text-white" />
                          <span>Merekam Biometrik Wajah...</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-5 h-5 text-white" />
                          <span>📸 Pindai & Simpan Wajah "{activeRegistrationTeacher.name}"</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      onClick={() => {
                        setManageTab('new');
                        setManageError('');
                        setManageSuccess('');
                        setSelectedTeacherId('');
                        setShowManageModal(true);
                      }}
                      className="py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs sm:text-sm font-semibold shadow-lg shadow-emerald-600/15 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>+ Daftarkan Guru Baru & Wajah</span>
                    </button>
                    <button
                      onClick={() => {
                        setManageTab('update');
                        setManageError('');
                        setManageSuccess('');
                        setSelectedTeacherId('');
                        setShowManageModal(true);
                      }}
                      className="py-3 px-4 bg-zinc-850 hover:bg-zinc-800 text-indigo-300 border border-indigo-500/30 rounded-2xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <ScanFace className="w-4 h-4 text-indigo-400" />
                      <span>Pilih Guru untuk Pindai Wajah</span>
                    </button>
                  </div>
                )}

                <div className="py-2.5 px-3.5 bg-amber-500/10 border border-amber-500/25 rounded-2xl text-amber-300 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium">
                    <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Kiosk Registrasi Biometrik — Wajah yang didaftarkan akan langsung tersimpan dan dapat digunakan untuk absensi harian.</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT COLUMN: STATS & DIRECTORY / ATTENDANCE LOG (5 Cols) */}
        <section className="lg:col-span-5 flex flex-col gap-3.5">
          
          {/* STATS SUMMARY CARD */}
          {isManageMode ? (
            /* 1. BIOMETRIC REGISTRATION PROGRESS CARD (IN REGISTRATION MODE) */
            <div className="bg-zinc-900 rounded-3xl border border-zinc-800/80 p-4 sm:p-5 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ScanFace className="w-4 h-4 text-emerald-400" />
                  <span>Status Registrasi Biometrik</span>
                </h3>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Mode Registrasi Saja
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5 mb-3.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-emerald-400">{registeredCount} Terdaftar ({registrationPercentage}%)</span>
                  <span className="text-zinc-400">Total: {totalTeachers} Guru</span>
                </div>
                <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden flex">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-500 rounded-full"
                    style={{ width: `${registrationPercentage}%` }}
                  />
                </div>
              </div>

              {/* Stat Counters */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-2xl">
                  <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Wajah Terdaftar</span>
                  <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-0.5">
                    {registeredCount} <span className="text-xs font-semibold text-zinc-500">Guru</span>
                  </div>
                </div>
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-2xl">
                  <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Belum Rekam Wajah</span>
                  <div className="text-xl sm:text-2xl font-black text-amber-400 mt-0.5">
                    {unregisteredCount} <span className="text-xs font-semibold text-zinc-500">Guru</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* 2. DAILY PRESENCE CARD (IN STAND ATTENDANCE MODE) */
            <div className="bg-zinc-900 rounded-3xl border border-zinc-800/80 p-4 sm:p-5 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span>Kehadiran Hari Ini</span>
                </h3>
                <span className="text-xs text-zinc-400">
                  {format(currentTime, 'dd MMMM yyyy', { locale: id })}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5 mb-3.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-emerald-400">{presentCount} Hadir ({attendancePercentage}%)</span>
                  <span className="text-zinc-400">Total: {totalTeachers} Guru</span>
                </div>
                <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden flex">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-500 rounded-full"
                    style={{ width: `${attendancePercentage}%` }}
                  />
                </div>
              </div>

              {/* Stat Counters */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-2xl">
                  <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Sudah Hadir</span>
                  <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-0.5">
                    {presentCount} <span className="text-xs font-semibold text-zinc-500">Guru</span>
                  </div>
                </div>
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-2xl">
                  <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Belum Hadir</span>
                  <div className="text-xl sm:text-2xl font-black text-amber-400 mt-0.5">
                    {absentCount} <span className="text-xs font-semibold text-zinc-500">Guru</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* RIGHT PANEL: TEACHER LIST (IN MANAGE MODE) VS ATTENDANCE LOG (IN STAND MODE) */}
          <div className="bg-zinc-900 rounded-3xl border border-zinc-800/80 p-4 sm:p-5 shadow-xl flex-1 flex flex-col min-h-[440px]">
            
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              {isManageMode ? (
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">Daftar Guru & Status Wajah ({teachers.length})</h3>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">Catatan Presensi Hari Ini</h3>
                </div>
              )}

              <button
                onClick={fetchData}
                disabled={isLoadingData}
                title="Perbarui Data"
                className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            </div>

            {/* PANEL BODY */}
            {isManageMode ? (
              /* DIRECT TEACHER DIRECTORY FOR REGISTER & RESET */
              <div className="flex-1 flex flex-col min-h-0">
                {/* Search Bar */}
                <div className="relative mb-3">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari guru berdasarkan nama/NIP..."
                    value={teacherSearchQuery}
                    onChange={(e) => setTeacherSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                {/* Teachers List */}
                <div className="flex-1 overflow-y-auto space-y-2 max-h-[360px] pr-1">
                  {teachers
                    .filter(t => 
                      t.name.toLowerCase().includes(teacherSearchQuery.toLowerCase()) || 
                      (t.nip && t.nip.includes(teacherSearchQuery))
                    )
                    .map((t) => {
                      const hasFace = !!t.face_descriptor;
                      return (
                        <div
                          key={t.id}
                          className="p-3 bg-zinc-950 border border-zinc-800/90 rounded-2xl flex items-center justify-between gap-3 hover:border-zinc-700 transition-colors"
                        >
                          <div className="min-w-0 flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-200 shrink-0">
                              {t.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-semibold text-white truncate">
                                {t.name}
                              </h4>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px]">
                                {hasFace ? (
                                  <span className="text-emerald-400 flex items-center gap-0.5 font-medium">
                                    <CheckCircle2 className="w-3 h-3" /> Wajah Terdaftar
                                  </span>
                                ) : (
                                  <span className="text-amber-400 font-medium">
                                    ⚠️ Belum Ada Wajah
                                  </span>
                                )}
                                {t.nip && <span className="text-zinc-500">NIP: {t.nip}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Scan Face button - directly activates prominent scan mode on camera view */}
                            <button
                              onClick={() => {
                                setActiveRegistrationTeacher({
                                  id: t.id,
                                  name: t.name,
                                  nip: t.nip || undefined,
                                  isNew: false
                                });
                                setRegistrationFaceStatus({
                                  type: 'idle',
                                  message: `Siap merekam biometrik wajah untuk "${t.name}". Hadapkan wajah ke kamera lalu klik tombol "Pindai & Simpan Wajah".`
                                });
                                playBeep(true);
                              }}
                              title={hasFace ? 'Pindai Ulang Wajah' : 'Daftarkan Wajah'}
                              className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Camera className="w-3 h-3" />
                              <span>{hasFace ? 'Scan Ulang' : 'Daftarkan'}</span>
                            </button>

                            {/* Reset Face button (only if has face) */}
                            {hasFace && (
                              <button
                                onClick={() => handleQuickResetFace(t.id, t.name)}
                                title="Reset Data Wajah"
                                className="p-1 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-lg text-[11px] cursor-pointer transition-colors"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                              </button>
                            )}

                            {/* Delete Teacher button */}
                            <button
                              onClick={() => setKioskDeleteTarget({ id: t.id, name: t.name })}
                              title="Hapus Guru"
                              className="p-1 bg-zinc-800 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300 border border-zinc-700/60 hover:border-rose-500/30 rounded-lg text-[11px] cursor-pointer transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
              /* ATTENDANCE LOG FEED (ONLY IN PURE STAND ATTENDANCE MODE) */
              <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[400px] pr-1">
                {todayLogs.length === 0 ? (
                  <div className="h-56 flex flex-col items-center justify-center text-center p-4 text-zinc-500">
                    <Clock className="w-8 h-8 text-zinc-700 mb-2" />
                    <p className="text-xs font-medium">Belum ada catatan presensi hari ini.</p>
                    <p className="text-[11px] text-zinc-600 mt-0.5">Guru yang diverifikasi kamera akan otomatis tercatat di sini.</p>
                  </div>
                ) : (
                  todayLogs.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-zinc-950 border border-zinc-800/90 rounded-2xl flex items-center justify-between gap-3 hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {item.photo ? (
                          <img
                            src={item.photo}
                            alt={item.teacher?.name || 'Foto'}
                            className="w-10 h-10 rounded-xl object-cover border border-zinc-800 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-emerald-400 font-bold text-sm shrink-0">
                            {item.teacher?.name ? item.teacher.name.charAt(0) : 'G'}
                          </div>
                        )}

                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-semibold text-white truncate">
                            {item.teacher?.name || 'Guru'}
                          </h4>
                          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-0.5">
                            <span className={`px-1.5 py-0.2 rounded font-bold uppercase text-[10px] ${
                              item.type === 'in' 
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            }`}>
                              {item.type === 'in' ? 'Masuk' : 'Pulang'}
                            </span>
                            <span>{format(new Date(item.created_at), 'HH:mm:ss')} WIB</span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Footer Notice */}
            <div className="mt-4 pt-3 border-t border-zinc-800 text-[11px] text-zinc-500 flex items-center justify-between">
              <span>Penyimpanan Ringan (Auto-Purge 7 Hari)</span>
              <span className="text-emerald-400 font-semibold">Tersinkronisasi</span>
            </div>
          </div>
        </section>
      </main>

      {/* 3. MODAL: PENDAFTARAN & SCAN WAJAH GURU (LANGSUNG DARI KIOSK) */}
      {showManageModal && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ScanFace className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Daftarkan Wajah Guru di Kiosk</h3>
              </div>
              <button
                onClick={() => setShowManageModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab selection */}
            <div className="flex border-b border-zinc-800 bg-zinc-950/60 p-1.5 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setManageTab('new');
                  setManageError('');
                  setManageSuccess('');
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
                  manageTab === 'new'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                + Guru Baru & Wajah
              </button>
              <button
                type="button"
                onClick={() => {
                  setManageTab('update');
                  setManageError('');
                  setManageSuccess('');
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
                  manageTab === 'update'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                Scan Ulang Wajah
              </button>
              <button
                type="button"
                onClick={() => {
                  setManageTab('reset');
                  setManageError('');
                  setManageSuccess('');
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
                  manageTab === 'reset'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                Reset Wajah
              </button>
            </div>

            <form onSubmit={handleExecuteManageFace} className="p-5 space-y-4">
              {manageError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{manageError}</span>
                </div>
              )}
              {manageSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{manageSuccess}</span>
                </div>
              )}

              {manageTab === 'new' && (
                <>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Masukkan data guru baru di bawah. Setelah disimpan, sistem akan langsung membuka pemindai wajah di layar utama Kiosk untuk guru ini.
                  </p>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Nama Lengkap Guru *</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Budi Santoso, S.Pd"
                      value={newTeacherName}
                      onChange={(e) => setNewTeacherName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">NIP / Identitas (Opsional)</label>
                    <input
                      type="text"
                      placeholder="Contoh: 198501012010011002"
                      value={newTeacherNip}
                      onChange={(e) => setNewTeacherNip(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </>
              )}

              {manageTab === 'update' && (
                <>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Pilih nama guru yang ingin direkam atau diperbarui biometrik wajahnya, lalu tekan tombol lanjut.
                  </p>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Pilih Guru *</label>
                    <select
                      required
                      value={selectedTeacherId}
                      onChange={(e) => setSelectedTeacherId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">-- Pilih Guru --</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} {t.face_descriptor ? '(✓ Wajah Terdaftar)' : '(⚠️ Belum Ada Wajah)'}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {manageTab === 'reset' && (
                <>
                  <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs text-rose-300 leading-relaxed flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <strong>Perhatian:</strong> Menghapus data biometrik wajah guru dari database sekolah. Setelah direset, guru dapat dipindai ulang kapan saja.
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Pilih Guru yang Ingin Direset Wajahnya *</label>
                    <select
                      required
                      value={selectedTeacherId}
                      onChange={(e) => setSelectedTeacherId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    >
                      <option value="">-- Pilih Guru --</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} {t.face_descriptor ? '(✓ Wajah Terdaftar)' : '(⚠️ Belum Ada Data Wajah)'}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Status Notice */}
              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-[11px] text-zinc-400 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                <span>
                  <strong className="text-zinc-300">Kiosk Terautentikasi:</strong> Tindakan pendaftaran & reset wajah ini dilakukan melalui link khusus pengelolaan biometrik sekolah.
                </span>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isProcessingManage}
                  className={`w-full py-3 text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-lg ${
                    manageTab === 'reset'
                      ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                      : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                  }`}
                >
                  {isProcessingManage ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : manageTab === 'reset' ? (
                    <RotateCcw className="w-4 h-4" />
                  ) : manageTab === 'new' ? (
                    <UserPlus className="w-4 h-4" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                  <span>
                    {manageTab === 'new'
                      ? 'Simpan Guru & Lanjut Pindai Wajah ➔'
                      : manageTab === 'update'
                      ? 'Pilih & Siapkan Pindai Wajah ➔'
                      : 'Reset Data Wajah Guru Ini'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI RESET WAJAH */}
      {kioskResetTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-amber-400 mb-4">
              <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Konfirmasi Reset Wajah</h3>
                <p className="text-xs text-zinc-400">Tindakan ini menghapus data biometrik wajah</p>
              </div>
            </div>

            <p className="text-sm text-zinc-300 leading-relaxed mb-6">
              Yakin ingin mereset data biometrik wajah guru{' '}
              <strong className="text-white font-semibold">{kioskResetTarget.name}</strong>?
              Setelah direset, guru harus merekam wajah kembali untuk dapat melakukan presensi kamera.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setKioskResetTarget(null)}
                disabled={isProcessingManage}
                className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-750 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmKioskReset}
                disabled={isProcessingManage}
                className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-xl shadow-lg shadow-amber-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isProcessingManage ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                <span>Reset Wajah Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS GURU */}
      {kioskDeleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-400 mb-4">
              <div className="p-2.5 bg-rose-500/10 rounded-xl border border-rose-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Konfirmasi Hapus Guru</h3>
                <p className="text-xs text-zinc-400">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>

            <p className="text-sm text-zinc-300 leading-relaxed mb-6">
              Yakin ingin menghapus guru{' '}
              <strong className="text-white font-semibold">{kioskDeleteTarget.name}</strong>?
              Seluruh riwayat presensi yang terkait dengan guru ini juga akan dibersihkan dari basis data.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setKioskDeleteTarget(null)}
                disabled={isDeletingTeacher}
                className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-750 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmKioskDelete}
                disabled={isDeletingTeacher}
                className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-lg shadow-rose-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDeletingTeacher ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Hapus Guru</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
