// js/storage.js
// Everything is saved in the browser with localStorage (no database needed).
// Shape: { profile: {name, product, startDate}, scans: [ {date, overall, skinAge, concerns:{acne: 70,...}, thumb} ] }
const STORE_KEY = 'glowcheck_v1';

function loadData() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || { profile: null, scans: [] }; }
  catch { return { profile: null, scans: [] }; }
}

function saveData(data) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
  catch (e) {
    // Storage full? Drop old thumbnails (keep scores) and try again, then drop all thumbnails.
    try {
      data.scans.forEach((s, i) => { if (i < data.scans.length - 3) s.thumb = null; });
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (e2) {
      try {
        data.scans.forEach((s) => { s.thumb = null; });
        localStorage.setItem(STORE_KEY, JSON.stringify(data));
      } catch (e3) {
        throw new Error('Your browser storage is full (or blocked in private mode), so this scan could not be saved.');
      }
    }
  }
}

// Only keep the numbers we need – YouCam result URLs expire after ~2 hours.
function addScan(result, thumb) {
  const data = loadData();
  const concerns = {};
  for (const [k, v] of Object.entries(result.concerns)) concerns[k] = v.ui;
  data.scans.push({ date: new Date().toISOString(), overall: result.overall, skinAge: result.skinAge, concerns, thumb });
  saveData(data);
  return data;
}
