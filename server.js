// Local development server.
// For production, deploy to Vercel — the /api/ folder handles everything there.
const express = require('express');
const https   = require('https');
const fs      = require('fs');
const path    = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

const DB_FILE = path.join(__dirname, 'local-tree.json');
const FAMILY_PASSWORD = process.env.FAMILY_PASSWORD || 'family123';

function readTree() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return { people: [], relationships: [] }; }
}
function writeTree(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}
function checkPw(req, res) {
  if (req.headers['x-password'] !== FAMILY_PASSWORD) {
    res.status(401).json({ error: 'Incorrect password' }); return false;
  }
  return true;
}

app.get('/api/tree',  (req, res) => { if (!checkPw(req,res)) return; res.json(readTree()); });
app.post('/api/tree', (req, res) => { if (!checkPw(req,res)) return; writeTree(req.body); res.json({ ok: true }); });

// Story generation
app.post('/api/story', (req, res) => {
  if (!checkPw(req, res)) return;
  const { prompt, apiKey: clientKey } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY || clientKey;
  if (!apiKey) return res.status(400).json({ error: 'No API key. Set ANTHROPIC_API_KEY env var or enter it in the app.' });
  if (!prompt)  return res.status(400).json({ error: 'Missing prompt' });

  const data = JSON.stringify({
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
      'Content-Length': Buffer.byteLength(data)
    }
  };

  const apiReq = https.request(options, (apiRes) => {
    let body = '';
    apiRes.on('data', c => body += c);
    apiRes.on('end', () => {
      try {
        const json = JSON.parse(body);
        if (json.error) return res.status(400).json({ error: json.error.message });
        res.json({ story: json.content[0].text });
      } catch (e) { res.status(500).json({ error: 'Failed to parse API response' }); }
    });
  });
  apiReq.on('error', (e) => res.status(500).json({ error: e.message }));
  apiReq.write(data);
  apiReq.end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\nFamily Tree running at http://localhost:${PORT}`);
  console.log(`Data file: ${DB_FILE}\n`);
});
