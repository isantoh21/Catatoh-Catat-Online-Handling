import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import StudentAttendanceKiosk from './StudentAttendanceKiosk';
import StudentFaceRegistration from './StudentFaceRegistration';
import { verifyKioskToken } from '../../lib/kioskAuth';

interface StudentAttendancePortalProps {
  initialMode?: 'attendance' | 'register';
}

export default function StudentAttendancePortal({ initialMode }: StudentAttendancePortalProps) {
  const { userId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [schoolSettings, setSchoolSettings] = useState<{ name: string; logo: string } | null>(null);

  // Determine mode from path, prop, or query param
  const urlMode = searchParams.get('mode');
  const authToken = searchParams.get('auth') || searchParams.get('token');
  const isRegisterPath = location.pathname.startsWith('/daftar-wajah-siswa');

  const detectedAuthMode = verifyKioskToken(authToken, userId);
  
  const defaultMode = isRegisterPath || initialMode === 'register' || urlMode === 'register' || detectedAuthMode === 'manage'
    ? 'register'
    : 'attendance';

  const [mode, setMode] = useState<'attendance' | 'register'>(defaultMode);

  useEffect(() => {
    if (isRegisterPath || initialMode === 'register' || urlMode === 'register') {
      setMode('register');
    } else if (urlMode === 'attendance' || urlMode === 'scan') {
      setMode('attendance');
    }
  }, [isRegisterPath, initialMode, urlMode]);

  // Fetch school branding and settings
  useEffect(() => {
    const fetchSettings = async () => {
      const schoolFromUrl = searchParams.get('school');
      const logoFromUrl = searchParams.get('logo');

      let schoolName = schoolFromUrl || '';
      let schoolLogo = logoFromUrl || '';

      if (userId) {
        if (!schoolName) {
          schoolName = localStorage.getItem('cached_school_' + userId) || '';
        }
        if (!schoolLogo) {
          schoolLogo = localStorage.getItem('cached_logo_' + userId) || '';
        }
      }

      if (schoolName || schoolLogo) {
        setSchoolSettings({ name: schoolName, logo: schoolLogo });
      }

      if (userId) {
        try {
          const scRes = await supabase
            .from('user_settings')
            .select('school_name, school_logo')
            .eq('user_id', userId)
            .maybeSingle();

          if (scRes.data) {
            const finalName = scRes.data.school_name || schoolName;
            const finalLogo = scRes.data.school_logo || schoolLogo;
            setSchoolSettings({ name: finalName, logo: finalLogo });
            if (finalName) localStorage.setItem('cached_school_' + userId, finalName);
            if (finalLogo) localStorage.setItem('cached_logo_' + userId, finalLogo);
          }
        } catch (e) {
          console.warn('Error fetching school settings for student kiosk:', e);
        }
      }
    };

    fetchSettings();
  }, [userId, searchParams]);

  const handleSwitchMode = (newMode: 'attendance' | 'register') => {
    setMode(newMode);
    const params = new URLSearchParams(window.location.search);
    params.set('mode', newMode);
    navigate({ search: params.toString() }, { replace: true });
  };

  if (mode === 'register') {
    return (
      <StudentFaceRegistration
        targetUserId={userId}
        schoolSettings={schoolSettings}
        onSwitchToAttendance={() => handleSwitchMode('attendance')}
      />
    );
  }

  return (
    <StudentAttendanceKiosk
      targetUserId={userId}
      schoolSettings={schoolSettings}
      onSwitchToRegister={() => handleSwitchMode('register')}
    />
  );
}
