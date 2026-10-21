// api/_mock.js
// Fake but realistic results so you can demo the app without spending YouCam units.
// Each call returns slightly different scores, so the trend chart looks alive.

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

// "week" lets the mock improve a little over time so the verdict demo is interesting.
function mockResult(week = 0) {
  const concerns = {};
  for (const [k, v] of Object.entries(BASE)) {
    const drift = Math.round(week * (k === 'age_spot' || k === 'acne' || k === 'oiliness' ? 2.5 : 1));
    const noise = Math.round((Math.random() - 0.5) * 6);
    const ui = Math.max(1, Math.min(99, v.ui + drift + noise));
    concerns[k] = { ui, raw: +(ui * 0.9).toFixed(2), mask: maskSvg(v.color, v.spots) };
  }
  const scores = Object.values(concerns).map((c) => c.ui);
  const overall = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  // Stand-in for YouCam's resized photo (masks are drawn on it). Neutral face-ish placeholder.
  const resizedImage = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 300 400"><rect width="300" height="400" fill="#3a2a22"/><ellipse cx="150" cy="200" rx="105" ry="140" fill="#7a4e36"/></svg>').toString('base64');
  return { overall, skinAge: Math.max(18, 29 - Math.floor(week / 2)), resizedImage, concerns };
}

module.exports = { mockResult };
