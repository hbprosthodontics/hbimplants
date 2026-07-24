/**
 * Fire OpenAI Ads lead_created on both pixel and Conversions API (deduped).
 * Used by thank-you pages after a form conversion.
 */
export function trackOpenAiLeadCreated() {
  const eventId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `lead_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const sourceUrl = window.location.href;

  if (typeof window.oaiq === 'function') {
    window.oaiq(
      'measure',
      'lead_created',
      { type: 'customer_action' },
      { event_id: eventId }
    );
  }

  let obref;
  try {
    const match = document.cookie.match(/(?:^|;\s*)__obref=([^;]*)/);
    if (match?.[1]) obref = decodeURIComponent(match[1]);
  } catch {
    // ignore cookie parse errors
  }

  const payload = {
    event_id: eventId,
    source_url: sourceUrl,
    ...(obref ? { obref } : {}),
  };

  // keepalive helps if the user navigates away quickly
  try {
    fetch('/api/openai-conversion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: 'same-origin',
    }).catch(() => {
      // Pixel already fired; CAPI is best-effort
    });
  } catch {
    // ignore
  }
}
