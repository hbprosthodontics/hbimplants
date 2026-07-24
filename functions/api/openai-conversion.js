/**
 * Cloudflare Pages Function — OpenAI Ads Conversions API relay.
 * Route: POST /api/openai-conversion
 *
 * Runtime secrets (Cloudflare Pages → Settings → Environment variables):
 *   OPENAI_ADS_CONVERSIONS_API_KEY  (Secret)
 *   PUBLIC_OPENAI_ADS_PIXEL_ID       (or OPENAI_ADS_PIXEL_ID)
 *
 * Body JSON: { event_id: string, source_url?: string, obref?: string }
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://hbimplants.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

function isAllowedOrigin(request) {
  const origin = request.headers.get('Origin') || '';
  const referer = request.headers.get('Referer') || '';
  const allowed = [
    'https://hbimplants.com',
    'https://www.hbimplants.com',
    'http://localhost:4321',
    'http://127.0.0.1:4321',
  ];
  if (origin && allowed.some((o) => origin === o)) return true;
  if (referer && allowed.some((o) => referer.startsWith(o))) return true;
  // Same-origin navigations sometimes omit Origin; allow empty when Host looks right
  const host = request.headers.get('Host') || '';
  if (!origin && (host === 'hbimplants.com' || host.endsWith('.hbimplants.com') || host.startsWith('localhost'))) {
    return true;
  }
  return false;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!isAllowedOrigin(request)) {
    return json(403, { ok: false, error: 'forbidden' });
  }

  const apiKey = (env.OPENAI_ADS_CONVERSIONS_API_KEY || '').trim();
  const pixelId = (
    env.PUBLIC_OPENAI_ADS_PIXEL_ID ||
    env.OPENAI_ADS_PIXEL_ID ||
    ''
  ).trim();

  if (!apiKey || !pixelId) {
    return json(503, { ok: false, error: 'conversions_not_configured' });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, error: 'invalid_json' });
  }

  const eventId = typeof body?.event_id === 'string' ? body.event_id.trim() : '';
  if (!eventId || eventId.length > 128) {
    return json(400, { ok: false, error: 'event_id_required' });
  }

  const sourceUrl =
    typeof body?.source_url === 'string' && body.source_url.startsWith('https://')
      ? body.source_url.slice(0, 2048)
      : 'https://hbimplants.com/thank-you';

  const obref =
    typeof body?.obref === 'string' && body.obref.trim()
      ? body.obref.trim().slice(0, 256)
      : undefined;

  const event = {
    id: eventId,
    type: 'lead_created',
    timestamp_ms: Date.now(),
    source_url: sourceUrl,
    action_source: 'web',
    data: { type: 'customer_action' },
  };

  if (obref) {
    event.user = { obref };
  }

  // Forward client hints when present (improves matching; never required)
  const ip = request.headers.get('CF-Connecting-IP');
  const ua = request.headers.get('User-Agent');
  if (ip || ua) {
    event.user = {
      ...(event.user || {}),
      ...(ip ? { ip_address: ip } : {}),
      ...(ua ? { user_agent: ua } : {}),
    };
  }

  try {
    const upstream = await fetch(
      `https://bzr.openai.com/v1/events?pid=${encodeURIComponent(pixelId)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          validate_only: false,
          events: [event],
        }),
      }
    );

    const text = await upstream.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text.slice(0, 200) };
    }

    if (!upstream.ok) {
      console.error('OpenAI CAPI error', upstream.status, data?.error?.message || text.slice(0, 200));
      return json(502, { ok: false, error: 'upstream_failed' });
    }

    return json(200, { ok: true, accepted_events: data?.accepted_events ?? 1 });
  } catch (err) {
    console.error('OpenAI CAPI fetch failed', err);
    return json(502, { ok: false, error: 'upstream_unreachable' });
  }
}
