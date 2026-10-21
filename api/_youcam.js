// api/_youcam.js
// Shared helpers for talking to the YouCam API.
// Files starting with "_" are NOT turned into URLs by Vercel, so this is a private helper.
// Your secret key lives ONLY here on the server (process.env.YOUCAM_API_KEY), never in the browser.

const BASE = 'https://yce-api-01.makeupar.com';

// The SD (standard definition) skin concerns we ask for. SD and HD can't be mixed.
// These are picked for deeper skin tones + humid climates (spots, marks, oil, pores).
const ACTIONS = [
  'acne', 'age_spot', 'oiliness', 'pore', 'texture', 'redness',
  'moisture', 'radiance', 'dark_circle_v2', 'eye_bag', 'wrinkle'
];

// Mock mode = no real API calls. On when MOCK=1 or when no key is set.
function isMock() {
  return process.env.MOCK === '1' || !process.env.YOUCAM_API_KEY;
}

// Friendly messages for YouCam error codes.
const FRIENDLY = {
  error_src_face_too_small: 'Your face looks too small. Move closer so your face fills most of the photo width.',
  error_src_face_out_of_bound: 'Part of your face is outside the photo. Centre your face and try again.',
  error_lighting_dark: 'The photo is too dark. Face a window or bright light and try again.',
  error_below_min_image_size: 'The photo is too small. Use a photo at least 480px on its short side.',
  error_exceed_max_image_size: 'The photo is too large. Try a smaller photo.',
  error_no_face: 'We could not find a face. Take a clear, front-facing selfie.',
  error_multiple_people: 'We found more than one person. Only you should be in the photo.',
  error_large_face_angle: 'Your head is turned too much. Look straight at the camera.',
  exceed_max_filesize: 'The photo file is too big (must be under 10MB).',
  error_decode_image: 'We could not read that image. Use a JPG or PNG photo.'
};
function friendly(code) {
  return FRIENDLY[code] || 'Analysis failed (' + (code || 'unknown error') + '). Please try another photo.';
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Make big numbers in JSON safe: wrap any integer with 16+ digits in quotes before parsing,
// so IDs don't lose precision in JavaScript (YouCam docs warn about this).
function safeJson(text) {
  return JSON.parse(text.replace(/([:\[,]\s*)(-?\d{16,})(?=\s*[,\]}])/g, '$1"$2"'));
}

// Call YouCam with the key. Retries automatically on 429 (too many requests).
async function youcam(path, options = {}) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(BASE + path, {
      signal: AbortSignal.timeout(20000), // never hang a serverless function
      ...options,
      headers: {
        Authorization: 'Bearer ' + process.env.YOUCAM_API_KEY,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    if (res.status === 429) { await sleep(1000 * (attempt + 1) * 2); continue; }
    const text = await res.text();
    let data;
    try { data = safeJson(text); } catch { data = { raw: text }; }
    if (!res.ok) {
      const err = new Error(data.error || ('YouCam HTTP ' + res.status));
      err.code = data.error_code || data.error;
      err.status = res.status;
      throw err;
    }
    return data;
  }
  const err = new Error('YouCam is busy (rate limited). Please wait a minute and retry.');
  err.status = 429;
  throw err;
}

// Turn the YouCam "json" result into our simple shape:
// { overall, skinAge, resizedImage, concerns: { acne: {ui, raw, mask}, ... } }
// Real response (format: 'json', verified Oct 2026): data.results.output is an array of
//   { type: '<action>', ui_score, raw_score, mask_urls: ['..._<action>_output.png'] }  per action
//   { type: 'all', score }        overall score (float, = mean of ui_scores)
//   { type: 'skin_age', score }   estimated skin age (integer)
//   { type: 'resize_image', mask_urls: ['..._resize_image.jpg'] }  the photo the masks were drawn on
// Masks are transparent RGBA PNGs with the same pixel size as the uploaded photo
// (long side capped at 2560), so they can be laid directly on top of it.
// Mask URLs are presigned and expire after 2 hours.
function normalize(results) {
  const out = { overall: null, skinAge: null, resizedImage: null, concerns: {} };
  const list = results && Array.isArray(results.output) ? results.output : [];
  for (const item of list) {
    const type = item && item.type;
    if (type === 'all') out.overall = typeof item.score === 'number' ? Math.round(item.score) : null;
    else if (type === 'skin_age') out.skinAge = typeof item.score === 'number' ? Math.round(item.score) : null;
    else if (type === 'resize_image') out.resizedImage = (item.mask_urls && item.mask_urls[0]) || null;
    else if (ACTIONS.includes(type)) {
      out.concerns[type] = {
        ui: item.ui_score ?? null,
        raw: item.raw_score ?? null,
        mask: (item.mask_urls && item.mask_urls[0]) || null
      };
    }
  }
  return out;
}

// Read the JSON body (Vercel usually parses it into req.body for us).
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let text = typeof req.body === 'string' ? req.body : null;
  if (text == null) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    text = Buffer.concat(chunks).toString();
  }
  try { return JSON.parse(text || '{}'); }
  catch { const e = new Error('Invalid JSON body'); e.status = 400; throw e; }
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(obj));
}

module.exports = { ACTIONS, isMock, friendly, youcam, normalize, readBody, send, sleep };
