// Supabase Edge Function: waha-proxy
// Secure proxy between frontend/backend and self-hosted WAHA (WhatsApp HTTP API)

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

    // Helper: get current default session
    const fetchCurrentSession = async () => {
      try {
        const res = await fetch(`${WAHA_BASE_URL}/api/sessions/default`, {
          headers: { 'X-Api-Key': WAHA_API_KEY },
        });
        if (res.ok) {
          return await res.json();
        }
      } catch (err) {
        console.warn('Error fetching current session:', err);
      }
      return null;
    };

    // 1. Action: start or restart
    if (action === 'start' || action === 'restart') {
      const existingSession = await fetchCurrentSession();

      // If action is explicit restart, or session is currently FAILED or STOPPED
      if (action === 'restart' || existingSession?.status === 'FAILED' || existingSession?.status === 'STOPPED') {
        const restartRes = await fetch(`${WAHA_BASE_URL}/api/sessions/default/restart`, {
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
            body: JSON.stringify({ name: 'default' }),
          });
        } catch (err) {
          console.warn('Session create warning:', err);
        }
      }

      // Start session
      const startRes = await fetch(`${WAHA_BASE_URL}/api/sessions/default/start`, {
        method: 'POST',
        headers: {
          'X-Api-Key': WAHA_API_KEY,
        },
      });

      let resData = await startRes.json().catch(() => null);

      // If start resulted in FAILED or error, fallback to restart
      if (!startRes.ok || resData?.status === 'FAILED') {
        const fallbackRestart = await fetch(`${WAHA_BASE_URL}/api/sessions/default/restart`, {
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
      const statusRes = await fetch(`${WAHA_BASE_URL}/api/sessions/default`, {
        method: 'GET',
        headers: {
          'X-Api-Key': WAHA_API_KEY,
        },
      });

      const statusBody = await statusRes.text();
      return new Response(statusBody, {
        status: statusRes.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

    // 3. Action: qr
    if (action === 'qr') {
      const qrRes = await fetch(`${WAHA_BASE_URL}/api/default/auth/qr?format=image`, {
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
      const stopRes = await fetch(`${WAHA_BASE_URL}/api/sessions/default/stop`, {
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
        session: 'default',
        chatId: chatId,
        text: messageText,
      };

      if (fileUrl) {
        wahaTargetUrl = `${WAHA_BASE_URL}/api/sendFile`;
        wahaPayload = {
          session: 'default',
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

      const putRes = await fetch(`${WAHA_BASE_URL}/api/sessions/default`, {
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
      const session = await fetchCurrentSession();
      const currentWebhooks = session?.config?.webhooks || [];
      const primaryUrl = currentWebhooks[0]?.url || '';

      return new Response(
        JSON.stringify({
          success: true,
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
