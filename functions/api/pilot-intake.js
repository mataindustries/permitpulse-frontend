// /functions/api/pilot-intake.js
export async function onRequestOptions({ request }) {
  return new Response(null, { headers: cors(new URL(request.url).origin) });
}

export async function onRequestPost({ request, env }) {
  const origin = new URL(request.url).origin;

  let data;
  try { data = await request.json(); }
  catch { return json({ ok:false, error:'Bad JSON' }, 400, origin); }

  const required = ['name','company','phone','email','trade'];
  const missing = required.filter(k => !data[k]?.toString().trim());
  if (missing.length) return json({ ok:false, error:'Missing '+missing.join(',') }, 400, origin);

  const payload = {
    ...data,
    receivedAt: new Date().toISOString(),
    ip: request.headers.get('CF-Connecting-IP'),
    ua: request.headers.get('User-Agent'),
  };

  // KV backup (optional but nice)
  try {
    await env.PILOT_KV.put(`pilot:${Date.now()}:${data.email}`, JSON.stringify(payload), {
      expirationTtl: 60 * 60 * 24 * 90
    });
  } catch {}

  // Email via MailChannels (optional)
  if (env.FORWARD_TO) {
    await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: env.FORWARD_TO }] }],
        from: { email: 'pilot@getpermitpulse.com', name: 'PermitPulse' },
        subject: `Pilot Intake: ${data.company} (${data.trade})`,
        content: [{ type: 'text/plain', value: JSON.stringify(payload, null, 2) }]
      })
    });
  }

  // Discord alert (optional)
  if (env.DISCORD_WEBHOOK) {
    try {
      await fetch(env.DISCORD_WEBHOOK, {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ content: `✅ Pilot intake: **${data.company}** (${data.trade}) — ${data.phone} ${data.zips||''}` })
      });
    } catch {}
  }

  return json({ ok:true }, 200, origin);
}

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
  };
}
function json(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors(origin), 'content-type':'application/json' }
  });
}
