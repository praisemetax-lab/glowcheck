// js/verdict.js
// Simple rule-based verdict: compare the LATEST scan with the FIRST scan (baseline).
// Rules (easy to tweak!):
//  - Fewer than 2 scans, or under 14 days of use -> "WAIT" (too early to judge)
//  - Redness dropped 6+ points -> "STOP" (possible irritation)
//  - Overall dropped 5+ points -> "STOP"
//  - Overall or focus concerns up 3+ points -> "KEEP"
//  - Otherwise: under 6 weeks -> "KEEP" (be patient), 6+ weeks -> "ADJUST"
const FOCUS_KEYS = ['age_spot', 'acne', 'oiliness', 'pore'];

function daysBetween(a, b) { return Math.floor((new Date(b) - new Date(a)) / 86400000); }

function getVerdict(profile, scans) {
  if (!scans.length) return null;
  const base = scans[0];
  const last = scans[scans.length - 1];
  const days = daysBetween(profile.startDate, last.date);
  const overallDelta = last.overall - base.overall;

  // Average change across focus concerns that exist in both scans.
  const deltas = FOCUS_KEYS.filter((k) => base.concerns[k] != null && last.concerns[k] != null)
    .map((k) => ({ k, d: last.concerns[k] - base.concerns[k] }));
  const focusDelta = deltas.length ? deltas.reduce((a, x) => a + x.d, 0) / deltas.length : 0;
  const rednessDelta = (last.concerns.redness ?? 0) - (base.concerns.redness ?? 0);

  // Biggest win and biggest loss, to explain the verdict.
  const sorted = [...deltas].sort((a, b) => b.d - a.d);
  const reasons = [];
  if (sorted.length && sorted[0].d > 0) reasons.push(`${CONCERNS[sorted[0].k].label} improved by ${sorted[0].d} points`);
  if (sorted.length && sorted[sorted.length - 1].d < 0) {
    const w = sorted[sorted.length - 1];
    reasons.push(`${CONCERNS[w.k].label} dropped by ${-w.d} points`);
  }
  reasons.push(`Overall score ${overallDelta >= 0 ? '+' : ''}${overallDelta} since your first scan`);

  if (scans.length < 2) {
    return { type: 'wait', title: 'Baseline saved', text: 'Come back in 7 days for your next selfie. Most products need 4–8 weeks to show results.', reasons: [] };
  }
  if (rednessDelta <= -6) {
    return { type: 'stop', title: 'Stop & check', text: 'Redness has gone up, which can mean irritation. Pause this product, use only a gentle cleanser, moisturiser and SPF, and see a dermatologist if it continues.', reasons: [`Redness score fell by ${-rednessDelta} points`, ...reasons] };
  }
  if (overallDelta <= -5) {
    return { type: 'stop', title: 'Stop', text: 'Your skin is scoring worse than when you started. Consider stopping this product.', reasons };
  }
  if (days < 14) {
    return { type: 'wait', title: 'Too early to tell', text: `Only ${days} day(s) in. Keep using it consistently – skin cells renew roughly every 4 weeks.`, reasons };
  }
  if (overallDelta >= 3 || focusDelta >= 3) {
    return { type: 'keep', title: 'Keep going', text: 'Your skin is responding well. Stay consistent and keep wearing sunscreen.', reasons };
  }
  if (days < 42) {
    return { type: 'keep', title: 'Keep – be patient', text: 'No big change yet, which is normal before week 6. Keep going.', reasons };
  }
  return { type: 'adjust', title: 'Adjust', text: 'After 6+ weeks there is little change. Try a product with a different active ingredient (see tips for your lowest scores).', reasons };
}
