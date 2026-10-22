// js/storage.js
// Everything is saved in the browser with localStorage (no database needed).
// v2 shape (multi-product):
//   { name, activeId, products: [ { id, product, startDate, scans: [ {date, overall, skinAge, concerns:{acne: 70,...}, thumb} ] } ] }
// Old v1 shape ({ profile:{name, product, startDate}, scans:[...] } under 'glowcheck_v1') is migrated automatically.
// loadData()/saveData() still return/accept the ACTIVE product as { profile, scans } so older code keeps working.
const STORE_KEY = 'glowcheck_v2';
const OLD_KEY = 'glowcheck_v1';

const emptyAll = () => ({ name: '', activeId: null, products: [] });
const newId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function readJson(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }

function loadAll() {
  const all = readJson(STORE_KEY);
  if (all && Array.isArray(all.products)) return all;
  // Migrate v1 single-product data (keeps every scan).
  const old = readJson(OLD_KEY);
  if (old && old.profile) {
    const id = newId();
    const migrated = { name: old.profile.name || '', activeId: id,
      products: [{ id, product: old.profile.product, startDate: old.profile.startDate, scans: Array.isArray(old.scans) ? old.scans : [] }] };
    try { writeAll(migrated); localStorage.removeItem(OLD_KEY); } catch { /* keep v1 copy if we couldn't save */ }
    return migrated;
  }
  return emptyAll();
}

function writeAll(all) { localStorage.setItem(STORE_KEY, JSON.stringify(all)); }

// Save with quota handling: drop old thumbnails first (keep the 3 newest per product), then all thumbnails.
function saveAll(all) {
  try { return writeAll(all); } catch (e) { /* fall through */ }
  try {
    all.products.forEach((p) => p.scans.forEach((s, i) => { if (i < p.scans.length - 3) s.thumb = null; }));
    return writeAll(all);
  } catch (e2) { /* fall through */ }
  try {
    all.products.forEach((p) => p.scans.forEach((s) => { s.thumb = null; }));
    return writeAll(all);
  } catch (e3) {
    throw new Error('Your browser storage is full (or blocked in private mode), so this could not be saved.');
  }
}

function activeProduct(all) { return all.products.find((p) => p.id === all.activeId) || all.products[0] || null; }

// Active product in the legacy { profile, scans } shape.
function loadData() {
  const all = loadAll(); const p = activeProduct(all);
  if (!p) return { profile: null, scans: [] };
  return { profile: { name: all.name, product: p.product, startDate: p.startDate }, scans: p.scans, id: p.id };
}

function saveData(data) {
  const all = loadAll(); const p = activeProduct(all);
  if (!p) return;
  if (data.profile) { all.name = data.profile.name; p.product = data.profile.product; p.startDate = data.profile.startDate; }
  p.scans = data.scans;
  saveAll(all);
}

function addProduct(name, product, startDate) {
  const all = loadAll(); const id = newId();
  all.name = name || all.name;
  all.products.push({ id, product, startDate, scans: [] });
  all.activeId = id;
  saveAll(all);
  return id;
}

function setActiveProduct(id) { const all = loadAll(); if (all.products.some((p) => p.id === id)) { all.activeId = id; saveAll(all); } }

function deleteProduct(id) {
  const all = loadAll();
  all.products = all.products.filter((p) => p.id !== id);
  if (all.activeId === id) all.activeId = all.products.length ? all.products[all.products.length - 1].id : null;
  saveAll(all);
}

function clearAllData() { localStorage.removeItem(STORE_KEY); localStorage.removeItem(OLD_KEY); }

// Only keep the numbers we need – YouCam result URLs expire after ~2 hours. New scans go to the ACTIVE product.
function addScan(result, thumb) {
  const all = loadAll(); const p = activeProduct(all);
  if (!p) throw new Error('No product selected.');
  const concerns = {};
  for (const [k, v] of Object.entries(result.concerns)) concerns[k] = v.ui;
  p.scans.push({ date: new Date().toISOString(), overall: result.overall, skinAge: result.skinAge, concerns, thumb });
  saveAll(all);
  return loadData();
}
