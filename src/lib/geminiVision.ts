export interface GeminiVisionCandidate {
  id: string;
  name: string;
  nip?: string;
  photo?: string;
  profile_picture?: string;
}

export interface GeminiVisionVerifyResult {
  isHumanFaceDetected: boolean;
  isRealPerson: boolean;
  matched: boolean;
  matchedTeacherId: string;
  matchedTeacherName: string;
  confidence: number;
  livenessReason: string;
  greeting: string;
}

export interface GeminiRegisterResult {
  isValidFace: boolean;
  faceCount: number;
  feedback: string;
  visualProfile: string;
}

/**
 * Check if the Gemini AI Vision server endpoint is active and healthy
 */
export async function checkGeminiHealth(): Promise<{ status: string; hasGeminiKey: boolean }> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return { status: 'error', hasGeminiKey: false };
  }
}

/**
 * Verify live kiosk attendee using Google Gemini 2.5 Flash Multimodal Vision
 */
export async function verifyAttendanceWithGemini(params: {
  liveImage: string;
  candidates: GeminiVisionCandidate[];
  attendanceType: 'in' | 'out';
  schoolName?: string;
  role?: 'teacher' | 'student';
}): Promise<{
  success: boolean;
  data?: GeminiVisionVerifyResult;
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

    const res = await fetch('/api/gemini/verify-attendance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Server responded with ${res.status}`);
    }

    const json = await res.json();
    return json;
  } catch (err: any) {
    console.warn('Gemini Vision attendance verification failed:', err);
    return {
      success: false,
      error: err.name === 'AbortError' ? 'Koneksi ke Gemini AI timeout' : err.message || 'Gagal memproses AI',
    };
  }
}

/**
 * Analyze and validate a face photo when registering or updating a teacher
 */
export async function registerFaceWithGemini(params: {
  image: string;
  teacherName?: string;
  role?: 'teacher' | 'student';
}): Promise<{
  success: boolean;
  data?: GeminiRegisterResult;
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch('/api/gemini/register-face', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Server responded with ${res.status}`);
    }

    const json = await res.json();
    return json;
  } catch (err: any) {
    console.warn('Gemini Face Registration check failed:', err);
    return {
      success: false,
      error: err.name === 'AbortError' ? 'Koneksi ke Gemini AI timeout' : err.message || 'Gagal menganalisis foto',
    };
  }
}

/**
 * Generate a personalized warm Text-to-Speech greeting from Gemini for attendance
 */
export async function generateGeminiGreeting(params: {
  name: string;
  attendanceType: 'in' | 'out';
  time?: string;
  schoolName?: string;
  role?: 'teacher' | 'student';
}): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s fast response

    const res = await fetch('/api/gemini/generate-greeting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.greeting && typeof data.greeting === 'string') {
        return data.greeting;
      }
    }
  } catch (e) {
    // Fail silently to local fallback
  }

  const isDatang = params.attendanceType === 'in';
  const isStudent = params.role === 'student';
  if (isStudent) {
    return isDatang
      ? `Selamat datang ${params.name || 'Siswa'}, absensi hadirmu berhasil dicatat. Semangat belajar hari ini!`
      : `Terima kasih ${params.name || 'Siswa'}, absensi pulangmu tercatat. Hati-hati di jalan dan selamat istirahat!`;
  }
  return isDatang
    ? `Selamat datang ${params.name || 'Bapak/Ibu Guru'}, absensi datang berhasil dicatat. Selamat bertugas!`
    : `Terima kasih ${params.name || 'Bapak/Ibu Guru'}, absensi pulang berhasil dicatat. Selamat beristirahat dan hati-hati di jalan!`;
}

