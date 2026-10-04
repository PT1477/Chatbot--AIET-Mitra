// Vercel serverless endpoint. Set GEMINI_API_KEY and optionally GEMINI_MODEL in project env vars.
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const counters = new Map();
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '';
  if (allowedOrigin && req.headers.origin && req.headers.origin !== allowedOrigin) return res.status(403).json({ error: 'Origin not allowed' });
  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').toString().split(',')[0].trim();
  const now = Date.now(), prev = counters.get(ip);
  if (!prev || now - prev.start > 60000) counters.set(ip, { start: now, count: 1 });
  else if (++prev.count > Number(process.env.RATE_LIMIT_PER_MINUTE || 20)) return res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: 'AI service is not configured. Set GEMINI_API_KEY in hosting environment.' });
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  const systemPrompt = typeof req.body?.systemPrompt === 'string' ? req.body.systemPrompt.slice(0, 6000) : '';
  if (!prompt) return res.status(400).json({ error: 'A non-empty prompt is required.' });
  if (prompt.length > 8000) return res.status(413).json({ error: 'Prompt is too long.' });
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], systemInstruction: { parts: [{ text: systemPrompt || 'You are AIET Mitra. Do not invent official college facts; say when information is unavailable.' }] }, generationConfig: { temperature: 0.3, maxOutputTokens: 900 } }),
      signal: AbortSignal.timeout(30000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { console.error('Gemini upstream status:', response.status); return res.status(response.status === 429 ? 429 : 502).json({ error: response.status === 429 ? 'AI usage limit reached. Try again shortly.' : 'The AI service could not complete the request.' }); }
    return res.status(200).json(data);
  } catch (error) { console.error('Gemini proxy error:', error.message); return res.status(502).json({ error: 'Unable to reach the AI service. Please try again.' }); }
};
