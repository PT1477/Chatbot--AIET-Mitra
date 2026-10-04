/* AIET Mitra local server + Gemini proxy. Keep secrets in .env, never in browser code. */
const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const allowedOrigin = process.env.ALLOWED_ORIGIN || '';
const windowMs = 60_000;
const maxRequests = Number(process.env.RATE_LIMIT_PER_MINUTE || 20);
const requests = new Map();

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
  next();
});
app.use(express.json({ limit: '32kb' }));
app.use('/api', (req, res, next) => {
  if (allowedOrigin && req.headers.origin && req.headers.origin !== allowedOrigin) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const record = requests.get(key);
  if (!record || now - record.start >= windowMs) requests.set(key, { start: now, count: 1 });
  else if (++record.count > maxRequests) return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
  next();
});

app.post('/api/gemini-proxy', async (req, res) => {
  if (!GEMINI_API_KEY) return res.status(503).json({ error: 'AI service is not configured. Set GEMINI_API_KEY on the server.' });
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  const systemPrompt = typeof req.body?.systemPrompt === 'string' ? req.body.systemPrompt.slice(0, 6000) : '';
  if (!prompt) return res.status(400).json({ error: 'A non-empty prompt is required.' });
  if (prompt.length > 8000) return res.status(413).json({ error: 'Prompt is too long.' });

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemPrompt || 'You are AIET Mitra, a helpful college information assistant. Do not invent official college facts; say when information is unavailable.' }] },
    generationConfig: { temperature: 0.3, maxOutputTokens: 900 }
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error('Gemini upstream status:', upstream.status, data?.error?.message || 'No detail');
      return res.status(upstream.status === 429 ? 429 : 502).json({ error: upstream.status === 429 ? 'AI usage limit reached. Try again shortly.' : 'The AI service could not complete the request.' });
    }
    return res.json(data);
  } catch (error) {
    console.error('Gemini proxy error:', error.name === 'AbortError' ? 'Request timed out' : error.message);
    return res.status(502).json({ error: 'Unable to reach the AI service. Please try again.' });
  } finally { clearTimeout(timeout); }
});

app.get('/api/health', (_req, res) => res.json({ ok: true, aiConfigured: Boolean(GEMINI_API_KEY) }));
app.use(express.static(path.join(__dirname), { dotfiles: 'deny', index: 'index.html' }));
app.listen(PORT, () => console.log(`AIET Mitra running at http://localhost:${PORT}`));
