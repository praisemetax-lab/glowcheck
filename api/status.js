// api/status.js  ->  GET /api/status?id=TASK_ID
// The browser calls this every few seconds until the analysis is done.
// Returns { status: 'running' } | { status: 'success', result } | { status: 'error', error }
const { isMock, friendly, youcam, normalize, send } = require('./_youcam');

module.exports = async (req, res) => {
  const id = new URL(req.url, 'http://x').searchParams.get('id');
  if (!id) return send(res, 400, { error: 'Missing id' });
  if (isMock()) return send(res, 400, { error: 'Mock mode does not use tasks' });
  try {
    const r = await youcam('/s2s/v2.0/task/skin-analysis/' + encodeURIComponent(id), { method: 'GET' });
    const d = r.data || {};
    if (d.task_status === 'success') return send(res, 200, { status: 'success', result: normalize(d.results) });
    if (d.task_status === 'error') return send(res, 200, { status: 'error', error: friendly(d.error || d.error_code) });
    return send(res, 200, { status: 'running' });
  } catch (e) {
    console.error('status error', e.status || '', e.code || '', e.message);
    const status = e.status === 429 || e.status === 400 ? e.status : 500;
    const msg = e.name === 'TimeoutError' ? 'YouCam took too long to respond. Please try again.' : e.code ? friendly(e.code) : e.message;
    return send(res, status, { error: msg });
  }
};
