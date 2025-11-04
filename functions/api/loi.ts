// functions/api/loi.ts
// Stores LoI submissions to KV + optional Discord/Resend notify
export const onRequestOptions: PagesFunction = async () => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };
  return new Response(null, { status: 204, headers: cors });
};

export const onRequestPost: PagesFunction<{ PP_LOI: KVNamespace }> = async (ctx) => {
  const { request, env } = ctx;
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "content-type": "application/json",
  };

  try {
    const body = await request.json();
    const email = (body?.state?.email || "unknown").toLowerCase();
    const key = `loi:${Date.now()}:${email}`;

    const record = {
      ...body,
      ts: new Date().toISOString(),
      ip: request.headers.get("cf-connecting-ip") || null,
      ua: request.headers.get("user-agent") || null,
    };

    await env.PP_LOI.put(key, JSON.stringify(record), { expirationTtl: 60 * 60 * 24 * 180 }); // 180 days

    // Optional: Discord notify
    if (env.DISCORD_WEBHOOK) {
      const m = [
        `**New LoI**`,
        `From: ${body?.state?.name || "N/A"} • ${body?.state?.company || "N/A"}`,
        `Email: ${email}`,
        `Monthly: $${body?.totals?.monthly || 0} | One-time: $${body?.totals?.onetime || 0}`,
      ].join("\n");
      await fetch(env.DISCORD_WEBHOOK, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: m }),
      });
    }

    // Optional: Resend email
    if (env.RESEND_API_KEY && env.TO_EMAIL) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "PermitPulse <hello@getpermitpulse.com>",
          to: [env.TO_EMAIL],
          subject: "New LoI submission",
          text: JSON.stringify(record, null, 2),
        }),
      });
    }

    return new Response(JSON.stringify({ ok: true, key }), { status: 200, headers: cors });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 400,
      headers: cors,
    });
  }
};
