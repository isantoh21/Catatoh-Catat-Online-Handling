// Supabase Edge Function: waha-proxy
// Secure proxy between frontend and self-hosted WAHA (WhatsApp HTTP API)

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
          message: 'Please provide query parameter "action=start", "action=status", or "action=qr".'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 1. Action: start
    if (action === 'start') {
      // Step A: Create session 'default' (safe if session already exists)
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
        console.warn('Session create warning (session may already exist):', err);
      }

      // Step B: Start session 'default'
      const startRes = await fetch(`${WAHA_BASE_URL}/api/sessions/default/start`, {
        method: 'POST',
        headers: {
          'X-Api-Key': WAHA_API_KEY,
        },
      });

      const resBody = await startRes.text();
      return new Response(resBody, {
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

    return new Response(
      JSON.stringify({
        error: 'Invalid action',
        message: `Action "${action}" is not supported. Supported actions: start, status, qr.`
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
