# AIET Mitra — College Chatbot

## What is prepared in this package
- Frontend calls only the same-origin `/api/gemini-proxy`; no browser-side Gemini key fallback.
- Hardened Express and Vercel Gemini proxy: request validation, timeout, safer errors, configurable model, basic per-process rate limit.
- `.env.example` contains placeholders only.
- Starter Firestore security rules and a college data template are included.
- Vercel headers/config included.

## Manual setup still required
1. Revoke any Gemini key that was ever committed/shared, then create a new key.
2. Copy `.env.example` to `.env` and set `GEMINI_API_KEY`. Never commit `.env`.
3. Configure Firebase project/auth providers and confirm the frontend Firebase config matches your project.
4. Create Firestore and deploy `firestore.rules` after reviewing them against your exact data paths.
5. Add verified college facts to Firestore; do not publish placeholder data as official answers.
6. In Vercel, add `GEMINI_API_KEY`, optionally `GEMINI_MODEL` and `ALLOWED_ORIGIN`, then deploy. For local Express, use `npm install` and `npm start`.

## Local run
```bash
npm install
cp .env.example .env  # Windows PowerShell: Copy-Item .env.example .env
# Edit .env with your own key
npm start
```
Open http://localhost:3000. `GET /api/health` reports whether the server has a key configured (never returns the key).

## Important limitations
- Rate limiting in this starter is in-memory and best-effort; use a shared store/provider-level limits for production serverless scale.
- The supplied Firestore rules are a starter for the currently observed chat path. Review before deployment. Admin custom claims must be assigned by a trusted environment, not the browser.
- The AI prompt alone is not a verified college knowledge base. Connect approved facts/documents before relying on answers about fees, dates, policies, or staff.
- Test Firebase Auth, Firestore rules, model availability, quota, and hosting in your own cloud project; these require your accounts and credentials.
