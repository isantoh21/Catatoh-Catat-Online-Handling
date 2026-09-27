// Supabase Edge Function: waha-proxy
// Secure proxy between frontend/backend and self-hosted WAHA (WhatsApp HTTP API)
// Mendukung isolasi multi-user: Nomor 6285347360359 dan session 'default' eksklusif untuk akun pertama

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
};

// Akun pertama pemilik sah nomor 6285347360359
const PRIMARY_OWNER_ID = 'b68ebc60-867d-4ad8-8026-92a5a7f57b97';
const PRIMARY_PHONE_PREFIX = '6285347360359';

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
          message: 'WAHA_BASE_URL or WAHA_API_KEY secret is not set in Supabase.'
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

    // Resolusi nama session berdasarkan kepemilikan akun
    let sessionName = 'default';
    if (requestedUserId) {
      if (requestedUserId === PRIMARY_OWNER_ID) {
        sessionName = 'default';
      } else {
        const cleanUid = requestedUserId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
        sessionName = requestedSession && requestedSession !== 'default' 
          ? requestedSession 
          : `user_${cleanUid}`;
      }
    } else if (requestedSession) {
      sessionName = requestedSession;
    } else {
      // Jika request tanpa identitas user, jangan bocorkan akun utama ke user lain
      sessionName = 'unassigned';
    }

    // Jika request unassigned untuk status/qr, kembalikan STOPPED agar akun lain tidak melihat nomor pemilik
    if (sessionName === 'unassigned') {
      if (action === 'status') {
        return new Response(
          JSON.stringify({
            name: 'unassigned',
            status: 'STOPPED',
            me: null,
            message: 'Silakan login dan hubungkan WhatsApp untuk akun Anda.'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (action === 'qr') {
        return new Response('User belum terautentikasi', { status: 401, headers: corsHeaders });
      }
    }

    // Helper: get current session data
    const fetchCurrentSession = async (sess: string) => {
      try {
        const res = await fetch(`${WAHA_BASE_URL}/api/sessions/${sess}`, {
          headers: { 'X-Api-Key': WAHA_API_KEY },
        });
        if (res.ok) {
          const data = await res.json();
          // Perlindungan: jangan pernah kirimkan data nomor 6285347360359 ke akun selain PRIMARY_OWNER_ID
          if (requestedUserId && requestedUserId !== PRIMARY_OWNER_ID && data.me?.id?.includes(PRIMARY_PHONE_PREFIX)) {
            return {
              name: sess,
              status: 'STOPPED',
              me: null,
            };
          }
          return data;
        }
      } catch (err) {
        console.warn(`Error fetching session ${sess}:`, err);
      }
      return null;
    };

    // 1. Action: start or restart
    if (action === 'start' || action === 'restart') {
      const existingSession = await fetchCurrentSession(sessionName);

      // If action is explicit restart, or session is currently FAILED or STOPPED
      if (action === 'restart' || existingSession?.status === 'FAILED' || existingSession?.status === 'STOPPED') {
        const restartRes = await fetch(`${WAHA_BASE_URL}/api/sessions/${sessionName}/restart`, {
          method: 'POST',
          headers: {
            'X-Api-Key': WAHA_API_KEY,
          },
        });

        if (restartRes.ok) {
          const restartData = await restartRes.text();
          return new Response(restartData, {
            status: restartRes.status,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
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
            body: JSON.stringify({ name: sessionName }),
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

      // If start resulted in FAILED or error, fallback to restart
      if (!startRes.ok || resData?.status === 'FAILED') {
        const fallbackRestart = await fetch(`${WAHA_BASE_URL}/api/sessions/${sessionName}/restart`, {
          method: 'POST',
          headers: {
            'X-Api-Key': WAHA_API_KEY,
          },
        });
        const fallbackText = await fallbackRestart.text();
        return new Response(fallbackText, {
          status: fallbackRestart.status,
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
        // Jika sesi belum dibuat di WAHA, kembalikan STOPPED
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
      // Filter proteksi nomor pemilik pertama
      if (requestedUserId && requestedUserId !== PRIMARY_OWNER_ID && statusData.me?.id?.includes(PRIMARY_PHONE_PREFIX)) {
        return new Response(
          JSON.stringify({
            name: sessionName,
            status: 'STOPPED',
            me: null,
            message: 'Nomor WhatsApp belum terhubung pada akun ini.'
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

    // 5. Action: sendText (Outbound WhatsApp Messaging)
    if (action === 'sendText') {
      const body = await req.json().catch(() => ({}));
      let rawTo = (body.to || body.chatId || '').toString();
      let cleanDigits = rawTo.replace(/\D/g, '');
      if (cleanDigits.startsWith('0')) cleanDigits = '62' + cleanDigits.slice(1);
      else if (cleanDigits.startsWith('8')) cleanDigits = '62' + cleanDigits;

      if (!cleanDigits) {
        return new Response(
          JSON.stringify({ success: false, error: 'Nomor WhatsApp tujuan (to) wajib diisi' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
      return new Response(
        JSON.stringify({
          success: sendRes.ok,
          status: sendRes.status,
          data: sendData,
        }),
        {
          status: sendRes.ok ? 200 : sendRes.status,
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

      // Cegah akun lain menimpa session 'default' milik PRIMARY_OWNER_ID
      if (sessionName === 'default' && requestedUserId && requestedUserId !== PRIMARY_OWNER_ID) {
        return new Response(
          JSON.stringify({ success: false, error: 'Anda tidak memiliki hak akses mengubah webhook sesi ini.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        message: `Action "${action}" is not supported. Supported actions: start, restart, status, qr, stop, sendText, setWebhook, getWebhook.`
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
