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

    if (cleanTo.length < 10) {
      return res.status(400).json({
        success: false,
        error: `Nomor WhatsApp tidak valid (hanya ${cleanTo.length} digit, minimal 10 digit)`,
        code: 'INVALID_NUMBER_LENGTH'
      });
    }

    if (cleanTo.length > 16) {
      return res.status(400).json({
        success: false,
        error: `Nomor WhatsApp terlalu panjang (${cleanTo.length} digit, maksimal 16 digit)`,
        code: 'INVALID_NUMBER_LENGTH'
      });
    }

    // Prioritas 1: Gunakan Supabase Edge Function Gateway Proxy
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://lzvrhtaewonmpsaiezai.supabase.co';
    const gatewayProxyUrl = userId 
      ? `${supabaseUrl}/functions/v1/waha-proxy?action=sendText&userId=${encodeURIComponent(userId)}`
      : `${supabaseUrl}/functions/v1/waha-proxy?action=sendText`;

    try {
      const proxyRes = await fetch(gatewayProxyUrl, {
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

      const proxyData = await proxyRes.json().catch(() => ({}));

      if (proxyRes.ok && proxyData?.success !== false) {
        return res.status(200).json({
          success: true,
          provider: 'whatsapp-gateway',
          data: proxyData,
        });
      }

      // Jika error spesifik dari proxy (seperti nomor tidak terdaftar atau session belum aktif)
      if (proxyData?.code || proxyRes.status === 404 || proxyRes.status === 400) {
        return res.status(proxyRes.status || 400).json({
          success: false,
          error: proxyData.error || 'Nomor WhatsApp tidak terdaftar di WhatsApp',
          code: proxyData.code || 'NUMBER_NOT_FOUND',
          data: proxyData
        });
      }
    } catch (proxyErr) {
      console.warn('Gateway proxy send error, mencoba fallback langsung:', proxyErr);
    }

    // Prioritas 2: Direct WhatsApp Gateway VPS jika env tersedia
    const gatewayBaseUrl = (process.env.WAHA_BASE_URL || process.env.WHATSAPP_BASE_URL || 'http://13.140.178.167:29001').replace(/\/+$/, '');
    const gatewayApiKey = process.env.WAHA_API_KEY || process.env.WHATSAPP_API_KEY || 'askdj2934u9jd923dj3jdoi23nuiurio32od23oed2omi3290rmmoiejrw';

    if (gatewayBaseUrl && gatewayApiKey) {
      let sessionName = 'default';
      if (userId) {
        const cleanUid = userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
        sessionName = `user_${cleanUid}`;
      }

      const chatId = `${cleanTo}@c.us`;
      const gatewayEndpoint = file ? `${gatewayBaseUrl}/api/sendFile` : `${gatewayBaseUrl}/api/sendText`;
      
      let filePayload: any = undefined;
      if (file) {
        if (typeof file === 'string') {
          filePayload = {
            url: file,
            data: file,
            filename: 'Kwitansi_Pembayaran.pdf',
            mimetype: 'application/pdf'
          };
        } else {
          filePayload = {
            ...file,
            url: file.url || file.data,
            data: file.data || file.url,
            filename: file.filename || 'Kwitansi_Pembayaran.pdf',
            mimetype: file.mimetype || 'application/pdf'
          };
        }
      }

      const gatewayBody = file
        ? { session: sessionName, chatId, file: filePayload, filename: filePayload?.filename, caption: message }
        : { session: sessionName, chatId, text: message };

      const directRes = await fetch(gatewayEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': gatewayApiKey,
        },
        body: JSON.stringify(gatewayBody),
      });

      if (directRes.ok) {
        const directJson = await directRes.json().catch(() => ({}));
        return res.status(200).json({
          success: true,
          provider: 'whatsapp-direct',
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
