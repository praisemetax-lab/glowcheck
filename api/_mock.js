// api/_mock.js
// Fake but realistic results so you can demo the app without spending YouCam units.
// Each product follows its own seeded story (improving, slow, mixed, worse or irritated),
// and every scan wobbles a little, so different products get clearly different verdicts.

// A simple coloured "blob" mask as an SVG image (stands in for YouCam's mask PNGs).
function maskSvg(color, spots) {
  const circles = spots.map(([x, y, r]) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" fill-opacity="0.55"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">${circles}</svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

const BASE = {
  acne:        { ui: 68, color: '#ff4d6d', spots: [[30, 60, 4], [68, 58, 3], [55, 72, 3]] },
  age_spot:    { ui: 62, color: '#b5651d', spots: [[28, 50, 5], [72, 48, 4], [40, 40, 3]] },
  oiliness:    { ui: 58, color: '#ffd166', spots: [[50, 30, 14], [50, 55, 8]] },
  pore:        { ui: 66, color: '#06d6a0', spots: [[35, 58, 7], [65, 58, 7], [50, 52, 5]] },
  texture:     { ui: 70, color: '#118ab2', spots: [[32, 62, 9], [68, 62, 9]] },
  redness:     { ui: 80, color: '#ef476f', spots: [[30, 60, 6], [70, 60, 6]] },
  moisture:    { ui: 64, color: '#4cc9f0', spots: [[50, 35, 12], [50, 75, 8]] },
  radiance:    { ui: 72, color: '#f8f9fa', spots: [[50, 50, 22]] },
  dark_circle_v2: { ui: 60, color: '#7b2cbf', spots: [[38, 45, 5], [62, 45, 5]] },
  eye_bag:     { ui: 74, color: '#9d4edd', spots: [[38, 48, 4], [62, 48, 4]] },
  wrinkle:     { ui: 82, color: '#adb5bd', spots: [[50, 25, 6], [40, 70, 3], [60, 70, 3]] }
};

// Small seeded random generator, so the same seed gives the same "skin story".
function hashStr(str) {
  let h = 2166136261;
  for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Each product (seed) gets its own "story", so demos don't all look the same:
const STORIES = [
  { name: 'improving', bias: 1.6 },   // most areas get better
  { name: 'slow',      bias: 0.3 },   // small, slow change
  { name: 'mixed',     bias: 0.4, swing: true },  // some up, some down
  { name: 'worse',     bias: -1.4 },  // skin gets worse
  { name: 'irritated', bias: 0.2, redness: -3 }   // redness/dryness worsen (irritation)
];

// mockResult(week, seed):
//  - week = how many scans this product already has (0 = first scan)
//  - seed = anything unique to the product (id/name). Same seed = same story; different seed = different story.
// Each concern gets its own start score and weekly trend, plus a little random wobble every scan.
function mockResult(week = 0, seed) {
  const s = seed == null || seed === '' ? 'demo-' + Math.floor(Date.now() / 60000) : String(seed).slice(0, 200);
  const r = rng(hashStr(s));
  const story = STORIES[Math.floor(r() * STORIES.length)];
  const wobble = rng(hashStr(s + '#' + week)); // differs every scan
  const concerns = {};
  for (const [k, v] of Object.entries(BASE)) {
    const start = v.ui + Math.round((r() - 0.5) * 18);
    let trend = story.bias + (r() - 0.5) * 2;
    if (story.swing) trend = (r() < 0.5 ? -1 : 1) * (1 + r() * 2);
    if (story.redness && (k === 'redness' || k === 'moisture')) trend = story.redness + (r() - 0.5);
    const noise = Math.round((wobble() - 0.5) * 6) + Math.round((Math.random() - 0.5) * 2);
    const ui = Math.max(5, Math.min(97, Math.round(start + trend * week) + (week ? noise : 0)));
    concerns[k] = { ui, raw: +(ui * 0.9).toFixed(2), mask: maskSvg(v.color, v.spots) };
  }
  const scores = Object.values(concerns).map((c) => c.ui);
  const overall = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  // Stand-in for YouCam's resized photo (masks are drawn on it). Neutral face-ish placeholder.
  const resizedImage = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 300 400"><rect width="300" height="400" fill="#3a2a22"/><ellipse cx="150" cy="200" rx="105" ry="140" fill="#7a4e36"/></svg>').toString('base64');
  const skinAge = Math.max(18, 27 + Math.round(r() * 6) - Math.round((overall - 68) / 3));
  return { overall, skinAge, resizedImage, concerns, story: story.name };
}

module.exports = { mockResult };
