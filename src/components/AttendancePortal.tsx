import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import TeacherKioskView from './teachers/TeacherKioskView';
import { verifyKioskToken } from '../lib/kioskAuth';
import { checkIsUserPremium } from '../lib/premiumService';
import { Crown, Sparkles } from 'lucide-react';

export default function AttendancePortal() {
  const { userId } = useParams();
  const [schoolSettings, setSchoolSettings] = useState<{ name: string; logo: string } | null>(null);
  const [attendanceSettings, setAttendanceSettings] = useState<any>(null);
  const [isSchoolPremium, setIsSchoolPremium] = useState<boolean | null>(null);

  // Check premium status of the target school
  useEffect(() => {
    let isMounted = true;
    if (userId) {
      checkIsUserPremium(null, userId).then(res => {
        if (isMounted) setIsSchoolPremium(res);
      });
    } else {
      setIsSchoolPremium(true);
    }
    return () => {
      isMounted = false;
    };
  }, [userId]);

  // Fetch school branding and attendance rules
  useEffect(() => {
    const fetchSettings = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const schoolFromUrl = urlParams.get('school');
      const logoFromUrl = urlParams.get('logo');

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

      // Fetch from Supabase
      if (userId) {
        try {
          const scRes = await supabase
            .from('user_settings')
            .select('school_name, school_logo')
            .eq('user_id', userId)
            .maybeSingle();

          if (scRes.data) {
            setSchoolSettings({
              name: scRes.data.school_name || schoolName,
              logo: scRes.data.school_logo || schoolLogo
            });
          }

          const attRes = await supabase
            .from('attendance_settings')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

          if (attRes.data) {
            setAttendanceSettings(attRes.data);
          }
        } catch (e) {
          console.warn('Error fetching settings for kiosk:', e);
        }
      }
    };

    fetchSettings();
  }, [userId]);

  const urlParams = new URLSearchParams(window.location.search);
  const authToken = urlParams.get('auth') || urlParams.get('token');
  
  // Verify token using cryptographically blended verification
  // If invalid or missing, defaults safely to standard 'scan' mode
  const detectedMode = verifyKioskToken(authToken, userId);
  const isManage = detectedMode === 'manage';

  if (isSchoolPremium === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 font-sans text-white">
        <div className="max-w-md w-full p-8 rounded-3xl bg-slate-900 border border-amber-500/30 text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Crown className="w-8 h-8 animate-bounce" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-xs font-black uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Fitur Khusus Akun Premium ⭐</span>
          </div>
          <h2 className="text-xl font-bold">Kiosk Presensi Wajah Guru Terkunci</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Layanan Kiosk Presensi Wajah Guru untuk instansi ini memerlukan akun berstatus <b>Premium</b>. Silakan hubungi administrator Superadmin untuk mengaktifkan akun Anda.
          </p>
        </div>
      </div>
    );
  }

  return (
    <TeacherKioskView
      targetUserId={userId}
      schoolSettings={schoolSettings}
      attendanceSettings={attendanceSettings}
      initialMode={isManage ? 'manage' : 'scan'}
    />
  );
}
