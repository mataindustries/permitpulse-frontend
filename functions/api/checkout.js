// functions/api/checkout.js
export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const {
      lineItems = [],       // [{ price: 'price_xxx', quantity: 1 }, ...]
      email = '',
      trialDays = 14,       // 0 to disable
      metadata = {},        // quote_ref, name, company, etc.
      mode = 'subscription' // keep 'subscription' so one-time items can ride along
    } = body;

    if (!env.STRIPE_SECRET_KEY) {
      return new Response(JSON.stringify({ error: 'Missing STRIPE_SECRET_KEY' }), { status: 500 });
    }

    const params = new URLSearchParams();
    params.set('mode', mode);
    params.set('success_url', 'https://getpermitpulse.com/thank-you/?session_id={CHECKOUT_SESSION_ID}');
    params.set('cancel_url', 'https://getpermitpulse.com/loi/');
    if (email) params.set('customer_email', email);
    params.set('allow_promotion_codes', 'true');

    // Optional trial on the subscription
    if (mode === 'subscription' && trialDays > 0) {
      params.set('subscription_data[trial_period_days]', String(trialDays));
    }

    // Metadata
    Object.entries(metadata).forEach(([k, v]) => {
      params.set(`metadata[${k}]`, String(v ?? ''));
    });

    // Line items
    lineItems.forEach((it, i) => {
      params.set(`line_items[${i}][quantity]`, String(it.quantity || 1));
      params.set(`line_items[${i}][price]`, it.price);
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

    return new Response(JSON.stringify({ url: data.url }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
