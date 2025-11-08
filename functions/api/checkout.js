// functions/api/checkout.js
export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();

    // Either send aliases OR explicit lineItems. Aliases are recommended.
    const {
      aliases = [],                 // [{ key:'core', qty:1 }, ...]
      lineItems = [],               // optional fallback: [{ price:'price_x', quantity:1 }]
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
      priority:    env.PRICE_PRIORITY,     // one-time is fine inside Checkout
      custom:      env.PRICE_CUSTOM
    };

    // Build line items from aliases if provided
    const items = (aliases.length ? aliases.map(a => ({
      price: PRICE_MAP[a.key],
      quantity: Math.max(1, Number(a.qty || 1))
    })) : lineItems).filter(it => it.price);

    const params = new URLSearchParams();
    params.set('mode', mode);
    params.set('success_url', 'https://getpermitpulse.com/thank-you/?session_id={CHECKOUT_SESSION_ID}');
    params.set('cancel_url', 'https://getpermitpulse.com/loi/');
    if (email) params.set('customer_email', email);
    params.set('allow_promotion_codes', 'true');
    if (mode === 'subscription' && trialDays > 0) {
      params.set('subscription_data[trial_period_days]', String(trialDays));
    }
    Object.entries(metadata).forEach(([k, v]) => params.set(`metadata[${k}]`, String(v ?? '')));

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
    if (!resp.ok) return new Response(JSON.stringify(data), { status: 400 });

    return new Response(JSON.stringify({ url: data.url }), { headers: { 'Content-Type': 'application/json' }});
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
