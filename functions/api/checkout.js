// functions/api/checkout.js
export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const {
      aliases = [],
      lineItems = [],
      email = '',
      trialDays = 14,
      metadata = {},
      mode = 'subscription'
    } = body;

    const PRICE_MAP = {
      core:        env.PRICE_CORE,
      extraSeat:   env.PRICE_EXTRA_SEAT,
      extraRegion: env.PRICE_EXTRA_REGION,
      sms:         env.PRICE_SMS,
      guarantee:   env.PRICE_GUARANTEE,
      priority:    env.PRICE_PRIORITY,
      custom:      env.PRICE_CUSTOM
    };

    // Prefer aliases, fallback to explicit price ids
    const items = (aliases.length
      ? aliases.map(a => ({ price: PRICE_MAP[a.key], quantity: Math.max(1, Number(a.qty) || 1) }))
      : (lineItems || [])
    ).filter(it => it.price);

    if (!items.length) return json({ error: 'no_line_items' }, 400);

    const origin = new URL(request.url).origin;

    const params = new URLSearchParams();
    params.set('mode', mode);
    params.set('success_url', `${origin}/loi/?paid=1`);
    params.set('cancel_url', `${origin}/loi/?canceled=1`);
    params.set('allow_promotion_codes', 'true');
    if (email) params.set('customer_email', email);
    if (trialDays && mode === 'subscription') {
      params.set('subscription_data[trial_period_days]', String(trialDays));
    }
    Object.entries(metadata).forEach(([k, v]) => {
      params.set(`metadata[${k}]`, String(v ?? ''));
    });
    items.forEach((it, i) => {
      params.set(`line_items[${i}][price]`, it.price);
      params.set(`line_items[${i}][quantity]`, String(it.quantity || 1));
    });

    const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await resp.json();
    if (!resp.ok) return json(data, 400);
    return json({ url: data.url });
  } catch (e) {
    return json({ error: e.message || 'server_error' }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
