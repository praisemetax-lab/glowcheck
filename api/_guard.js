// api/_guard.js
// Credit protection for REAL scans (Vercel functions are stateless, so no in-memory counters).
// Uses two FREE YouCam info endpoints (they only read account data; units are only deducted by AI features):
//   GET /s2s/v1.0/client/credit          -> remaining units (amount_dec)
//   GET /s2s/v1.0/client/credit/history  -> recent unit deductions (used as a true daily counter)
// Refuses a real scan if units are below CREDIT_FLOOR (default 150) or if SCAN_DAILY_LIMIT (default 20)
// unit-spending events already happened today (UTC). Fails CLOSED (refuse) if YouCam can't be checked.
const { youcam } = require('./_youcam');

const num = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : d);

async function remainingUnits() {
  const r = await youcam('/s2s/v1.0/client/credit', { method: 'GET' });
  const list = r.results || r.result || [];
  return list.reduce((sum, c) => sum + Number(c.amount_dec ?? c.amount ?? 0), 0);
}

async function scansToday(limit) {
  const start = new Date(); start.setUTCHours(0, 0, 0, 0);
  let token = null, count = 0;
  for (let page = 0; page < 3; page++) { // 3 x 30 entries is plenty for a limit of ~20/day
    const q = '?page_size=30' + (token ? '&starting_token=' + encodeURIComponent(token) : '');
    const r = await youcam('/s2s/v1.0/client/credit/history' + q, { method: 'GET' });
    const hist = (r.result && r.result.history) || [];
    let older = false;
    for (const h of hist) {
      if (Number(h.timestamp) < start.getTime()) { older = true; break; }
      const spent = ((h.info && h.info.credits) || []).some((c) => Number(c.amount) < 0);
      if (spent) count++;
    }
    token = r.result && r.result.next_token;
    if (older || !token || count > limit) break;
  }
  return count;
}

async function realScanAllowed() {
  const floor = num(process.env.CREDIT_FLOOR, 150);
  const limit = num(process.env.SCAN_DAILY_LIMIT, 20);
  try {
    const units = await remainingUnits();
    if (units < floor) return { ok: false, reason: 'credit_floor' };
    const today = await scansToday(limit);
    if (today >= limit) return { ok: false, reason: 'daily_limit' };
    return { ok: true };
  } catch (e) {
    console.error('guard check failed', e.status || '', e.code || ''); // never log the key
    return { ok: false, reason: 'check_failed' };
  }
}

module.exports = { realScanAllowed };
