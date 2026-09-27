export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to, message, file, appkey, authkey, apiUrl, userId } = req.body || {};

    if (!to || !message) {
      return res.status(400).json({
        success: false,
        error: 'Nomor tujuan (to) dan pesan (message) wajib diisi.',
      });
    }

    let cleanTo = to.toString().replace(/\D/g, '');
    if (cleanTo.startsWith('0')) cleanTo = '62' + cleanTo.slice(1);
    else if (cleanTo.startsWith('8')) cleanTo = '62' + cleanTo;

    // Prioritas 1: Gunakan Supabase Edge Function WAHA Proxy
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://lzvrhtaewonmpsaiezai.supabase.co';
    const wahaProxyUrl = userId 
      ? `${supabaseUrl}/functions/v1/waha-proxy?action=sendText&userId=${encodeURIComponent(userId)}`
      : `${supabaseUrl}/functions/v1/waha-proxy?action=sendText`;

    try {
      const proxyRes = await fetch(wahaProxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: cleanTo,
          message,
          file,
        }),
      });

      if (proxyRes.ok) {
        const proxyData = await proxyRes.json().catch(() => ({}));
        return res.status(200).json({
          success: true,
          provider: 'waha-proxy',
          data: proxyData,
        });
      }
    } catch (proxyErr) {
      console.warn('Waha proxy send error, mencoba fallback langsung:', proxyErr);
    }

    // Prioritas 2: Direct WAHA VPS jika env tersedia
    const wahaBaseUrl = (process.env.WAHA_BASE_URL || 'http://13.140.178.167:29001').replace(/\/+$/, '');
    const wahaApiKey = process.env.WAHA_API_KEY || 'askdj2934u9jd923dj3jdoi23nuiurio32od23oed2omi3290rmmoiejrw';

    if (wahaBaseUrl && wahaApiKey) {
      const chatId = `${cleanTo}@c.us`;
      const wahaEndpoint = file ? `${wahaBaseUrl}/api/sendFile` : `${wahaBaseUrl}/api/sendText`;
      const wahaBody = file
        ? { session: 'default', chatId, file: typeof file === 'string' ? { url: file } : file, caption: message }
        : { session: 'default', chatId, text: message };

      const directRes = await fetch(wahaEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': wahaApiKey,
        },
        body: JSON.stringify(wahaBody),
      });

      if (directRes.ok) {
        const directJson = await directRes.json().catch(() => ({}));
        return res.status(200).json({
          success: true,
          provider: 'waha-direct',
          data: directJson,
        });
      }
    }

    // Prioritas 3: Fallback ke legacy gateway jika appkey & authkey diberikan
    if (appkey && authkey) {
      const targetUrl = apiUrl || 'https://app.starsender.online/api/sendText';
      const formData = new URLSearchParams();
      formData.append('appkey', appkey);
      formData.append('authkey', authkey);
      formData.append('to', cleanTo);
      formData.append('message', message);
      if (file) formData.append('file', file);

      const legacyRes = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Catatoh-SPP-Gateway/1.0',
        },
        body: formData.toString(),
      });

      const responseText = await legacyRes.text();
      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { raw: responseText };
      }

      return res.status(200).json({
        success: legacyRes.ok,
        provider: 'legacy-gateway',
        status: legacyRes.status,
        data: responseData,
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Tidak ada gateway WhatsApp yang aktif untuk mengirim pesan.',
    });
  } catch (error: any) {
    console.error('WhatsApp Send Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Gagal mengirim pesan WhatsApp.',
    });
  }
}
