const crypto = require('crypto');
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
function safeEq(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function sign(payload) {
  return crypto.createHmac('sha256', process.env.DASHBOARD_AUTH_SECRET || '').update(payload).digest('base64url');
}
function verify(token) {
  if (!token || !process.env.DASHBOARD_AUTH_SECRET) return false;
  const parts = String(token).split('.');
  if (parts.length !== 2 || !parts[0] || !safeEq(sign(parts[0]), parts[1])) return false;
  try { const p = JSON.parse(Buffer.from(parts[0], 'base64url').toString()); return Number.isFinite(p.exp) && Date.now() <= p.exp; }
  catch { return false; }
}
function tokenFrom(event) {
  const h = event.headers || {};
  const auth = h.authorization || h.Authorization || '';
  return auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : (h['x-dashboard-token'] || h['X-Dashboard-Token']);
}
function mint() {
  const p = Buffer.from(JSON.stringify({exp:Date.now()+TTL_MS,n:crypto.randomBytes(16).toString('hex')})).toString('base64url');
  return p + '.' + sign(p);
}
function json(statusCode, body) { return {statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(body)}; }
function withAuth(handler) {
  return async (event, context) => {
    if (event.httpMethod === 'OPTIONS') return handler(event, context);
    if (!verify(tokenFrom(event))) return json(401,{error:'unauthorized'});
    return handler(event, context);
  };
}
module.exports = {safeEq,mint,verify,json,withAuth};
