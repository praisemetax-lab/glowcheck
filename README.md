# ✨ GlowCheck

**Is your skincare actually working?** GlowCheck lets you snap a selfie when you start a new skincare product, then once a week. It uses the **YouCam AI Skin Analysis API** to score your skin, show problem-area masks, chart your progress, and give a simple **KEEP / ADJUST / STOP** verdict.

Built for **deeper skin tones and humid climates** – it focuses on dark spots, post-acne marks, oiliness and pores, with ingredient tips (niacinamide, azelaic acid, salicylic acid, SPF…) for each concern.

> Built for the YouCam API Skin AI & eCommerce VTO Hackathon. Not medical advice.

## Features (v1)
- Onboarding: name the product you're testing + start date
- Selfie via the **YouCam JS Camera Kit** (guided, checks light & face position) or normal upload / phone camera
- AI analysis with a loading screen (11 SD concerns: acne, age_spot, oiliness, pore, texture, redness, moisture, radiance, dark_circle_v2, eye_bag, wrinkle)
- Results: overall score ring, skin age, per-concern score cards, mask overlay toggle (masks are hidden for concerns scoring 95+ or with empty masks)
- History + trend chart (Chart.js), saved in your browser (localStorage) – photos never leave the device except for analysis
- Rule-based verdict comparing latest scan vs your baseline (see `js/verdict.js`)
- **Demo/mock mode** – realistic fake data, no API units used

## Project structure
```
index.html          the whole app (5 screens shown/hidden by JS)
css/style.css       all styles (mobile-first)
js/concerns.js      concern names + ingredient tips
js/storage.js       save/load history (localStorage)
js/verdict.js       keep/adjust/stop rules  ← easy to tweak
js/app.js           screens, camera, calling the API, results
api/analyze.js      POST /api/analyze  – uploads photo to YouCam & starts the task
api/status.js       GET  /api/status   – checks if the task is done
api/health.js       GET  /api/health   – tells the UI if mock mode is on
api/_youcam.js      shared YouCam helpers (key, retries, error messages)
api/_mock.js        fake sample results
server.js           optional local server (no Vercel needed; serves only index.html, css/, js/)
vercel.json         function settings (30s max duration for the API routes)
```
Your API key is only ever read on the server (`process.env.YOUCAM_API_KEY`). It is never sent to the browser.

## How it talks to YouCam
1. Browser resizes the selfie (short side ≥ 480px, long side ≤ 1920px, JPG) and sends it as base64 to `/api/analyze`.
2. Server: `POST /s2s/v2.0/file/skin-analysis` → gets `file_id` + presigned upload URL → `PUT`s the bytes there.
3. Server: `POST /s2s/v2.0/task/skin-analysis` with `src_file_id`, `dst_actions`, `format: "json"` → `task_id`.
4. Browser polls `/api/status?id=…` every 3s → server calls `GET /s2s/v2.0/task/skin-analysis/{task_id}` until `success`/`error`.
5. Scores are saved immediately (YouCam result links expire after ~2 hours). Masks are shown only in that session.

## Setup

### 1. Get a YouCam API key
Sign up at https://yce.makeupar.com/ → API Console → **API Keys** → create a key. (Check unit costs at https://yce.makeupar.com/ai-api – one SD scan with 8+ concerns costs several units.)

Requires **Node.js 18+** locally (Vercel runs Node 22.x, set via `engines` in `package.json`).

### 2. Run locally – quickest (demo mode, no key)
```bash
npm run mock          # = MOCK=1 node server.js
# open http://localhost:3000
```
`server.js` does not read `.env` files. To use the real API with it, export the key in your shell first
(`export YOUCAM_API_KEY=...` then `node server.js`). Each real scan uses YouCam units.
### 3. Run locally with Vercel (same as production)
```bash
npm i -g vercel
vercel login
vercel dev            # first time: answer the prompts, framework = "Other"
```
To use your real key locally, create a file `.env.local` (never commit it):
```
YOUCAM_API_KEY=your_key_here
```
`.env.example` also contains `MOCK=1` – remove it (or set `MOCK=0`) to use the real API. With no key, the app stays in demo mode automatically.

Note: the guided camera needs HTTPS (or `localhost`). On a phone, test it on your deployed Vercel URL.

### 4. Deploy
```bash
vercel                       # preview deploy
vercel env add YOUCAM_API_KEY   # paste key, choose Production (and Preview)
vercel --prod
```
Or in the Vercel dashboard: Project → Settings → Environment Variables → add `YOUCAM_API_KEY`, then redeploy.
To demo without spending units, add `MOCK=1` as an environment variable instead.

## Checks
```bash
npm run check         # node --check on every JS file
```

## Customising
- Verdict rules: `js/verdict.js` (thresholds are plain numbers at the top).
- Tips: `js/concerns.js`.
- Concerns analysed: `ACTIONS` in `api/_youcam.js` (SD only – don't mix with `hd_` ones).

## License
MIT – see `LICENSE`.
