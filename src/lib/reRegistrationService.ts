import { supabase } from './supabaseClient';

export interface ReRegistrationProgram {
  id: string;
  user_id?: string;
  type: 'daftar_ulang' | 'lulus';
  name: string; // contoh: "Daftar Ulang TA 2026/2027", "Kelulusan Angkatan 2026"
  fee: number; // nominal biaya tagihan
  deadline?: string; // batas akhir / deadline pembayaran (format: YYYY-MM-DD)
  requirements?: string; // syarat khusus kelulusan, contoh: "Memberikan 2 buku cerita/APE"
  student_ids: string[]; // daftar ID siswa yang masuk ke kelompok ini
  student_requirements_status?: Record<string, boolean>; // studentId -> true (sudah dipenuhi) / false (belum)
  created_at?: string;
  updated_at?: string;
}

const getStorageKey = (userId?: string) => `catatoh_rereg_programs_${userId || 'global'}`;

let isTableSupported = true;
let isColumnSupported = true;

/**
 * Mengambil daftar kelompok program Daftar Ulang dan Kelulusan milik pengguna.
 * Menggunakan strategi multi-tier: Supabase table -> user_settings -> user_metadata -> localStorage.
 */
export async function getReRegistrationPrograms(userId?: string): Promise<ReRegistrationProgram[]> {
  let activeUserId = userId;
  if (!activeUserId) {
    const { data: { session } } = await supabase.auth.getSession();
    activeUserId = session?.user?.id;
  }

  // 1. Coba ambil dari Supabase tabel `re_registration_programs` jika didukung
  if (activeUserId && isTableSupported) {
    try {
      const { data, error } = await supabase
        .from('re_registration_programs')
        .select('*')
        .eq('user_id', activeUserId)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === 'PGRST205' || error.code === '42P01') {
          isTableSupported = false;
        }
      } else if (Array.isArray(data) && data.length > 0) {
        // Cache ke local storage
        try {
          localStorage.setItem(getStorageKey(activeUserId), JSON.stringify(data));
        } catch (_) {}
        return data as ReRegistrationProgram[];
      }
    } catch (dbErr) {
      isTableSupported = false;
    }
  }

  // 2. Coba ambil dari user_settings di Supabase jika didukung
  if (activeUserId && isColumnSupported) {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('re_registration_programs')
        .eq('user_id', activeUserId)
        .maybeSingle();

      if (error && error.code === '42703') {
        isColumnSupported = false;
      } else if (data?.re_registration_programs && Array.isArray(data.re_registration_programs)) {
        try {
          localStorage.setItem(getStorageKey(activeUserId), JSON.stringify(data.re_registration_programs));
        } catch (_) {}
        return data.re_registration_programs as ReRegistrationProgram[];
      }
    } catch (_) {
      isColumnSupported = false;
    }
  }

    // 3. Coba ambil dari auth user_metadata
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const metaPrograms = session?.user?.user_metadata?.re_registration_programs;
      if (Array.isArray(metaPrograms)) {
        return metaPrograms as ReRegistrationProgram[];
      }
    } catch (_) {}

  // 4. Fallback ke LocalStorage
  try {
    const local = localStorage.getItem(getStorageKey(activeUserId));
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) {}

  return [];
}

/**
 * Menyimpan seluruh daftar program ke penyimpanan.
 */
export async function saveReRegistrationPrograms(
  programs: ReRegistrationProgram[],
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  let activeUserId = userId;
  if (!activeUserId) {
    const { data: { session } } = await supabase.auth.getSession();
    activeUserId = session?.user?.id;
  }

  // 1. Simpan ke LocalStorage seketika untuk responsivitas instan
  try {
    localStorage.setItem(getStorageKey(activeUserId), JSON.stringify(programs));
  } catch (_) {}

  if (!activeUserId) {
    return { success: true };
  }

  // 2. Simpan ke Supabase tabel `re_registration_programs` jika ada
  try {
    // Upsert items satu persatu atau bulk
    for (const prog of programs) {
      await supabase
        .from('re_registration_programs')
        .upsert({
          id: prog.id,
          user_id: activeUserId,
          type: prog.type,
          name: prog.name,
          fee: prog.fee,
          requirements: prog.requirements || '',
          student_ids: prog.student_ids || [],
          student_requirements_status: prog.student_requirements_status || {},
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
    }
  } catch (err) {
    // Abaikan jika tabel belum ada
  }

  // 3. Simpan ke user_settings (kolom re_registration_programs)
  try {
    await supabase
      .from('user_settings')
      .update({ re_registration_programs: programs } as any)
      .eq('user_id', activeUserId);
  } catch (_) {}

  // 4. Simpan ke auth user_metadata
  try {
    await supabase.auth.updateUser({
      data: { re_registration_programs: programs }
    });
  } catch (_) {}

  return { success: true };
}

/**
 * Tambah atau perbarui satu program
 */
export async function saveReRegistrationProgram(
  program: ReRegistrationProgram,
  userId?: string
): Promise<ReRegistrationProgram[]> {
  const current = await getReRegistrationPrograms(userId);
  const existingIdx = current.findIndex(p => p.id === program.id);
  let updated: ReRegistrationProgram[];

  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = {
      ...updated[existingIdx],
      ...program,
      updated_at: new Date().toISOString()
    };
  } else {
    updated = [
      {
        ...program,
        created_at: program.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      ...current
    ];
  }

  await saveReRegistrationPrograms(updated, userId);
  return updated;
}

/**
 * Hapus satu program berdasarkan ID
 */
export async function deleteReRegistrationProgram(
  programId: string,
  userId?: string
): Promise<ReRegistrationProgram[]> {
  let activeUserId = userId;
  if (!activeUserId) {
    const { data: { session } } = await supabase.auth.getSession();
    activeUserId = session?.user?.id;
  }

  // Hapus dari tabel jika ada
  try {
    if (activeUserId) {
      await supabase
        .from('re_registration_programs')
        .delete()
        .eq('id', programId)
        .eq('user_id', activeUserId);
    }
  } catch (_) {}

  const current = await getReRegistrationPrograms(activeUserId);
  const updated = current.filter(p => p.id !== programId);
  await saveReRegistrationPrograms(updated, activeUserId);
  return updated;
}

/**
 * Memperbarui status pemenuhan syarat khusus kelulusan untuk seorang siswa.
 */
export async function updateStudentRequirementStatus(
  programId: string,
  studentId: string,
  fulfilled: boolean,
  userId?: string
): Promise<ReRegistrationProgram | null> {
  const current = await getReRegistrationPrograms(userId);
  const targetProg = current.find(p => p.id === programId);
  if (!targetProg) return null;

  const currentStatus = { ...(targetProg.student_requirements_status || {}) };
  currentStatus[studentId] = fulfilled;

  const updatedProg: ReRegistrationProgram = {
    ...targetProg,
    student_requirements_status: currentStatus,
    updated_at: new Date().toISOString()
  };

  await saveReRegistrationProgram(updatedProg, userId);
  return updatedProg;
}

/**
 * Mengambil seluruh program yang diikuti oleh seorang siswa tertentu.
 */
export function getStudentPrograms(
  studentId: string,
  programs: ReRegistrationProgram[]
): ReRegistrationProgram[] {
  if (!studentId || !programs || programs.length === 0) return [];
  return programs.filter(p => p.student_ids && p.student_ids.includes(studentId));
}
