// Vercel serverless function — GET/POST family tree data
// Uses Cloudflare R2 (S3-compatible) for storage.
// Required env vars: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME

const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

const OBJECT_KEY = 'family_tree.json';

function getClient() {
  const accountId       = process.env.R2_ACCOUNT_ID;
  const accessKeyId     = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket          = process.env.R2_BUCKET_NAME;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw Object.assign(new Error('R2 not configured'), { code: 'NO_R2' });
  }
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return { client, bucket };
}

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf-8');
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

  let client, bucket;
  try {
    ({ client, bucket } = getClient());
  } catch (e) {
    if (e.code === 'NO_R2') return res.status(500).json({ error: 'R2 storage not configured. Add R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME to Vercel env vars.' });
    throw e;
  }

  try {
    if (req.method === 'GET') {
      try {
        const r = await client.send(new GetObjectCommand({ Bucket: bucket, Key: OBJECT_KEY }));
        const text = await streamToString(r.Body);
        return res.json(JSON.parse(text));
      } catch (e) {
        if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) {
          return res.json({ people: [], relationships: [], changeLog: [] });
        }
        throw e;
      }
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: OBJECT_KEY,
        Body: body,
        ContentType: 'application/json',
      }));
      return res.json({ ok: true, savedAt: new Date().toISOString() });
    }

    res.status(405).end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};
