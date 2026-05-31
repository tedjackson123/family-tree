// Vercel serverless function — Claude story generation proxy
const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-password');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const pw = req.headers['x-password'];
  if (pw !== process.env.FAMILY_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { prompt, apiKey: clientKey } = body;

  // Server env var takes priority; fall back to key provided by client
  const apiKey = process.env.ANTHROPIC_API_KEY || clientKey;
  if (!apiKey) return res.status(400).json({ error: 'No Anthropic API key configured. Set ANTHROPIC_API_KEY in Vercel env vars, or enter your own key in the app.' });
  if (!prompt)  return res.status(400).json({ error: 'Missing prompt' });

  const payload = JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }]
  });

  const options = {
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  return new Promise((resolve) => {
    const apiReq = https.request(options, (apiRes) => {
      let data = '';
      apiRes.on('data', c => data += c);
      apiRes.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) { res.status(400).json({ error: json.error.message }); }
          else { res.json({ story: json.content[0].text }); }
        } catch (e) { res.status(500).json({ error: 'Failed to parse API response' }); }
        resolve();
      });
    });
    apiReq.on('error', (e) => { res.status(500).json({ error: e.message }); resolve(); });
    apiReq.write(payload);
    apiReq.end();
  });
};
