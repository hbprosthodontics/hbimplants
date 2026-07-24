# OpenAI Ads — conversions & measurement

How HB Prosthodontics maps real site actions to OpenAI events.

Official: [Supported events](https://developers.openai.com/ads/supported-events) · [Pixel](https://developers.openai.com/ads/measurement-pixel) · [Conversions API](https://developers.openai.com/ads/conversions-api)

---

## Primary conversion

| | |
|---|---|
| Ads Manager name | Appointment lead |
| Event type | `lead_created` |
| Data shape | `{ type: "customer_action" }` |
| Attribution window | 30 days |
| Why this event | Form submit / contact request — not a purchase or account signup |

Email / wizard samples often show `order_created` or `registration_completed`. **Ignore those** for this practice.

`appointment_scheduled` is for a *confirmed* booking. Our thank-you pages are *requests*, so `lead_created` is the accurate standard event ([taxonomy](https://developers.openai.com/ads/supported-events)).

Only **standard** events can be oCPC optimization goals. Custom events are reporting-only.

---

## What the site fires today

| Action | Event | Transport | Where |
|---|---|---|---|
| Appointment thank-you | `lead_created` | Browser pixel | `/thank-you` |
| Referral thank-you | `lead_created` | Browser pixel | `/thank-you-referral` |
| `tel:` click | custom `phone_click` | Browser pixel | layouts |
| Dentrix / Book Online | custom `booking_click` | Browser pixel | layouts |

Pixel init (conceptually):

```js
oaiq("init", { pixelId: "<PUBLIC_OPENAI_ADS_PIXEL_ID>", debug: /* DEV only */ });
oaiq("measure", "lead_created", { type: "customer_action" });
```

Custom:

```js
oaiq("measure", "custom", { type: "custom" }, { custom_event_name: "phone_click" });
```

---

## Pixel vs CAPI

| | Pixel (browser) | Conversions API (server) |
|---|---|---|
| Reliability | Good; blocked by some browsers / ITP | Better; recommended by OpenAI |
| Key | Pixel ID only | `OPENAI_ADS_CONVERSIONS_API_KEY` |
| Today | Implemented | Relay at `POST /api/openai-conversion` |

Thank-you pages call `trackOpenAiLeadCreated()` (`src/scripts/track-openai-lead.js`):

1. Generate `event_id` (UUID)
2. Pixel `measure` with `{ event_id }`
3. `fetch('/api/openai-conversion')` with the same id (+ `__obref` cookie when present)

Pages Function: `functions/api/openai-conversion.js`  
Forwards to `https://bzr.openai.com/v1/events?pid=…` and attaches `CF-Connecting-IP` / `User-Agent` for matching.

### Cloudflare runtime secrets (required)

GitHub secrets are for **build**. Functions need **Pages** env vars (Production):

| Variable | Type |
|---|---|
| `OPENAI_ADS_CONVERSIONS_API_KEY` | Secret |
| `PUBLIC_OPENAI_ADS_PIXEL_ID` | Plain or secret |

Dashboard: Workers & Pages → `hbimplants` → Settings → Environment variables  
Or: `npx wrangler pages secret put OPENAI_ADS_CONVERSIONS_API_KEY --project-name=hbimplants`

Without these, the endpoint returns `503 conversions_not_configured` (pixel still works).

When both fire for the same conversion, reuse one ID:

- Pixel: options `{ event_id: "…" }`
- CAPI: body field `"id": "…"`

Also pass `user.obref` from the `__obref` cookie on hybrid setups when available.

---

## CAPI `lead_created` payload (web)

```json
{
  "validate_only": false,
  "events": [
    {
      "id": "lead_<unique>",
      "type": "lead_created",
      "timestamp_ms": 0,
      "source_url": "https://hbimplants.com/thank-you",
      "action_source": "web",
      "data": { "type": "customer_action" }
    }
  ]
}
```

Optional matching fields (hashed / raw per docs): `user.email_sha256`, `user.ip_address`, `user.user_agent`, geo. Never send raw email.

Validate key anytime: `npm run chatgpt-ads -- capi-validate`.

---

## oCPC later

Current campaign is **CPC** (`bidding_type: clicks`). You cannot flip an existing campaign to conversions.

When `lead_created` has volume:

1. New campaign with `bidding_type: "conversions"`
2. `conversion_event_setting_ids: ["6a63c91ee710819ab06f17927db72e13"]` (or current ID from `conversions`)
3. Ad groups with `billing_event_type: "click"`; `max_bid_micros` is the **CPA bid**, not CPC

Guide: [Conversion-optimized campaigns](https://developers.openai.com/ads/conversion-optimized-campaigns).
