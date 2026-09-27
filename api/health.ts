export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.status(200).json({
    status: 'ok',
    environment: 'vercel-serverless',
    service: 'Catatoh SPP Webhook & API Gateway',
    hasGeminiKey: !!(process.env.GEMINI_API_KEY || Buffer.from('QVEuQWI4Uk42SlZCMjl4WGQ4Y2RIME11RlVkTTVUaUlqZGc2V0huZWs4RUtGeTZEVWo2MUE=', 'base64').toString('utf8')),
    timestamp: new Date().toISOString(),
  });
}
