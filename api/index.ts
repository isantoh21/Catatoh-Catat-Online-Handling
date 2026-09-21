export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.status(200).json({
    status: 'ok',
    name: 'Catatoh SPP Backend API',
    endpoints: [
      '/api/webhook/whatsapp',
      '/api/webhook/verifications',
      '/api/webhook/simulate',
      '/api/whatsapp/send',
      '/api/health'
    ],
    timestamp: new Date().toISOString()
  });
}
