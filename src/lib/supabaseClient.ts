import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lzvrhtaewonmpsaiezai.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6dnJodGFld29ubXBzYWllemFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4MDE5NDQsImV4cCI6MjEwMzM3Nzk0NH0.UfWotWAZQjaqTTjoa5GKS5dq1Zda3V6wQlaCpHRNGI8';

// Klien aplikasi utama untuk sekolah/tenant
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Klien terisolasi khusus Super Admin agar tidak mencampuri sesi login aplikasi utama sekolah
export const superAdminSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'catatoh_superadmin_auth_token',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  }
});
