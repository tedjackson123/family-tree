// Vercel serverless function — analyze a document and suggest family tree improvements
const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-password');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.headers['x-password'] !== process.env.FAMILY_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { text, treeData, apiKey: clientKey } = body;
  const apiKey = process.env.ANTHROPIC_API_KEY || clientKey;

  if (!apiKey)    return res.status(400).json({ error: 'No API key configured.' });
  if (!text)      return res.status(400).json({ error: 'No document text provided.' });
  if (!treeData)  return res.status(400).json({ error: 'No tree data provided.' });

  // Build tree summary for the prompt
  const pmap = {};
  treeData.people.forEach(p => { pmap[p.id] = p; });

  const peopleText = treeData.people.map(p => {
    let s = `[ID:${p.id}] ${p.fullName}`;
    if (p.nickname)   s += ` (aka ${p.nickname})`;
    if (p.maidenName) s += ` (née ${p.maidenName})`;
    if (p.birthYear)  s += `, b.${p.birthYear}`;
    if (p.deathYear)  s += `, d.${p.deathYear}`;
    if (p.birthPlace) s += `, from ${p.birthPlace}`;
    if (p.occupation) s += `, ${p.occupation}`;
    if (p.origin)     s += ` [${p.origin}]`;
    return s;
  }).join('\n') || '(no people in tree yet)';

  const relsText = treeData.relationships.map(r =>
    `${pmap[r.from]?.fullName || '?'} [${r.from}] → ${r.type} → ${pmap[r.to]?.fullName || '?'} [${r.to}]`
  ).join('\n') || '(no relationships yet)';

  const prompt = `You are a genealogy assistant. Analyze the family history document below and identify specific improvements for the family tree database. Only suggest things explicitly stated or clearly implied by the document — do not invent details.

EXISTING FAMILY TREE
People:
${peopleText}

Relationships:
${relsText}

DOCUMENT TO ANALYZE:
${text}

Return ONLY a valid JSON array with no other text, no markdown code fences. Each element must have:
- "action": "add_person" | "update_person" | "add_relationship" | "note"
- "confidence": "high" (clearly stated) | "medium" (reasonably implied) | "low" (uncertain)
- "description": clear human-readable summary of the suggestion
- "personId": (update_person only) the exact ID string from the tree above
- "data": object with fields relevant to the action:
    add_person    → { fullName, nickname, maidenName, birthYear, deathYear, birthPlace, occupation, origin, notes }
    update_person → only the specific fields that should change
    add_relationship → { fromName, toName, type } — type is one of: parent-of, child-of, spouse-of, sibling-of
    note          → { text }

If there are no suggestions, return [].`;

  const requestBody = JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
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
      'Content-Length': Buffer.byteLength(requestBody)
    }
  };

  return new Promise((resolve) => {
    const apiReq = https.request(options, (apiRes) => {
      let responseBody = '';
      apiRes.on('data', chunk => { responseBody += chunk; });
      apiRes.on('end', () => {
        try {
          const json = JSON.parse(responseBody);
          if (json.error) {
            res.status(400).json({ error: json.error.message });
            return resolve();
          }
          const raw = json.content[0].text.trim();
          // Strip markdown code fences if Claude adds them anyway
          const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
          const suggestions = JSON.parse(cleaned);
          res.json({ suggestions });
        } catch (e) {
          res.status(500).json({ error: 'Failed to parse Claude response: ' + e.message });
        }
        resolve();
      });
    });
    apiReq.on('error', (e) => { res.status(500).json({ error: e.message }); resolve(); });
    apiReq.write(requestBody);
    apiReq.end();
  });
};
