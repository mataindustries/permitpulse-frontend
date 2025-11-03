export async function onRequestGet({ request, env }) {
  const auth = request.headers.get('authorization') || '';
  const token = (auth.startsWith('Bearer ') ? auth.slice(7) : new URL(request.url).searchParams.get('token')) || '';
  if (!token || token !== env.ADMIN_TOKEN) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type':'application/json' } });
  }
  const list = await env.BOOKING_KV.list({ prefix: 'bookingById:' });
  const items = [];
  for (const k of list.keys) {
    const item = await env.BOOKING_KV.get(k.name, { type: 'json' });
    if (item) items.push(item);
  }
  return new Response(JSON.stringify({ items }), { headers: { 'content-type':'application/json' } });
}
