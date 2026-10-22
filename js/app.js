// js/app.js
// Main app logic: switching screens, taking photos, calling our /api, showing results.

// ---------- Small helpers ----------
const $ = (id) => document.getElementById(id);
let chart = null;          // Chart.js instance
let lastResult = null;     // latest analysis (with mask URLs) – only kept in memory
let lastPhoto = null;      // data URL of latest selfie (not saved)

// Show one screen ("view") and hide the others.
function show(name) {
  document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
  $('view-' + name).classList.remove('hidden');
  window.scrollTo(0, 0);
  if (name === 'dash') renderDashboard();
  if (name === 'onboard') prepOnboard();
  $('btnClearAll').classList.toggle('hidden', !loadAll().products.length);
}

// Setup form doubles as "add another product" when products already exist.
function prepOnboard() {
  const all = loadAll(); const adding = all.products.length > 0;
  $('formTitle').textContent = adding ? 'Add another product' : "Let's set up your glow check";
  $('btnCancelAdd').classList.toggle('hidden', !adding);
  if (adding && !$('inName').value) $('inName').value = all.name || '';
  if (adding) {
    $('inStart').value = new Date().toISOString().slice(0, 10);
    requestAnimationFrame(() => { $('onboardForm').scrollIntoView({ block: 'start' }); $('inProduct').focus({ preventScroll: true }); });
  }
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 6000);
}

// fetch + JSON with a timeout and friendly errors (handles offline, HTML error pages, timeouts).
async function fetchJson(url, options = {}, timeoutMs = 60000) {
  let res;
  try { res = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) }); }
  catch (e) {
    throw new Error(e.name === 'TimeoutError' ? 'The server took too long to respond. Please try again.'
      : 'Network problem – check your internet connection and try again.');
  }
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON error page */ }
  if (!res.ok) {
    const fallback = res.status === 429 ? 'The analysis service is busy. Please wait a minute and try again.'
      : res.status === 413 ? 'That photo is too large to send. Please try a smaller photo.'
      : res.status >= 500 ? `Server error (${res.status}). Please try again in a moment.` : 'Something went wrong.';
    const err = new Error(data.error || fallback); err.status = res.status; throw err;
  }
  return data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

// ---------- Start-up ----------
document.addEventListener('DOMContentLoaded', () => {
  $('inStart').value = new Date().toISOString().slice(0, 10);

  // Any button with data-go="dash" etc. switches screens.
  document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => show(b.dataset.go)));

  $('onboardForm').addEventListener('submit', (e) => {
    e.preventDefault();
    try { addProduct($('inName').value.trim(), $('inProduct').value.trim(), $('inStart').value); }
    catch (err) { return toast(err.message); }
    $('inProduct').value = '';
    show('dash');
  });

  // "+ Add product": open the setup form WITHOUT deleting anything (keeps the old id for other code).
  $('btnReset').addEventListener('click', () => show('onboard'));
  $('btnCancelAdd').addEventListener('click', () => show('dash'));

  $('btnDeleteProduct').addEventListener('click', () => {
    const d = loadData(); if (!d.profile) return;
    if (confirm(`Delete "${d.profile.product}" and its ${d.scans.length} scan${d.scans.length === 1 ? '' : 's'}? This can't be undone.`)) {
      deleteProduct(d.id);
      show(loadAll().products.length ? 'dash' : 'onboard');
    }
  });

  $('btnClearAll').addEventListener('click', () => {
    if (confirm('Start over? This deletes ALL products and scan history saved in this browser.')) {
      clearAllData();
      $('inName').value = '';
      show('onboard');
    }
  });

  $('btnScan').addEventListener('click', () => show('capture'));
  $('btnRemindScan').addEventListener('click', () => show('capture'));
  $('remindTime').addEventListener('change', () => { setRemindTime($('remindTime').value || '09:00'); renderReminder(); });
  $('btnIcs').addEventListener('click', () => {
    const p = activeProduct(loadAll()); if (!p) return;
    const ics = buildICS(p.product, dueInfo(p).next, $('remindTime').value || '09:00');
    window.__lastIcs = ics; // handy for testing
    openICS(ics, 'glowcheck-' + p.product.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '.ics');
  });
  $('fileInput').addEventListener('change', onFilePicked);
  $('fileInputCam').addEventListener('change', onFilePicked);
  $('btnCameraKit').addEventListener('click', openCameraKit);
  $('maskToggle').addEventListener('change', () => $('maskImg').classList.toggle('hidden', !$('maskToggle').checked || !$('maskImg').getAttribute('src')));

  // Ask the server if we're in demo/mock mode (just for the badge).
  fetch('/api/health').then((r) => r.json()).then((h) => { if (h.mock) $('mockBadge').classList.remove('hidden'); }).catch(() => {});

  show(loadAll().products.length ? 'dash' : 'onboard');
});

// ---------- Dashboard ----------
function renderDashboard() {
  const { profile, scans } = loadData();
  if (!profile) return show('onboard');
  $('hello').textContent = 'Hi ' + profile.name + ' 👋  Testing:';
  $('productName').textContent = profile.product;
  const day = Math.max(1, daysBetween(profile.startDate, new Date()) + 1);
  $('dayCount').textContent = `Day ${day} · ${scans.length} scan${scans.length === 1 ? '' : 's'}`;

  renderSwitcher();
  renderReminder();

  // Verdict card
  const v = getVerdict(profile, scans);
  const vc = $('verdictCard');
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rc = $('recsCard');
  if (v) {
    vc.className = 'card verdict ' + v.type;
    const chip = (c) => `<li class="dchip ${c.d > 0 ? 'up' : 'down'}">${esc(c.label)} ${c.d > 0 ? '+' + c.d : '−' + Math.abs(c.d)}</li>`;
    const scoreList = (arr) => arr.map((x) => `<li><span>${esc(x.label)}</span><b style="color:${scoreColor(x.s)}">${x.s}</b></li>`).join('');
    vc.innerHTML = `<span class="tag">${v.type.toUpperCase()}</span><h3 class="v-title">${esc(v.title)}</h3><p class="v-text">${esc(v.text)}</p>` +
      (v.changes && v.changes.length ? `<p class="v-label">What changed since your first scan</p><ul class="dchips">${v.overallDelta != null ? `<li class="dchip ${v.overallDelta > 0 ? 'up' : v.overallDelta < 0 ? 'down' : 'flat'}">Overall ${v.overallDelta > 0 ? '+' : v.overallDelta < 0 ? '−' : '±'}${Math.abs(v.overallDelta)}</li>` : ''}${v.changes.map(chip).join('')}</ul>` : '') +
      (scans.length < 2 && v.summary ? `<div class="v-split"><div><p class="v-label">Strongest</p><ul class="v-scores">${scoreList(v.summary.strong)}</ul></div><div><p class="v-label">Needs care</p><ul class="v-scores">${scoreList(v.summary.weak)}</ul></div></div>` : '') +
      (v.meaning ? `<p class="v-label">What it means</p><p>${esc(v.meaning)}</p>` : '') +
      (v.product ? `<p class="v-label">About ${esc(v.product.name)}</p><p>${esc(v.product.about)}</p>` : '') +
      `<div class="v-next"><p class="v-label">Next step</p><p>${esc(v.next)}</p></div>` +
      (v.watch ? `<p class="v-label">What to watch</p><p class="muted">${esc(v.watch)}${v.watchExtra ? ' ' + esc(v.watchExtra) : ''}</p>` : '');
    if (v.recs && v.recs.length) {
      rc.className = 'recs';
      rc.innerHTML = `<p class="kicker">Try instead</p><h3 id="recsTitle" class="recs-title">Better matches for <em>your</em> skin</h3><p class="muted">${esc(v.recsIntro)}</p>
        <ul class="rec-list">${v.recs.map((r, i) => `<li class="rec-card">
          <span class="rec-num">0${i + 1}</span><span class="rec-for">For ${esc(r.forLabel)}</span>
          <h4>${esc(r.name)}</h4><p>${esc(r.why)}</p>
          <p class="rec-label"><b>On the label:</b> ${esc(r.label)}</p>
          <p class="rec-ex"><b>Examples:</b> ${r.examples.map((e) => `<a href="${searchUrl(e)}" target="_blank" rel="noopener">${esc(e)}</a>`).join(' · ')}</p>
        </li>`).join('')}</ul>
        <p class="fine">Not medical advice. Patch test new products on your jaw for 2–3 days first, and introduce one at a time. Example links are plain web searches.</p>`;
    } else { rc.className = 'recs hidden'; rc.innerHTML = ''; }
  } else { vc.className = 'card verdict hidden'; vc.innerHTML = ''; rc.className = 'recs hidden'; rc.innerHTML = ''; }

  // History list (newest first)
  $('historyList').innerHTML = scans.length ? scans.slice().reverse().map((s, i) => `
    <li>${s.thumb ? `<img src="${s.thumb}" alt="">` : '<span class="thumb-ph" aria-hidden="true"></span>'}
      <div><b>${fmtDate(s.date)}</b><br><span class="muted">${i === scans.length - 1 ? 'Baseline' : 'Week ' + Math.round(daysBetween(scans[0].date, s.date) / 7)}</span></div>
      <span class="score" style="color:${scoreColor(s.overall)}" aria-label="Score ${s.overall ?? 'unknown'}">${s.overall ?? '--'}</span></li>`).join('')
    : '<li class="muted">No scans yet.</li>';

  renderChart(scans);
}

// "My products" switcher: one pill-card per product with name, days and latest verdict tag.
function renderSwitcher() {
  const all = loadAll(); const active = activeProduct(all);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  $('productList').innerHTML = all.products.map((p) => {
    const v = getVerdict({ name: all.name, product: p.product, startDate: p.startDate }, p.scans);
    const day = Math.max(1, daysBetween(p.startDate, new Date()) + 1);
    const on = active && p.id === active.id;
    return `<button type="button" role="listitem" class="pcard${on ? ' active' : ''}" data-id="${p.id}" aria-current="${on}">
      <span class="pname">${esc(p.product)}${isDue(p) ? '<span class="due-dot" aria-hidden="true"></span>' : ''}</span>
      <span class="pmeta">Day ${day} · ${p.scans.length} scan${p.scans.length === 1 ? '' : 's'}${isDue(p) ? ' · <b class="due-txt">Selfie due</b>' : ''}</span>
      <span class="ptag ${v ? v.type : 'none'}">${v ? v.type.toUpperCase() : 'NO SCANS'}</span>
    </button>`;
  }).join('');
  $('productList').querySelectorAll('.pcard').forEach((b) => b.addEventListener('click', () => {
    setActiveProduct(b.dataset.id); renderDashboard();
  }));
  const act = $('productList').querySelector('.active'); if (act) act.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

// Weekly reminder banner + calendar buttons for the ACTIVE product.
function renderReminder() {
  const all = loadAll(); const p = activeProduct(all); if (!p) return;
  const info = dueInfo(p);
  $('remindCard').className = 'remind ' + info.status;
  $('remindIcon').textContent = info.status === 'upcoming' ? '🗓️' : info.status === 'overdue' ? '⏰' : '✨';
  $('remindText').textContent = info.text;
  $('remindSub').textContent = info.sub;
  $('btnScan').textContent = info.status === 'upcoming' ? "📸 Take an extra selfie" : "📸 Take this week's selfie";
  $('btnRemindScan').classList.toggle('hidden', info.status === 'upcoming');
  $('remindTime').value = getRemindTime();
  const t = $('remindTime').value || '09:00';
  $('calStart').textContent = fmtDue(reminderEvent(p.product, info.next, t).start) + ' at ' + t;
  $('lnkGcal').href = googleCalUrl(p.product, info.next, t);
}

function renderChart(scans) {
  $('trendEmpty').classList.toggle('hidden', scans.length > 0);
  if (chart) { chart.destroy(); chart = null; }
  $('trendChart').classList.toggle('hidden', !scans.length);
  if (!scans.length) return;
  if (!window.Chart) { $('trendEmpty').textContent = 'Chart could not load (offline?). Your scores are in the history below.'; $('trendEmpty').classList.remove('hidden'); return; }
  const labels = scans.map((s) => fmtDate(s.date));
  const line = (label, values, color, dash) => ({ label, data: values, borderColor: color, backgroundColor: color, tension: .35, borderWidth: 2.5, borderDash: dash || [], pointRadius: 4 });
  chart = new Chart($('trendChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        line('Overall', scans.map((s) => s.overall), '#b4584a'),
        line('Dark spots', scans.map((s) => s.concerns.age_spot), '#a8533f', [5, 4]),
        line('Acne', scans.map((s) => s.concerns.acne), '#d4708a', [5, 4]),
        line('Oiliness', scans.map((s) => s.concerns.oiliness), '#c99a4a', [5, 4])
      ]
    },
    options: { plugins: { legend: { labels: { boxWidth: 12, usePointStyle: true, font: { family: 'DM Sans' }, color: '#6e5048' } } }, scales: { y: { suggestedMin: 40, suggestedMax: 100 } } }
  });
}

// ---------- Getting a photo ----------
// Option A: normal file input (works everywhere, opens the camera on phones).
async function onFilePicked(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (!/^image\/(jpeg|png)$/.test(file.type)) return toast('Please choose a JPG or PNG photo.');
  if (file.size > 30 * 1024 * 1024) return toast('That photo file is very large (over 30MB). Please choose a smaller photo.');
  const reader = new FileReader();
  reader.onload = () => analyse(reader.result);
  reader.readAsDataURL(file);
}

// Option B: YouCam JS Camera Kit – guided capture that checks lighting + face position.
// Docs: load sdk.js, define window.ymkAsyncInit, then YMK.init({...}) and YMK.openCameraKit().
let cameraKitReady = false;
function openCameraKit() {
  const start = () => {
    YMK.init({ faceDetectionMode: 'skincare', imageFormat: 'base64', language: 'enu' });
    YMK.openCameraKit();
  };
  if (cameraKitReady) return start();
  window.ymkAsyncInit = function () {
    cameraKitReady = true;
    YMK.addEventListener('faceDetectionCaptured', (result) => {
      let img = result.images[0].image;
      if (!img.startsWith('data:')) img = 'data:image/jpeg;base64,' + img;
      YMK.close();
      analyse(img);
    });
    YMK.addEventListener('cameraFailed', () => toast('Camera not available. Please use "Upload or snap a photo".'));
    start();
  };
  const s = document.createElement('script');
  s.src = 'https://plugins-media.makeupar.com/v2.2-camera-kit/sdk.js';
  s.async = true;
  s.onerror = () => toast('Could not load the guided camera. Please use upload instead.');
  document.body.appendChild(s);
}

// Resize the photo in the browser so it meets YouCam's rules and is small enough to send:
// short side >= 480px, long side <= 1920px (well under the 4096 limit and Vercel's 4.5MB body limit).
function preparePhoto(dataUrl, maxLong = 1920) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const long = Math.max(img.width, img.height), short = Math.min(img.width, img.height);
      if (short < 480) return reject(new Error('Photo is too small – it must be at least 480px on its short side.'));
      const scale = Math.min(1, maxLong / long);
      if (Math.round(short * scale) < 480) return reject(new Error('Photo shape is too long and thin. Please use a normal portrait selfie.'));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = dataUrl;
  });
}

// A tiny thumbnail (for the history list) – small so localStorage doesn't fill up.
function makeThumb(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); const s = 96;
      const side = Math.min(img.width, img.height);
      c.width = c.height = s;
      c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, s, s);
      resolve(c.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

// ---------- Analysis ----------
async function analyse(rawDataUrl) {
  let photo;
  try { photo = await preparePhoto(rawDataUrl); } catch (e) { return toast(e.message); }
  lastPhoto = photo;
  $('toast').classList.add('hidden'); // clear any old error
  $('loadingPhoto').src = photo;
  $('loadingMsg').textContent = 'Uploading photo…';
  show('loading');

  try {
    const week = loadData().scans.length; // used by mock mode to simulate progress
    const data = await fetchJson('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: photo, week }) });

    let result;
    if (data.mock) {
      $('loadingMsg').textContent = 'Demo mode: generating sample results…';
      await sleep(1800); // feel like a real scan
      result = data.result;
    } else {
      result = await pollTask(data.taskId);
    }

    if (!result || !result.concerns) throw new Error('The analysis returned no results. Please try another photo.');
    lastResult = result;
    let saveError = null;
    try { addScan(result, await makeThumb(photo)); } // save scores immediately (URLs expire in ~2h)
    catch (err) { saveError = err; }
    renderResults(result);
    show('results');
    if (saveError) toast(saveError.message);
  } catch (e) {
    show('capture');
    toast(e.message);
  }
}

// Ask our server every 3 seconds until YouCam says success or error (max ~2 minutes).
async function pollTask(taskId) {
  const msgs = ['Finding your face…', 'Checking dark spots & marks…', 'Measuring oiliness & pores…', 'Almost done…'];
  let fails = 0;
  for (let i = 0; i < 40; i++) {
    $('loadingMsg').textContent = msgs[Math.min(i, msgs.length - 1)];
    await sleep(3000);
    let data;
    try { data = await fetchJson('/api/status?id=' + encodeURIComponent(taskId), {}, 30000); }
    catch (e) { if (e.status === 429 || e.status >= 500 || !e.status) { if (++fails <= 3) continue; } throw e; } // retry blips
    fails = 0;
    if (data.status === 'success') return data.result;
    if (data.status === 'error') throw new Error(data.error);
  }
  throw new Error('The analysis is taking too long. Please try again.');
}

// ---------- Results screen ----------
const CONCERN_ICONS = { age_spot: '🌗', acne: '🫧', oiliness: '💧', pore: '🔍', redness: '🌹', texture: '🪶', moisture: '💦',
  radiance: '✨', dark_circle_v2: '👁️', eye_bag: '😴', wrinkle: '〰️' };
// Coloured "change since first scan" pill: green = better, rose = worse, grey = no change.
function deltaBadge(d) {
  const cls = d > 0 ? 'up' : d < 0 ? 'down' : 'neutral';
  const txt = d > 0 ? `▲ +${d} since first scan` : d < 0 ? `▼ −${Math.abs(d)} since first scan` : 'No change since first scan';
  return `<span class="delta-badge ${cls}">${txt}</span>`;
}
function renderResults(result) {
  const { scans } = loadData();
  const base = scans[0];

  $('overallScore').textContent = result.overall ?? '--';
  $('scoreRing').style.setProperty('--p', result.overall || 0);
  $('skinAge').textContent = result.skinAge ? `Skin age: ${result.skinAge}` : '';
  if (scans.length > 1 && result.overall != null && base.overall != null) {
    $('deltaText').innerHTML = deltaBadge(result.overall - base.overall);
  } else $('deltaText').innerHTML = '<span class="delta-badge neutral">📌 This is your baseline</span>';

  // Photo + mask chips
  // Masks are drawn on YouCam's resized copy of the photo (same aspect, transparent PNG
  // overlays), so use that as the base when we have it; fall back to the local photo.
  $('resultPhoto').onerror = () => { $('resultPhoto').onerror = null; $('resultPhoto').src = lastPhoto; };
  $('resultPhoto').src = result.resizedImage || lastPhoto;
  const keys = Object.keys(result.concerns).filter((k) => CONCERNS[k] && typeof result.concerns[k].ui === 'number');
  // Show focus concerns first, then lowest scores first.
  keys.sort((a, b) => (CONCERNS[b].focus - CONCERNS[a].focus) || (result.concerns[a].ui - result.concerns[b].ui));
  // Only offer masks that are worth showing: has a URL and score below 95 (near-perfect scores
  // come back as empty, fully transparent masks). Empty masks are also removed after a pixel check.
  const withMask = keys.filter((k) => result.concerns[k].mask && result.concerns[k].ui < 95);
  const setMask = (k) => {
    if (k) $('maskImg').src = result.concerns[k].mask; else $('maskImg').removeAttribute('src');
    $('maskImg').alt = k ? `${CONCERNS[k].label} areas highlighted` : '';
    $('maskImg').classList.toggle('hidden', !k || !$('maskToggle').checked);
    document.querySelectorAll('.chip').forEach((c) => { c.classList.toggle('active', c.dataset.k === k); c.setAttribute('aria-pressed', c.dataset.k === k); });
  };
  const drawChips = (list) => {
    $('maskChips').innerHTML = list.map((k) => `<button type="button" class="chip" data-k="${k}">${CONCERNS[k].label}</button>`).join('');
    document.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => setMask(c.dataset.k)));
    $('maskControls').classList.toggle('hidden', !list.length);
    $('maskNote').classList.toggle('hidden', !list.length);
    const current = list.find((k) => $('maskImg').getAttribute('src') === result.concerns[k].mask);
    setMask(current || list[0]);
  };
  drawChips(withMask);
  // Best-effort: drop masks that are fully transparent (needs CORS on the mask host; skipped if blocked).
  const token = (renderResults.token = {});
  Promise.all(withMask.map((k) => isMaskEmpty(result.concerns[k].mask))).then((empty) => {
    if (renderResults.token !== token || !empty.some(Boolean)) return;
    drawChips(withMask.filter((k, i) => !empty[i]));
  });

  // Concern cards
  $('concernCards').innerHTML = keys.map((k) => {
    const c = CONCERNS[k], s = result.concerns[k].ui;
    const prev = base && scans.length > 1 ? base.concerns[k] : null;
    const change = prev != null ? s - prev : null;
    return `<div class="concern">
      <div class="concern-head">
        <div class="mini-ring" style="--p:${s};--c:${scoreColor(s)}" role="img" aria-label="${c.label} score ${s} out of 100">
          <span class="mini-num" style="color:${scoreColor(s)}">${s}</span>
        </div>
        <div class="concern-info">
          <b class="concern-name"><span class="c-icon" aria-hidden="true">${CONCERN_ICONS[k] || '✨'}</span>${c.label}${c.focus ? '<span class="focus">focus</span>' : ''}</b>
          ${change != null ? deltaBadge(change) : '<span class="delta-badge neutral">Baseline</span>'}
        </div>
      </div>
      <details ${s < 65 ? 'open' : ''}><summary>Ingredient tips</summary><p>${c.tip}</p>${c.avoid ? `<p class="muted">⚠️ ${c.avoid}</p>` : ''}</details>
    </div>`;
  }).join('');
}

// Resolves true only if the mask image loads and every pixel is transparent.
// If the image can't be read (CORS / error / timeout) we assume it is NOT empty.
function isMaskEmpty(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => resolve(false), 8000);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const w = Math.min(200, img.naturalWidth || 200), h = Math.min(200, img.naturalHeight || 200);
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, w, h);
        const px = ctx.getImageData(0, 0, w, h).data;
        for (let i = 3; i < px.length; i += 4) if (px[i] > 8) return resolve(false);
        resolve(true);
      } catch { resolve(false); }
    };
    img.onerror = () => { clearTimeout(timer); resolve(false); };
    img.src = url;
  });
}
