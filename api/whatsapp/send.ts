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
    const { apiUrl, appkey, authkey, to, message, file } = req.body || {};

    if (!appkey || !authkey || !to || !message) {
      return res.status(400).json({
        success: false,
        error: 'Parameter appkey, authkey, to, dan message wajib diisi.',
      });
    }

    const targetUrl = apiUrl || 'https://app.starsender.online/api/sendText';
    let cleanTo = to.replace(/\D/g, '');
    if (cleanTo.startsWith('0')) cleanTo = '62' + cleanTo.slice(1);
    else if (cleanTo.startsWith('8')) cleanTo = '62' + cleanTo;

    const formData = new URLSearchParams();
    formData.append('appkey', appkey);
    formData.append('authkey', authkey);
    formData.append('to', cleanTo);
    formData.append('message', message);
    if (file) {
      formData.append('file', file);
    }

    const gatewayResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Catatoh-SPP-Gateway/1.0',
      },
      body: formData.toString(),
    });

    const responseText = await gatewayResponse.text();
    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    return res.status(200).json({
      success: gatewayResponse.ok,
      status: gatewayResponse.status,
      data: responseData,
    });
  } catch (error: any) {
    console.error('WhatsApp Gateway Send Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Gagal menghubungi server WhatsApp Gateway.',
    });
  }
}
