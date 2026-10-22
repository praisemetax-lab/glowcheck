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

function baseVerdict(profile, scans) {
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
    return { type: 'wait', title: 'Too early to tell', text: `Only ${days} ${days === 1 ? "day" : "days"} in. Keep using it consistently – skin cells renew roughly every 4 weeks.`, reasons };
  }
  if (overallDelta >= 3 || focusDelta >= 3) {
    return { type: 'keep', title: 'Keep going', text: 'Your skin is responding well. Stay consistent and keep wearing sunscreen.', reasons };
  }
  if (days < 42) {
    return { type: 'keep', title: 'Keep – be patient', text: 'No big change yet, which is normal before week 6. Keep going.', reasons };
  }
  return { type: 'adjust', title: 'Adjust', text: 'After 6+ weeks there is little change. Time to try a different active ingredient – see the options below.', reasons };
}

// ---------- Explanations + "Try instead" recommendations ----------
// Wraps the rule-based verdict with plain-language reasons from the REAL scores and the local knowledge base.
const label = (k) => (CONCERNS[k] ? CONCERNS[k].label : k);
const signed = (n) => (n > 0 ? '+' + n : n < 0 ? '−' + Math.abs(n) : '±0');

function skinSummary(scan) {
  const keys = Object.keys(scan.concerns).filter((k) => CONCERNS[k] && typeof scan.concerns[k] === 'number');
  const byScore = keys.map((k) => ({ k, label: label(k), s: scan.concerns[k] })).sort((a, b) => b.s - a.s);
  // Weakest: prefer the focus concerns for deeper skin tones when scores tie closely.
  // Eye-area concerns (often genetic on deeper skin) only count as "weak" when clearly low.
  const EYE = ['dark_circle_v2', 'eye_bag'];
  const weak = [...byScore].filter((x) => !EYE.includes(x.k) || x.s < 50)
    .sort((a, b) => (a.s - b.s) || (CONCERNS[b.k].focus - CONCERNS[a.k].focus)).slice(0, 3);
  const strong = byScore.filter((x) => !weak.includes(x)).slice(0, 3);
  return { overall: scan.overall, strong, weak };
}

function overallWords(n) {
  if (n == null) return 'not available';
  if (n >= 80) return 'very healthy';
  if (n >= 70) return 'healthy, with a few things to work on';
  if (n >= 60) return 'fair, with clear room to improve';
  return 'in need of some extra care';
}

function pickRecs(weakKeys, usedActives, max = 3) {
  const used = new Set(usedActives.flatMap((a) => SAME_AS[a.id] || []));
  const picked = []; const seen = new Set();
  // Round-robin across the weakest concerns so each gets a fitting option.
  for (let round = 0; round < 4 && picked.length < max; round++) {
    for (const k of weakKeys) {
      const opts = (ALT_FOR[k] || []).filter((id) => !used.has(id) && !seen.has(id));
      const id = opts[0]; if (!id) continue;
      seen.add(id); picked.push({ id, for: k, ...ALTERNATIVES[id] });
      if (picked.length >= max) break;
    }
  }
  return picked;
}

function getVerdict(profile, scans) {
  const v = baseVerdict(profile, scans);
  if (!v) return v;
  const base = scans[0], last = scans[scans.length - 1];
  const summary = skinSummary(last);
  const actives = matchActives(profile.product);
  const goodFor = new Set(actives.flatMap((a) => a.goodFor));
  const weakKeys = summary.weak.map((w) => w.k);
  const targets = weakKeys.filter((k) => goodFor.has(k));
  const oilyOrAcne = summary.weak.some((w) => w.k === 'oiliness' || w.k === 'acne');
  const heavyWarn = actives.some((a) => a.heavy) && oilyOrAcne;

  v.summary = summary;
  v.product = {
    name: profile.product, actives,
    about: actives.length ? actives.map((a) => `${a.name} ${a.blurb}`).join('; ') + '.'
      : "We don't recognise the key ingredient in this product yet. Check its label for one main active (e.g. niacinamide, salicylic acid, vitamin C) so you know what it should improve.",
    matches: targets.map(label),
    fit: !actives.length ? 'unknown' : targets.length ? (targets.length >= 2 ? 'good' : 'partial') : 'off',
    heavyWarn
  };
  v.watch = actives.length ? actives[0].watch : 'Watch your weakest areas below – they should move first if the product suits you.';

  // Concern changes since the first scan (biggest moves first).
  if (scans.length > 1) {
    v.changes = Object.keys(last.concerns).filter((k) => CONCERNS[k] && base.concerns[k] != null)
      .map((k) => ({ k, label: label(k), d: last.concerns[k] - base.concerns[k] }))
      .filter((c) => c.d !== 0).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 5);
    v.overallDelta = (last.overall ?? 0) - (base.overall ?? 0);
  } else v.changes = [];

  const ups = v.changes.filter((c) => c.d > 0), downs = v.changes.filter((c) => c.d < 0);
  const fmt = (arr) => arr.slice(0, 3).map((c) => `${c.label} ${signed(c.d)}`).join(', ');
  const days = daysBetween(profile.startDate, last.date);

  if (scans.length < 2) {
    v.title = 'Your baseline is saved';
    v.text = `Your overall skin score is ${summary.overall ?? '--'}, which looks ${overallWords(summary.overall)}. ` +
      `Your strongest area is ${summary.strong[0] ? summary.strong[0].label.toLowerCase() : '—'}; ${summary.weak[0] ? summary.weak[0].label.toLowerCase() : '—'} needs the most care.`;
    v.meaning = v.product.fit === 'good' ? `Good match: ${profile.product} targets ${v.product.matches.join(' and ')}, which are among your weakest areas.`
      : v.product.fit === 'partial' ? `Partial match: it helps ${v.product.matches.join(', ')}, but not your other weak spots.`
      : v.product.fit === 'off' ? `Mismatch: ${profile.product} isn't designed for your weakest areas (${summary.weak.map((x) => x.label).join(', ')}). You can keep it, but consider adding something that targets them.`
      : '';
    v.next = 'Use it consistently, then take your next selfie in 7 days in the same light. Most products need 4–8 weeks to show results.';
  } else {
    v.meaning = v.type === 'keep' ? (ups.length ? `It's working where it counts: ${fmt(ups)}.` : 'No big moves yet, which is normal before week 6.')
      : v.type === 'adjust' ? `After ${days} days, little has improved${downs.length ? ` and some areas slipped (${fmt(downs)})` : ''}. This product may not suit your skin's main needs.`
      : v.type === 'stop' ? `Your skin is moving the wrong way${downs.length ? `: ${fmt(downs)}` : ''}. That can mean irritation or a poor match.`
      : `Only ${days} ${days === 1 ? 'day' : 'days'} in. Early changes${v.changes.length ? ` (${fmt(v.changes)})` : ''} are often just day-to-day variation.`;
    v.next = v.type === 'keep' ? 'Keep the same routine and scan weekly in the same light. Daily SPF protects your progress.'
      : v.type === 'adjust' ? 'Switch to (or add) one of the options below that targets your weakest areas. Change one product at a time and give it 6–8 weeks.'
      : v.type === 'stop' ? 'Pause this product now. Use only a gentle cleanser, a plain moisturiser and SPF for 1–2 weeks. See a dermatologist if redness, burning or breakouts continue.'
      : 'Keep using it as directed and scan again next week.';
  }
  if (heavyWarn) v.watchExtra = 'Heads-up: occlusives like petroleum jelly can feel heavy and trap oil on oily or acne-prone skin – use a thin layer only on dry areas.';

  // "Try instead" cards: ADJUST / STOP, or a baseline where the product misses the weakest concerns.
  const wantRecs = v.type === 'adjust' || v.type === 'stop' || (scans.length < 2 && v.product.fit === 'off');
  if (wantRecs) {
    let recs = pickRecs(weakKeys, actives, 3);
    if (v.type === 'stop' && !recs.some((r) => r.id === 'gentle')) recs = [{ id: 'gentle', for: 'redness', ...ALTERNATIVES.gentle }, ...recs].slice(0, 3);
    if (oilyOrAcne) recs = recs.filter((r) => r.id !== 'petrolatum'); // heavy occlusives don't suit oily/acne-prone weak areas
    v.recs = recs.map((r) => ({ ...r, forLabel: label(r.for) }));
    v.recsIntro = v.type === 'stop' ? 'Gentler options for your skin while it recovers:'
      : v.type === 'adjust' ? `Options that target your weakest areas (${summary.weak.map((x) => x.label).join(', ')}):`
      : `Your product doesn't target your weakest areas. These do:`;
  } else v.recs = [];
  return v;
}
