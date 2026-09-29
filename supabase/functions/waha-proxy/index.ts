// Supabase Edge Function: waha-proxy
// Secure proxy between frontend/backend and self-hosted WAHA (WhatsApp HTTP API)
// Mendukung isolasi multi-user secara transparan berbasis user ID

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const WAHA_BASE_URL = Deno.env.get('WAHA_BASE_URL')?.trim().replace(/\/+$/, '');
    const WAHA_API_KEY = Deno.env.get('WAHA_API_KEY')?.trim();

    if (!WAHA_BASE_URL || !WAHA_API_KEY) {
      return new Response(
        JSON.stringify({
          error: 'Configuration Error',
          message: 'WhatsApp Gateway configuration error: secrets not configured.'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const requestedUserId = url.searchParams.get('userId');
    const requestedSession = url.searchParams.get('session');

    if (!action) {
      return new Response(
        JSON.stringify({
          error: 'Missing action parameter',
          message: 'Please provide query parameter "action=start", "action=status", "action=qr", "action=sendText", or "action=setWebhook".'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Resolusi nama session unik per user agar setiap akun sekolah terisolasi penuh
    let sessionName = 'unassigned';
    if (requestedUserId) {
      const cleanUid = requestedUserId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
      sessionName = requestedSession && requestedSession !== 'default' 
        ? requestedSession 
        : `user_${cleanUid}`;
    } else if (requestedSession && requestedSession !== 'default') {
      sessionName = requestedSession;
    } else {
      sessionName = 'unassigned';
    }

    // Proteksi: Sesi 'default' adalah sesi milik website lain di server WAHA.
    // Catatoh hanya boleh menggunakan sesi per-user yang terisolasi (user_<uid>).
    if (sessionName === 'default' || sessionName === 'unassigned') {
      if (action === 'status') {
        return new Response(
          JSON.stringify({
            name: sessionName,
            status: 'STOPPED',
            me: null,
            message: 'Silakan login dan hubungkan WhatsApp untuk akun Anda.'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (action === 'qr') {
        return new Response('User belum terautentikasi atau sesi tidak valid', { status: 401, headers: corsHeaders });
      }
      if (action === 'logout' || action === 'reset' || action === 'stop') {
        return new Response(
          JSON.stringify({ success: true, message: 'Tidak ada sesi WhatsApp aktif yang terhubung.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (action === 'sendText' || action === 'setWebhook') {
        return new Response(
          JSON.stringify({ success: false, error: 'Sesi default tidak dapat digunakan di Catatoh. Gunakan sesi user Anda.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Helper: get current session data
    const fetchCurrentSession = async (sess: string) => {
      try {
        const res = await fetch(`${WAHA_BASE_URL}/api/sessions/${sess}`, {
          headers: { 'X-Api-Key': WAHA_API_KEY },
        });
        if (res.ok) {
          return await res.json();
        }
      } catch (err) {
        console.warn(`Error fetching session ${sess}:`, err);
      }
      return null;
    };

    // 1. Action: start, restart, logout, or reset
    if (action === 'logout' || action === 'reset') {
      try {
        const logoutRes = await fetch(`${WAHA_BASE_URL}/api/sessions/${sessionName}/logout`, {
          method: 'POST',
          headers: { 'X-Api-Key': WAHA_API_KEY },
        });

        if (logoutRes.ok || logoutRes.status === 404) {
          const logoutData = await logoutRes.text().catch(() => '{}');
          return new Response(logoutData || JSON.stringify({ success: true, message: 'Sesi WhatsApp berhasil diputuskan.' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Fallback jika logout gagal: coba panggil stop
        const stopRes = await fetch(`${WAHA_BASE_URL}/api/sessions/${sessionName}/stop`, {
          method: 'POST',
          headers: { 'X-Api-Key': WAHA_API_KEY },
        });
        const stopData = await stopRes.text().catch(() => '{}');
        return new Response(stopData || JSON.stringify({ success: true, message: 'Sesi WhatsApp dihentikan.' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (action === 'start' || action === 'restart') {
      const existingSession = await fetchCurrentSession(sessionName);

      // Jika session FAILED (misal di-logout dari HP) atau action adalah explicit restart:
      // Panggil WAHA /logout agar auth credentials lama dibersihkan dan kode QR baru langsung diterbitkan
      if (action === 'restart' || existingSession?.status === 'FAILED') {
        try {
          const cleanLogoutRes = await fetch(`${WAHA_BASE_URL}/api/sessions/${sessionName}/logout`, {
            method: 'POST',
            headers: { 'X-Api-Key': WAHA_API_KEY },
          });

          if (cleanLogoutRes.ok) {
            const restartData = await cleanLogoutRes.text();
            return new Response(restartData, {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
              },
            });
          }
        } catch (e) {
          console.warn('Logout fallback error:', e);
        }

        // Fallback jika logout gagal
        const restartRes = await fetch(`${WAHA_BASE_URL}/api/sessions/${sessionName}/restart`, {
          method: 'POST',
          headers: { 'X-Api-Key': WAHA_API_KEY },
        });

        if (restartRes.ok) {
          const restartData = await restartRes.text();
          return new Response(restartData, {
            status: restartRes.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // If session does not exist yet, create it
      if (!existingSession) {
        try {
          await fetch(`${WAHA_BASE_URL}/api/sessions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Api-Key': WAHA_API_KEY,
            },
            body: JSON.stringify({
              name: sessionName,
              config: {
                webhooks: [
                  {
                    url: `https://catatoh.vercel.app/api/webhook/whatsapp?userId=${requestedUserId || ''}`,
                    events: ['message'],
                  },
                ],
              },
            }),
          });
        } catch (err) {
          console.warn('Session create warning:', err);
        }
      }

      // Start session
      const startRes = await fetch(`${WAHA_BASE_URL}/api/sessions/${sessionName}/start`, {
        method: 'POST',
        headers: {
          'X-Api-Key': WAHA_API_KEY,
        },
      });

      let resData = await startRes.json().catch(() => null);

      // If start resulted in FAILED or error, fallback to clean logout
      if (!startRes.ok || resData?.status === 'FAILED') {
        const fallbackLogout = await fetch(`${WAHA_BASE_URL}/api/sessions/${sessionName}/logout`, {
          method: 'POST',
          headers: {
            'X-Api-Key': WAHA_API_KEY,
          },
        });
        const fallbackText = await fallbackLogout.text();
        return new Response(fallbackText, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }

      return new Response(JSON.stringify(resData), {
        status: startRes.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

    // 2. Action: status
    if (action === 'status') {
      const statusRes = await fetch(`${WAHA_BASE_URL}/api/sessions/${sessionName}`, {
        method: 'GET',
        headers: {
          'X-Api-Key': WAHA_API_KEY,
        },
      });

      if (!statusRes.ok) {
        // Jika sesi belum diaktifkan di WAHA, kembalikan STOPPED
        return new Response(
          JSON.stringify({
            name: sessionName,
            status: 'STOPPED',
            me: null,
            message: 'Sesi belum diaktifkan. Klik tombol untuk mulai.'
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      const statusData = await statusRes.json().catch(() => ({}));
      return new Response(JSON.stringify(statusData), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

    // 3. Action: qr
    if (action === 'qr') {
      const qrRes = await fetch(`${WAHA_BASE_URL}/api/${sessionName}/auth/qr?format=image`, {
        method: 'GET',
        headers: {
          'X-Api-Key': WAHA_API_KEY,
        },
      });

      if (!qrRes.ok) {
        const errorText = await qrRes.text();
        return new Response(errorText, {
          status: qrRes.status,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }

      const qrBuffer = await qrRes.arrayBuffer();
      return new Response(qrBuffer, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'image/png',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    // 4. Action: stop
    if (action === 'stop') {
      const stopRes = await fetch(`${WAHA_BASE_URL}/api/sessions/${sessionName}/stop`, {
        method: 'POST',
        headers: {
          'X-Api-Key': WAHA_API_KEY,
        },
      });

      const stopBody = await stopRes.text();
      return new Response(stopBody, {
        status: stopRes.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

    // 5. Action: checkNumber (Cek apakah nomor terdaftar di WhatsApp sebelum kirim)
    if (action === 'checkNumber' || action === 'checkContact') {
      const phoneParam = url.searchParams.get('phone') || '';
      let cleanDigits = phoneParam.replace(/\D/g, '');
      if (cleanDigits.startsWith('0')) cleanDigits = '62' + cleanDigits.slice(1);
      else if (cleanDigits.startsWith('8')) cleanDigits = '62' + cleanDigits;

      if (!cleanDigits || cleanDigits.length < 10) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            numberExists: false, 
            error: `Nomor WhatsApp tidak valid (hanya ${cleanDigits ? cleanDigits.length : 0} digit, minimal 10 digit)`, 
            code: 'INVALID_NUMBER_LENGTH' 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        const checkRes = await fetch(`${WAHA_BASE_URL}/api/contacts/check-exists?phone=${cleanDigits}&session=${sessionName}`, {
          headers: { 'X-Api-Key': WAHA_API_KEY },
        });

        if (!checkRes.ok) {
          const errorText = await checkRes.text();
          return new Response(
            JSON.stringify({ success: false, numberExists: false, error: errorText }),
            { status: checkRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const checkData = await checkRes.json();
        return new Response(
          JSON.stringify({
            success: true,
            numberExists: checkData.numberExists ?? false,
            chatId: checkData.chatId,
            data: checkData
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({ success: false, numberExists: false, error: err.message || 'Gagal memeriksa kontak' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 6. Action: sendText (Outbound WhatsApp Messaging with Pre-Flight Validation)
    if (action === 'sendText') {
      const body = await req.json().catch(() => ({}));
      let rawTo = (body.to || body.chatId || '').toString();
      let cleanDigits = rawTo.replace(/\D/g, '');
      if (cleanDigits.startsWith('0')) cleanDigits = '62' + cleanDigits.slice(1);
      else if (cleanDigits.startsWith('8')) cleanDigits = '62' + cleanDigits;

      // 1. Validasi panjang digit nomor (Nomor Indonesia/Internasional minimal 10 digit)
      if (!cleanDigits || cleanDigits.length < 10) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Nomor WhatsApp tidak valid (hanya ${cleanDigits ? cleanDigits.length : 0} digit, minimal 10 digit)`,
            code: 'INVALID_NUMBER_LENGTH' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (cleanDigits.length > 16) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Nomor WhatsApp terlalu panjang (${cleanDigits.length} digit, maksimal 16 digit)`,
            code: 'INVALID_NUMBER_LENGTH' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 2. Cek apakah session WhatsApp aktif / WORKING
      const currentSessionData = await fetchCurrentSession(sessionName);
      if (!currentSessionData || currentSessionData.status !== 'WORKING') {
        return new Response(
          JSON.stringify({
            success: false,
            error: `WhatsApp belum terhubung (Status: ${currentSessionData?.status || 'OFFLINE'}). Silakan scan QR WhatsApp terlebih dahulu.`,
            code: 'SESSION_NOT_WORKING'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 3. Pre-flight check: Verifikasi apakah nomor benar-benar terdaftar di WhatsApp
      try {
        const checkRes = await fetch(`${WAHA_BASE_URL}/api/contacts/check-exists?phone=${cleanDigits}&session=${sessionName}`, {
          headers: { 'X-Api-Key': WAHA_API_KEY },
        });
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData && checkData.numberExists === false) {
            return new Response(
              JSON.stringify({
                success: false,
                error: `Nomor WhatsApp (${cleanDigits}) tidak ditemukan atau belum terdaftar di WhatsApp.`,
                code: 'NUMBER_NOT_FOUND',
                data: checkData
              }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      } catch (checkErr) {
        console.warn('Gagal pre-flight check-exists, lanjut mencoba kirim:', checkErr);
      }

      const chatId = cleanDigits.includes('@') ? cleanDigits : `${cleanDigits}@c.us`;
      const messageText = body.message || body.text || '';
      const fileUrl = body.file;

      let wahaTargetUrl = `${WAHA_BASE_URL}/api/sendText`;
      let wahaPayload: any = {
        session: sessionName,
        chatId: chatId,
        text: messageText,
      };

      if (fileUrl) {
        wahaTargetUrl = `${WAHA_BASE_URL}/api/sendFile`;
        wahaPayload = {
          session: sessionName,
          chatId: chatId,
          file: typeof fileUrl === 'string' ? { url: fileUrl } : fileUrl,
          caption: messageText,
        };
      }

      const sendRes = await fetch(wahaTargetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': WAHA_API_KEY,
        },
        body: JSON.stringify(wahaPayload),
      });

      const sendData = await sendRes.json().catch(() => ({}));
      const isSuccess = sendRes.ok && (!sendData?.error);
      const errorMessage = sendData?.error || sendData?.message || (sendRes.ok ? undefined : 'Gagal mengirim pesan WhatsApp via Gateway');

      return new Response(
        JSON.stringify({
          success: isSuccess,
          status: sendRes.status,
          error: errorMessage,
          data: sendData,
        }),
        {
          status: isSuccess ? 200 : (sendRes.status >= 400 ? sendRes.status : 400),
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 6. Action: setWebhook (Register Inbound Webhook on WAHA)
    if (action === 'setWebhook') {
      const body = await req.json().catch(() => ({}));
      const webhookUrl = body.url || body.webhookUrl || '';

      if (!webhookUrl) {
        return new Response(
          JSON.stringify({ success: false, error: 'URL webhook wajib diisi' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const putRes = await fetch(`${WAHA_BASE_URL}/api/sessions/${sessionName}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': WAHA_API_KEY,
        },
        body: JSON.stringify({
          config: {
            webhooks: [
              {
                url: webhookUrl,
                events: ['message'],
              },
            ],
          },
        }),
      });

      const putData = await putRes.json().catch(() => ({}));
      return new Response(
        JSON.stringify({
          success: putRes.ok,
          session: sessionName,
          webhookUrl,
          data: putData,
        }),
        {
          status: putRes.ok ? 200 : putRes.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 7. Action: getWebhook (Inspect current Inbound Webhook)
    if (action === 'getWebhook') {
      const session = await fetchCurrentSession(sessionName);
      const currentWebhooks = session?.config?.webhooks || [];
      const primaryUrl = currentWebhooks[0]?.url || '';

      return new Response(
        JSON.stringify({
          success: true,
          session: sessionName,
          webhookUrl: primaryUrl,
          webhooks: currentWebhooks,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        error: 'Invalid action',
        message: `Action "${action}" is not supported. Supported actions: start, restart, status, qr, stop, sendText, setWebhook, getWebhook, logout, reset.`
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: 'Proxy Error',
        message: err?.message || String(err)
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
