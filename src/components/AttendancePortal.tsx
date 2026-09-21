import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import TeacherKioskView from './teachers/TeacherKioskView';
import { verifyKioskToken } from '../lib/kioskAuth';

export default function AttendancePortal() {
  const { userId } = useParams();
  const [schoolSettings, setSchoolSettings] = useState<{ name: string; logo: string } | null>(null);
  const [attendanceSettings, setAttendanceSettings] = useState<any>(null);

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

  return (
    <TeacherKioskView
      targetUserId={userId}
      schoolSettings={schoolSettings}
      attendanceSettings={attendanceSettings}
      initialMode={isManage ? 'manage' : 'scan'}
    />
  );
}
