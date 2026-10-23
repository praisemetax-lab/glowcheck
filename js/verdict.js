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
  if (sorted.length && sorted[0].d > 0) reasons.push(`${CONCERNS[sorted[0].k].label} went up ${sorted[0].d} points`);
  if (sorted.length && sorted[sorted.length - 1].d < 0) {
    const w = sorted[sorted.length - 1];
    reasons.push(`${CONCERNS[w.k].label} went down ${-w.d} points`);
  }
  reasons.push(`Total score ${overallDelta >= 0 ? '+' : ''}${overallDelta} since your first selfie`);

  if (scans.length < 2) {
    return { type: 'wait', title: 'First selfie saved', text: 'Come back in a week for the next one.', reasons: [] };
  }
  if (rednessDelta <= -6) {
    return { type: 'stop', title: 'Your skin looks upset', text: 'It may not like this product.', irritated: true, reasons: [`Calm skin went down ${-rednessDelta} points`, ...reasons] };
  }
  if (overallDelta <= -5) {
    return { type: 'stop', title: 'Time to take a break', text: 'Your skin is doing worse than when you started.', reasons };
  }
  if (days < 14) {
    return { type: 'wait', title: 'Too early to tell', text: `Only ${days} ${days === 1 ? 'day' : 'days'} in.`, reasons };
  }
  if (overallDelta >= 3 || focusDelta >= 3) {
    return { type: 'keep', title: 'It’s working – keep going', text: 'Your skin is getting better.', reasons };
  }
  if (days < 42) {
    return { type: 'keep', title: 'Give it more time', patient: true, text: 'No big change yet.', reasons };
  }
  return { type: 'adjust', title: 'Time to try something else', text: 'Not much has changed.', reasons };
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
  if (n >= 80) return 'really healthy';
  if (n >= 70) return 'healthy, with a few spots to work on';
  if (n >= 60) return 'okay, with room to glow more';
  return 'like it needs some extra care';
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
      : "We don't know this one yet. Check the label for a main ingredient, like niacinamide, salicylic acid or vitamin C.",
    matches: targets.map(label),
    fit: !actives.length ? 'unknown' : targets.length ? (targets.length >= 2 ? 'good' : 'partial') : 'off',
    heavyWarn
  };
  v.watch = actives.length ? actives[0].watch : 'Watch your lowest scores. If the product suits you, they should rise first.';

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
  const patient = !!v.patient;
  const name = profile.name ? profile.name.split(' ')[0] : '';
  const hi = name ? `${name}, ` : '';
  const P = profile.product || 'this product';
  const now = summary.overall ?? '--';
  const big = (c) => c && Math.abs(c.d) >= 6;
  const list = (arr) => arr.length <= 1 ? (arr[0] || '') : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
  const weakNames = list(summary.weak.map((x) => lc(x.label)));
  const matchNames = list(v.product.matches.map(lc));
  const fitLine = v.product.fit === 'good' ? `Nice pick. It works on ${matchNames}, which need the most love right now.`
    : v.product.fit === 'partial' ? `It helps with ${matchNames}. It won't do much for the rest.`
    : v.product.fit === 'off' ? `It isn't made for ${weakNames}, which need the most help.`
    : "We don't know this product's main ingredient yet.";
  const n = scans.length;

  if (n < 2) {
    v.title = name ? `Got it, ${name}! First selfie saved` : 'First selfie saved';
    v.text = `Your starting score is ${now}. Your skin looks ${overallWords(summary.overall)}.`;
    v.meaning = fitLine;
    v.next = 'Take your next selfie in 7 days. Same spot, same light, same time of day.';
  } else if (v.type === 'wait') {
    v.text = od > 0 ? `${hi}you're up ${od} after ${vPlural(days, 'day')}${best ? ` – ${lc(best.label)} rose the most` : ''}. A nice start!`
      : od < 0 ? `${hi}you're down ${-od} after ${vPlural(days, 'day')}. That's okay this early.`
      : `${hi}no change yet after ${vPlural(days, 'day')}. That's normal.`;
    v.meaning = od < 0 ? 'Light, sleep and weather can shift scores a little. One dip early on means very little.'
      : 'Skin takes about 4 weeks to renew itself. Real changes show up after that.';
    v.next = `Keep using ${P} every day. Scan again next week.`;
  } else if (v.type === 'keep' && !patient) {
    const mixed = big(best) && big(worst);
    v.title = od >= 8 ? (name ? `Great news, ${name}!` : 'Great news!') : mixed ? 'Mostly good news' : 'It’s working – keep going';
    v.text = mixed ? `${best.label} is up ${best.d}, but ${lc(worst.label)} is down ${-worst.d}. Your score is now ${now}.`
      : od > 0 ? `Your score went up ${od} in ${vPlural(weeks, 'week')}${best ? `. ${best.label} improved the most (+${best.d})` : ''}.`
      : `${best ? `${best.label} is up ${best.d}` : 'Your key areas are up'}, even though your total is ${signed(od)}. Your score is ${now}.`;
    v.meaning = mixed ? `${P} seems to help overall. Keep an eye on ${lc(worst.label)} so it doesn't keep slipping.`
      : od >= 8 ? 'That is a big jump. Your skin clearly likes this product.'
      : `Small steady wins add up. ${worst ? `The little dip in ${lc(worst.label)} is normal.` : 'Nothing has slipped.'}`;
    v.next = mixed && worst.k === 'moisture' ? 'Keep going, and add a simple moisturiser to help hydration.'
      : mixed ? `Keep going. If ${lc(worst.label)} drops again next week, use ${P} every other day.`
      : "Don't change a thing. Keep up the sunscreen and scan each week.";
  } else if (patient) {
    v.text = `Week ${weeks} and your score is ${now} (${signed(od)}). Not much has moved yet.`;
    v.meaning = v.product.fit === 'off' ? `That makes sense. ${fitLine}` : 'Most products take 6 to 8 weeks to show. You are not there yet.';
    v.next = `Stick with it until week 6 (${vPlural(Math.max(1, 6 - weeks), 'more week')}), then we'll decide together.`;
  } else if (v.type === 'adjust') {
    v.text = `After ${vPlural(weeks, 'week')}, your score is ${now} (${signed(od)})${worst ? `. ${worst.label} slipped ${-worst.d}` : ''}.`;
    v.meaning = v.product.fit === 'off' ? `${fitLine} That's likely why little changed.` : 'That is long enough to see results. This one just isn’t doing much for you.';
    v.next = 'Try one of the options below. Swap one thing at a time and give it 6 weeks.';
    v.watch = `With the new product, watch ${weakNames}. Those are your lowest scores now.`;
  } else { // stop
    if (v.irritated) {
      v.text = `Calm skin dropped ${-(last.concerns.redness - base.concerns.redness)} points${(last.concerns.moisture ?? 0) < (base.concerns.moisture ?? 0) ? ' and hydration is down too' : ''}. Your skin may be irritated.`;
      v.meaning = 'Stinging, dryness or darker patches can all be signs. This is not "purging" – purging only means pimples.';
    } else {
      v.text = `Your score fell ${-od} points to ${now}${worst ? `, mostly from ${lc(worst.label)} (${signed(worst.d)})` : ''}.`;
      v.meaning = `A drop this size usually means ${P} isn't a good match for your skin.`;
    }
    v.next = 'Stop using it for 1–2 weeks. Just wash gently, moisturise and wear sunscreen. See a doctor if it burns or gets worse.';
    v.watch = 'Next scan, check if your scores bounce back. If they do, the product was the problem.';
  }
  if (heavyWarn && !actives.some((a) => a.heavy)) v.watchExtra = 'Tip: thick balms and petroleum jelly can feel heavy on oily skin. Use a thin layer on dry spots only.';

  // "Try instead" cards: ADJUST / STOP, or a baseline where the product misses the weakest concerns.
  const wantRecs = v.type === 'adjust' || v.type === 'stop' || (scans.length < 2 && v.product.fit === 'off');
  if (wantRecs) {
    let recs = pickRecs(weakKeys, actives, 3);
    if (v.type === 'stop' && !recs.some((r) => r.id === 'gentle')) recs = [{ id: 'gentle', for: 'redness', ...ALTERNATIVES.gentle }, ...recs].slice(0, 3);
    if (oilyOrAcne) recs = recs.filter((r) => r.id !== 'petrolatum'); // heavy occlusives don't suit oily/acne-prone weak areas
    v.recs = recs.map((r) => ({ ...r, forLabel: label(r.for) }));
    v.recsIntro = v.type === 'stop' ? 'Gentle picks while your skin calms down:'
      : v.type === 'adjust' ? `These work on what needs help most: ${summary.weak.map((x) => lc(x.label)).join(', ')}.`
      : `Your product skips the areas that need the most help. These don't:`;
  } else v.recs = [];
  return v;
}
