import { supabase } from './supabaseClient';

export interface SchoolReceiptProfile {
  schoolName: string;
  schoolLogo: string | null;
  city: string;
  principalName: string;
  treasurerName: string;
  adminSignature: string | null;
  schoolStamp: string | null;
}

/**
 * Mendapatkan profil sekolah dari cache lokal (cepat & langsung untuk render awal / fallback)
 */
export const getCachedSchoolProfile = (userId?: string, currentUser?: any): SchoolReceiptProfile => {
  const uid = userId || currentUser?.id || '';
  const rawEmail = currentUser?.email || '';
  const userName = currentUser?.user_metadata?.full_name || currentUser?.user_metadata?.admin_name || currentUser?.user_metadata?.name || (rawEmail ? rawEmail.split('@')[0] : '') || 'Admin';
  const formattedUserName = userName ? (userName.charAt(0).toUpperCase() + userName.slice(1)) : 'Bendahara Sekolah';

  const cachedSchool = uid ? localStorage.getItem('schoolName_' + uid) : null;
  const cachedLogo = uid ? (localStorage.getItem('schoolLogo_' + uid) || localStorage.getItem('cached_logo_' + uid)) : null;
  const cachedCity = uid ? localStorage.getItem('schoolCity_' + uid) : null;
  const cachedPrincipal = uid ? localStorage.getItem('principalName_' + uid) : null;
  const cachedSignature = uid ? localStorage.getItem('adminSignature_' + uid) : null;
  const cachedStamp = uid ? localStorage.getItem('schoolStamp_' + uid) : null;

  const schoolName = cachedSchool || currentUser?.user_metadata?.school_name || formattedUserName || 'Lembaga Pendidikan';
  const city = cachedCity || currentUser?.user_metadata?.city || 'Indonesia';
  const principalName = cachedPrincipal || currentUser?.user_metadata?.principal_name || '';
  const treasurerName = formattedUserName;
  const adminSignature = cachedSignature || currentUser?.user_metadata?.admin_signature || null;
  const schoolStamp = cachedStamp || currentUser?.user_metadata?.school_stamp || null;

  return {
    schoolName,
    schoolLogo: cachedLogo || null,
    city,
    principalName,
    treasurerName,
    adminSignature,
    schoolStamp
  };
};

/**
 * Mengambil profil sekolah lengkap langsung dari database Supabase (online/global)
 * dan menyelaraskannya ke cache lokal secara otomatis sehingga tanda tangan dan stempel
 * dapat dibuka dan dicetak di komputer manapun di dunia.
 */
export const fetchSchoolProfileOnline = async (userId?: string, currentUser?: any): Promise<SchoolReceiptProfile> => {
  const targetUid = userId || currentUser?.id;
  const fallback = getCachedSchoolProfile(targetUid, currentUser);
  if (!targetUid) return fallback;

  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', targetUid)
      .maybeSingle();

    if (!error && data) {
      const schoolName = data.school_name || fallback.schoolName;
      const schoolLogo = data.school_logo || fallback.schoolLogo;
      const city = data.city_name || fallback.city;
      const principalName = (data as any).principal_name || fallback.principalName;
      const treasurerName = data.admin_name || fallback.treasurerName;
      const adminSignature = data.admin_signature || fallback.adminSignature;
      const schoolStamp = data.school_stamp || fallback.schoolStamp;

      // Sinkronkan ke localStorage perangkat yang sedang aktif
      if (schoolName) localStorage.setItem('schoolName_' + targetUid, schoolName);
      if (schoolLogo) localStorage.setItem('schoolLogo_' + targetUid, schoolLogo);
      if (city) localStorage.setItem('schoolCity_' + targetUid, city);
      if (principalName) localStorage.setItem('principalName_' + targetUid, principalName);
      if (treasurerName) localStorage.setItem('adminName_' + targetUid, treasurerName);
      if (adminSignature) localStorage.setItem('adminSignature_' + targetUid, adminSignature);
      if (schoolStamp) localStorage.setItem('schoolStamp_' + targetUid, schoolStamp);

      return {
        schoolName,
        schoolLogo,
        city,
        principalName,
        treasurerName,
        adminSignature,
        schoolStamp
      };
    }
  } catch (err) {
    console.warn('Gagal memuat profil sekolah online dari user_settings:', err);
  }

  return fallback;
};
