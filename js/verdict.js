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
const vPlural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
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

  // Each section has ONE job: text = headline result with numbers; meaning = why/interpretation;
  // product.about = what the product does; next = one concrete action; watch = what to track (product-specific).
  const lc = (t) => t.charAt(0).toLowerCase() + t.slice(1);
  const best = ups[0], worst = downs[0];
  const od = v.overallDelta ?? 0;
  const weeks = Math.max(1, Math.round(days / 7));
  const patient = v.type === 'keep' && /patient/i.test(v.title);
  if (scans.length < 2) {
    v.title = 'Your baseline is saved';
    v.text = `Overall score ${summary.overall ?? '--'}: ${overallWords(summary.overall)}.`;
    v.meaning = v.product.fit === 'good' ? `Good match: it targets ${v.product.matches.join(' and ').toLowerCase()}, two of the areas that need the most care.`
      : v.product.fit === 'partial' ? `Partial match: it targets ${v.product.matches.join(', ').toLowerCase()}, but not your other weak areas.`
      : v.product.fit === 'off' ? "Mismatch: it isn't designed for the areas that need the most care, so expect little change there."
      : "We can't tell yet how well it matches the areas that need the most care.";
    v.next = 'Take your next selfie in 7 days, in the same light and at the same time of day.';
  } else if (v.type === 'wait') {
    v.text = `Overall ${signed(od)} after ${vPlural(days, 'day')}${best ? `, ${lc(best.label)} ${signed(best.d)}` : ''}.`;
    v.meaning = 'Too soon to judge: skin renews about every 4 weeks, and light, sleep or humidity can shift scores a few points from week to week.';
    v.next = 'Keep using it daily and scan again on your due date.';
  } else if (v.type === 'keep' && !patient) {
    v.text = `Overall ${signed(od)} since your first scan${best ? `, with ${lc(best.label)} improving most (${signed(best.d)})` : ''}.`;
    v.meaning = `Your skin is responding: the improvements outweigh the dips${worst ? ` (the ${lc(worst.label)} ${signed(worst.d)} is within normal week-to-week variation)` : ''}.`;
    v.next = "Change nothing: same routine, daily SPF, and a weekly scan.";
  } else if (patient) {
    v.text = `Overall ${signed(od)} after ${vPlural(weeks, 'week')}: no clear change yet.`;
    v.meaning = 'Expected at this stage: skin renews about every 4 weeks, so most actives look subtle at first.';
    v.next = 'Stay consistent until at least week 6 before deciding.';
  } else if (v.type === 'adjust') {
    v.text = `Overall ${signed(od)} after ${vPlural(weeks, 'week')}${worst ? `; ${lc(worst.label)} slipped ${signed(worst.d)}` : ''}.`;
    v.title = 'Time to adjust';
    v.meaning = "Six weeks covers more than one skin-renewal cycle, so this product most likely doesn't target what your skin needs most.";
    v.next = 'Switch to (or add) one option below. Change one product at a time and give it 6–8 weeks.';
    v.watch = `With the new product, track ${summary.weak.map((x) => lc(x.label)).join(', ')} – your lowest scores right now.`;
  } else { // stop
    v.text = `Overall ${signed(od)} since your first scan${worst ? `, led by ${lc(worst.label)} ${signed(worst.d)}` : ''}.`;
    v.meaning = 'A drop like this usually means irritation or a poor match. "Purging" only affects breakouts, not redness or hydration.';
    v.next = 'Pause it now. Use only a gentle cleanser, plain moisturiser and SPF for 1–2 weeks; see a dermatologist if redness or burning continues.';
    v.watch = 'On your next scan, check whether the scores that dropped bounce back. If they do, this product was the cause.';
  }
  if (heavyWarn && !actives.some((a) => a.heavy)) v.watchExtra = 'Heads-up: occlusives like petroleum jelly can feel heavy and trap oil on oily or acne-prone skin – use a thin layer only on dry areas.';

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
