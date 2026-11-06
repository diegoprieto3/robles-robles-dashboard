// Scoped calls reader. Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
const ASSISTANT_ID = '2e428baa-1f9b-45ae-a525-47b397303165';
const ALLOWED = new Set([ASSISTANT_ID]);

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'GET') return json(405, { error: 'method' });
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return json(500, { error: 'supabase not configured' });

  const q = event.queryStringParameters || {};
  const assistant = q.assistant_id || ASSISTANT_ID;
  if (!ALLOWED.has(assistant)) return json(403, { error: 'assistant not allowed' });
  let limit = parseInt(q.limit || '2000', 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 2000;
  if (limit > 5000) limit = 5000;

  const headers = { apikey: key, Accept: 'application/json' };
  if (!String(key).startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;

  const path = `/rest/v1/calls?assistant_id=eq.${assistant}&order=started_at.desc&limit=${limit}`;
  const res = await fetch(url + path, { headers });
  const text = await res.text();
  if (!res.ok) return json(res.status, { error: text.slice(0, 200) });
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: text || '[]',
  };
};
const {withAuth} = require('./_auth');
exports.handler = withAuth(exports.handler);
