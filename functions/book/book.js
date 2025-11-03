export async function onRequestOptions() {
  return new Response(null, { headers: cors() });
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { date, time, name, phone, email, notes, lang } = body || {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return json({ error: 'Invalid date' }, 400);
    if (!/^\d{2}:\d{2}$/.test(time || '')) return json({ error: 'Invalid time' }, 400);
    if (!name || !email) return json({ error: 'Name and email required' }, 400);

    // check availability (naive, fine for low volume)
    const slotKey = `${date}T${time}`;
    const exists = await env.BOOKING_KV.get(`booking:${slotKey}`);
    if (exists) return json({ error: 'That slot was just taken. Pick another.' }, 409);

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    const minutes = parseInt(env.SLOT_MINUTES || '30', 10);
    const { startLocal, endLocal } = localDateTimeRange(date, time, minutes);
    const title = env.EVENT_TITLE || 'PermitPulse — Intro Call';
    const baseUrl = (env.BASE_URL || '').replace(/\/$/, '');

    // Save both by slot and by id
    await env.BOOKING_KV.put(`booking:${slotKey}`, id);
    await env.BOOKING_KV.put(`bookingById:${id}`, JSON.stringify({ id, date, time, name, phone, email, notes, lang: lang||'en', createdAt, title }));

    const icsUrl = `${baseUrl || ''}/api/ics/${id}`;
    const gcalUrl = googleCalUrl({ title, desc: 'Booked via PermitPulse', startLocal, endLocal });

    return json({ ok: true, id, icsUrl, gcalUrl, booking: { id, date, time, name } });
  } catch (e) {
    return json({ error: 'Bad request' }, 400);
  }
}

function localDateTimeRange(dateStr, timeStr, minutes) {
  const [y,m,d] = dateStr.split('-').map(Number);
  const [hh,mm] = timeStr.split(':').map(Number);
  // Build naive local strings (floating times) for ICS/Google; DST handled by calendar client
  const pad = n => String(n).padStart(2,'0');
  const startLocal = `${y}${pad(m)}${pad(d)}T${pad(hh)}${pad(mm)}00`;
  const endDate = new Date(y, m-1, d, hh, mm + minutes, 0);
  const endLocal = `${endDate.getFullYear()}${pad(endDate.getMonth()+1)}${pad(endDate.getDate())}T${pad(endDate.getHours())}${pad(endDate.getMinutes())}00`;
  return { startLocal, endLocal };
}

function googleCalUrl({ title, desc, startLocal, endLocal }) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    details: desc,
    dates: `${startLocal}/${endLocal}`
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function json(obj, status=200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', ...cors() } });
}
function cors(){ return { 'Access-Control-Allow-Origin': '*' }; }
