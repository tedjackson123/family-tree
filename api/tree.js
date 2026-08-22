// Vercel serverless function — GET/POST family tree data
// Uses Cloudflare R2 (S3-compatible) for storage.
// Required env vars: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME

const https = require('https');

const OBJECT_KEY = 'family_tree.json';

function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw Object.assign(new Error('R2 not configured'), { code: 'NO_R2' });
  }
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

// Minimal AWS Signature V4 for R2 (S3-compatible)
async function sign(cfg, method, path, body) {
  const { accountId, accessKeyId, secretAccessKey, bucket } = cfg;
  const host = `${bucket}.${accountId}.r2.cloudflarestorage.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateStamp = amzDate.slice(0, 8);
  const region = 'auto';
  const service = 's3';

  const payloadHash = await sha256hex(body || '');
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [method, path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, await sha256hex(canonicalRequest)].join('\n');

  const signingKey = await hmac(
    await hmac(await hmac(await hmac(`AWS4${secretAccessKey}`, dateStamp), region), service),
    'aws4_request'
  );
  const signature = buf2hex(await hmacRaw(signingKey, stringToSign));

  return {
    host,
    amzDate,
    payloadHash,
    authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  };
}

// Crypto helpers using Node's built-in crypto
const crypto = require('crypto');
function sha256hex(data) {
  return Promise.resolve(crypto.createHash('sha256').update(data || '').digest('hex'));
}
function hmacRaw(key, data) {
  const k = typeof key === 'string' ? Buffer.from(key, 'utf8') : key;
  return Promise.resolve(crypto.createHmac('sha256', k).update(data).digest());
}
async function hmac(key, data) { return hmacRaw(key, data); }
function buf2hex(buf) { return Buffer.from(buf).toString('hex'); }

function r2Request(cfg, method, body) {
  return new Promise(async (resolve, reject) => {
    const path = `/${OBJECT_KEY}`;
    const signed = await sign(cfg, method, path, body);
    const options = {
      hostname: signed.host,
      path,
      method,
      headers: {
        'Host': signed.host,
        'x-amz-date': signed.amzDate,
        'x-amz-content-sha256': signed.payloadHash,
        'Authorization': signed.authorization,
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {})
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-password');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!process.env.FAMILY_PASSWORD) {
    return res.status(500).json({ error: 'FAMILY_PASSWORD environment variable is not set.' });
  }
  if (req.headers['x-password'] !== process.env.FAMILY_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  let cfg;
  try { cfg = getR2Config(); }
  catch (e) {
    if (e.code === 'NO_R2') return res.status(500).json({ error: 'R2 storage not configured. Add R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME to Vercel env vars.' });
    throw e;
  }

  try {
    if (req.method === 'GET') {
      const r = await r2Request(cfg, 'GET', null);
      if (r.status === 404) return res.json({ people: [], relationships: [], changeLog: [] });
      if (r.status !== 200) return res.status(500).json({ error: `R2 GET failed: ${r.status}` });
      return res.json(JSON.parse(r.body));
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const r = await r2Request(cfg, 'PUT', body);
      if (r.status < 200 || r.status > 299) return res.status(500).json({ error: `R2 PUT failed: ${r.status}` });
      return res.json({ ok: true, savedAt: new Date().toISOString() });
    }

    res.status(405).end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};
