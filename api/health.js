// GET /api/health -> tells the frontend whether we are in mock mode (handy badge in the UI).
const { isMock, send } = require('./_youcam');
module.exports = (req, res) => send(res, 200, { ok: true, mock: isMock() });
