// Vercel serverless function — GET/POST family tree data
// Uses Upstash Redis for storage.
// In Vercel dashboard: Integrations → search "Upstash Redis" → add to project.
// It auto-sets UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars.

function getRedis() {
  const url   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw Object.assign(new Error('Redis not configured'), { code: 'NO_REDIS' });
  const { Redis } = require('@upstash/redis');
  return new Redis({ url, token });
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

  try {
    const redis = getRedis();

    if (req.method === 'GET') {
      const data = await redis.get('family_tree');
      return res.json(data || { people: [], relationships: [] });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      await redis.set('family_tree', JSON.stringify(body));
      return res.json({ ok: true, savedAt: new Date().toISOString() });
    }

    res.status(405).end();
  } catch (e) {
    if (e.code === 'NO_REDIS') {
      return res.status(500).json({
        error: 'Database not connected. In Vercel: go to Integrations → search "Upstash Redis" → add to project.'
      });
    }
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};
