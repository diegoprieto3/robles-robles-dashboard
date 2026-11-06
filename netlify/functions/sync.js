const VAPI_API_KEY = process.env.VAPI_API_KEY;
const ASSISTANT_ID = '2e428baa-1f9b-45ae-a525-47b397303165';
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
function sbHeaders(prefer) {
  const h = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };
  if (prefer) h.Prefer = prefer;
  if (SUPABASE_KEY && !String(SUPABASE_KEY).startsWith('sb_secret_')) h.Authorization = `Bearer ${SUPABASE_KEY}`;
  return h;
}

exports.handler = async function(event, context) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return { statusCode: 500, body: JSON.stringify({ error: 'supabase not configured' }) };

try {
    const res = await fetch(`https://api.vapi.ai/call?limit=100&assistantId=${ASSISTANT_ID}`, {
      headers: { 'Authorization': `Bearer ${VAPI_API_KEY}` }
    });
    if (!res.ok) throw new Error('Vapi fetch failed: ' + res.status);
    const data = await res.json();
    const calls = Array.isArray(data) ? data : (data.results || data.calls || []);

    for (const c of calls) {
      const detailRes = await fetch(`https://api.vapi.ai/call/${c.id}`, {
        headers: { 'Authorization': `Bearer ${VAPI_API_KEY}` }
      });
      const detail = detailRes.ok ? await detailRes.json() : c;

      const msgs = detail.artifact?.messages || detail.messages || [];
      const transcript = detail.artifact?.transcript || '';

      // Robles & Robles has real Structured Outputs configured in Vapi — read them
      // directly instead of regex-guessing from the transcript. Structured Outputs
      // are keyed by UUID, so match on the .name field to find the right .result.
      const structuredOutputs = detail.artifact?.structuredOutputs || {};
      function getStructuredValue(name) {
        const entry = Object.values(structuredOutputs).find(o => o && o.name === name);
        return entry ? entry.result : null;
      }

      const callerName = getStructuredValue('caller_name');
      const callReason = getStructuredValue('reason_for_call');
      const summary = getStructuredValue('call_summary');
      const structuredCallerNumber = getStructuredValue('caller_number');

      // Duration
      let dur = detail.duration || detail.durationSeconds || 0;
      if (!dur && detail.startedAt && detail.endedAt) {
        dur = Math.round((new Date(detail.endedAt) - new Date(detail.startedAt)) / 1000);
      }

      const record = {
        id: detail.id,
        assistant_id: detail.assistantId || ASSISTANT_ID,
        caller_number: structuredCallerNumber || detail.customer?.number || detail.phoneNumber || null,
        caller_name: callerName,
        duration: Math.round(dur),
        started_at: detail.startedAt || detail.createdAt || null,
        ended_at: detail.endedAt || null,
        recording_url: detail.artifact?.recordingUrl || detail.recordingUrl || null,
        summary: summary || detail.artifact?.summary || detail.summary || null,
        end_reason: detail.endedReason || detail.status || null,
        transcript: typeof transcript === 'string' ? transcript : JSON.stringify(msgs),
        call_reason: callReason
      };

      await fetch(`${SUPABASE_URL}/rest/v1/calls`, {
        method: 'POST',
        headers: sbHeaders('resolution=merge-duplicates'),
        body: JSON.stringify(record)
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, synced: calls.length })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
const {withAuth} = require('./_auth');
exports.handler = withAuth(exports.handler);
