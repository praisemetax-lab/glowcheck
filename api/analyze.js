// api/analyze.js  ->  POST /api/analyze
// Body: { image: "data:image/jpeg;base64,...", week: 0 }
// Steps: 1) ask YouCam for an upload URL  2) upload the photo bytes  3) start the analysis task
// Returns { taskId } (real) or { mock: true, result } (mock mode).
const { ACTIONS, isMock, friendly, youcam, readBody, send } = require('./_youcam');
const { mockResult } = require('./_mock');
const { realScanAllowed } = require('./_guard');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' });
  try {
    const body = await readBody(req);
    const match = /^data:(image\/(jpeg|jpg|png));base64,(.+)$/.exec(body.image || '');
    if (!match) return send(res, 400, { error: 'Please send a JPG or PNG photo.' });

    // MOCK MODE: pretend, return sample data straight away.
    if (isMock()) {
      return send(res, 200, { mock: true, result: mockResult(Number(body.week) || 0, body.seed) });
    }
    // DEMO LINK (/?demo=1 or /demo): never call YouCam, never spend units.
    if (body.demo === true || body.demo === 1 || body.demo === '1') {
      return send(res, 200, { mock: true, demo: true, result: mockResult(Number(body.week) || 0, body.seed) });
    }
    // SAFETY CAP: protect the unit reserve (credit floor + daily limit). Falls back to sample results.
    const guard = await realScanAllowed();
    if (!guard.ok) {
      return send(res, 200, { mock: true, paused: true, reason: guard.reason, result: mockResult(Number(body.week) || 0, body.seed) });
    }

    const contentType = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
    const bytes = Buffer.from(match[3], 'base64');
    if (bytes.length >= 10 * 1024 * 1024) return send(res, 400, { error: friendly('exceed_max_filesize') });

    // 1) Register the file, get a presigned upload URL.
    const fileRes = await youcam('/s2s/v2.0/file/skin-analysis', {
      method: 'POST',
      body: JSON.stringify({
        files: [{ content_type: contentType, file_name: 'selfie.' + (contentType === 'image/png' ? 'png' : 'jpg'), file_size: bytes.length }]
      })
    });
    const file = fileRes.data.files[0];
    const upload = file.requests[0];

    // 2) Upload the bytes with the exact headers YouCam gave us.
    const put = await fetch(upload.url, {
      method: upload.method || 'PUT',
      headers: Object.fromEntries(Object.entries(upload.headers || { 'Content-Type': contentType }).map(([k, v]) => [k, String(v)])),
      body: bytes,
      signal: AbortSignal.timeout(25000)
    });
    if (!put.ok) throw new Error('Photo upload failed (HTTP ' + put.status + ')');

    // 3) Start the skin analysis task.
    const task = await youcam('/s2s/v2.0/task/skin-analysis', {
      method: 'POST',
      body: JSON.stringify({ src_file_id: String(file.file_id), dst_actions: ACTIONS, format: 'json' })
    });
    return send(res, 200, { taskId: String(task.data.task_id) });
  } catch (e) {
    console.error('analyze error', e.status || '', e.code || '', e.message); // never log headers/key
    const status = e.status === 429 || e.status === 400 ? e.status : 500;
    const msg = e.name === 'TimeoutError' ? 'YouCam took too long to respond. Please try again.' : e.code ? friendly(e.code) : e.message;
    return send(res, status, { error: msg });
  }
};
