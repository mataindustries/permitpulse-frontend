export async function onRequestOptions() {
  return new Response(null, { headers: cors() });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const date = url.searchParams.get('date'); // YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
    return json({ error: 'date=YYYY-MM-DD required' }, 400);
  }

  const cfg = getConfig(env);
  const weekday = new Date(date + 'T00:00:00').getDay(); // 0-6
  const key = ['sun','mon','tue','wed','thu','fri','sat'][weekday];
  const blocks = cfg.hours[key] || [];

  const slots = [];
  for (const block of blocks) {
    const [start, end] = block.split('-');
    let [h, m] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    while (h < eh || (h === eh && m < em)) {
      const HH = String(h).padStart(2, '0');
      const MM = String(m).padStart(2, '0');
      const t = `${HH}:${MM}`;
      if (!cfg.exclude.has(date)) {
        const booked = await env.BOOKING_KV.get(`booking:${date}T${t}`);
        if (!booked) slots.push(t);
      }
      m += cfg.slotMinutes;
      if (m >= 60) { h += Math.floor(m / 60); m = m % 60; }
    }
  }
  return json({ date, slots });
}

function getConfig(env) {
  const hours = safeJSON(env.BUSINESS_HOURS_JSON) || {
    mon: ['09:00-12:00', '13:00-17:00'],
    tue: ['09:00-12:00', '13:00-17:00'],
    wed: ['09:00-12:00', '13:00-17:00'],
    thu: ['09:00-12:00', '13:00-17:00'],
    fri: ['09:00-12:00', '13:00-17:00']
  };
  const exclude = new Set((env.EXCLUDE_DATES||'').split(',').map(s=>s.trim()).filter(Boolean));
  const slotMinutes = parseInt(env.SLOT_MINUTES || '30', 10);
  return { hours, exclude, slotMinutes };
}

function json(obj, status=200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', ...cors() } });
}
function cors(){ return { 'Access-Control-Allow-Origin': '*' }; }
function safeJSON(s){ try { return JSON.parse(s); } catch { return null; } }
