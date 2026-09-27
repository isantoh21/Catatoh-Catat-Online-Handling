@echo off
echo ========================================================
echo   Supabase Edge Function: waha-proxy Deployment Script
echo   Project Ref: lzvrhtaewonmpsaiezai
echo ========================================================
echo.

REM Pastikan user sudah login ke Supabase CLI
echo [1/3] Memeriksa autentikasi Supabase CLI...
echo Jika belum login, jalankan: npx supabase login
echo.

echo [2/3] Mengatur Secrets di Supabase...
call npx supabase secrets set WAHA_BASE_URL="http://13.140.178.167:29001" WAHA_API_KEY="askdj2934u9jd923dj3jdoi23nuiurio32od23oed2omi3290rmmoiejrw" --project-ref lzvrhtaewonmpsaiezai

echo.
echo [3/3] Deploy Supabase Edge Function 'waha-proxy' (--no-verify-jwt)...
call npx supabase functions deploy waha-proxy --project-ref lzvrhtaewonmpsaiezai --no-verify-jwt

echo.
echo ========================================================
echo   Proses Selesai!
echo   URL: https://lzvrhtaewonmpsaiezai.supabase.co/functions/v1/waha-proxy
echo ========================================================
pause
