// functions/api/loi.ts
export const onRequestOptions: PagesFunction = async () =>
  new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
    },
  });

export const onRequestPost: PagesFunction<{ PP_LOIS: KVNamespace }> = async ({ request, env }) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "content-type": "application/json",
  };

  try {
    const body = await request.json();
    const email = (body?.state?.email || "unknown").toLowerCase();
    const id = `loi:${Date.now()}:${email}`;
    const record = {
      ...body,
      id,
      ts: new Date().toISOString(),
      ip: request.headers.get("cf-connecting-ip") || null,
      ua: request.headers.get("user-agent") || null,
    };

    await env.PP_LOIS.put(id, JSON.stringify(record), { expirationTtl: 60 * 60 * 24 * 180 }); // 180 days
    return new Response(JSON.stringify({ ok: true, id }), { status: 200, headers: cors });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 400,
      headers: cors,
    });
  }
};
