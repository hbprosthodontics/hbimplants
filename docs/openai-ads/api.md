# OpenAI Ads — API reference (this repo)

Two different HTTP APIs, two different keys. Mixing them is the #1 slowdown.

Official: [API overview](https://developers.openai.com/ads/api-overview) · [Authentication](https://developers.openai.com/ads/api-reference/authentication) · [Conversions API](https://developers.openai.com/ads/conversions-api) · [Conversion setup](https://developers.openai.com/ads/api-reference/conversion-setup)

---

## Two keys, two hosts

| | Advertiser API | Conversions API |
|---|---|---|
| Env | `OPENAI_ADS_API_KEY` | `OPENAI_ADS_CONVERSIONS_API_KEY` |
| Created at | Settings | Conversions → Conversion keys |
| Base URL | `https://api.ads.openai.com/v1` | `https://bzr.openai.com/v1` |
| Auth | `Authorization: Bearer …` | Same header form |
| Used for | Campaigns, ad groups, ads, files, insights, **create** pixels / event settings | **Send** measurement events |
| Repo helper | `scripts/lib/chatgpt-ads-client.js` → `adsFetch()` | `capi-validate` / future server sender |

Both keys may look like `sk-svcacct-…`. **Length/prefix is not enough** — validate with the right endpoint.

```bash
# Advertiser key
curl -sS "https://api.ads.openai.com/v1/ad_account" \
  -H "Authorization: Bearer $OPENAI_ADS_API_KEY"

# Conversions key (dry-run)
npm run chatgpt-ads -- capi-validate
```

---

## Advertiser API — endpoints we use

| Method | Path | Notes |
|---|---|---|
| `GET` | `/ad_account` | Smoke test; name, status, review |
| `GET` | `/campaigns` | List; IDs like `cmpn_…` |
| `GET` | `/ad_groups?campaign_id=` | Required query |
| `GET` | `/ads?ad_group_id=` | Required query |
| `GET` | `/ad_account/insights` | Also `/campaigns/{id}/insights`, `/ads/{id}/insights` |
| `GET` | `/conversions/pixels` | Returns `id` (`cds_…`) **and** `pixel_id` |
| `POST` | `/conversions/pixels` | Create data source (`client_type: "web"`) |
| `GET` | `/conversions/event_settings` | List conversion defs |
| `POST` | `/conversions/event_settings` | Create (needs `source_ids: [cds_…]`) |
| `POST` | `/conversions/api_keys` | Create CAPI key (response shows key once) |

There is **no** `GET /conversions/api_keys` (returns `405`).

Event settings list can briefly lag after `POST` — retry once.

### Create `lead_created` (copy-paste)

```bash
# 1) Get source id (cds_…), not pixel_id
curl -sS "https://api.ads.openai.com/v1/conversions/pixels" \
  -H "Authorization: Bearer $OPENAI_ADS_API_KEY"

# 2) Create event setting
curl -sS -X POST "https://api.ads.openai.com/v1/conversions/event_settings" \
  -H "Authorization: Bearer $OPENAI_ADS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Appointment lead",
    "event_type": "lead_created",
    "attribution_window_days": 30,
    "source_ids": ["cds_REPLACE_ME"]
  }'
```

`source_ids` must be the pixel **source** `id` (`cds_…`). Using the public Pixel ID string here fails with *Client data source not found*.

### Money units

Advertiser budgets/bids often use **micros** (1 USD = `1_000_000`). Insights `spend` / `cpc` in responses we’ve seen are already in account currency units — don’t double-divide.

---

## Conversions API — send events

```bash
curl -sS -X POST \
  "https://bzr.openai.com/v1/events?pid=$PUBLIC_OPENAI_ADS_PIXEL_ID" \
  -H "Authorization: Bearer $OPENAI_ADS_CONVERSIONS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "validate_only": false,
    "events": [
      {
        "id": "lead_unique_123",
        "type": "lead_created",
        "timestamp_ms": 1770000000000,
        "source_url": "https://hbimplants.com/thank-you",
        "action_source": "web",
        "data": { "type": "customer_action" }
      }
    ]
  }'
```

| Rule | Detail |
|---|---|
| `pid` query | Public Pixel ID |
| `validate_only: true` | Schema/auth check, no persist — use for key tests |
| `timestamp_ms` | Within last 7 days; ≤ ~10 min ahead |
| `source_url` | Required when `action_source` is `web` |
| Batch | Up to 1000; one bad event fails the batch |
| Dedupe | Same `id` as pixel `event_id` when sending both |

Error `Missing scopes: ads.third_party_events.write` → wrong key type.

---

## Hierarchy (for CLI / tree)

```
Ad account
 └─ Campaign (cmpn_…)
     └─ Ad group (adgrp_…)  ← context_hints live here
         └─ Ad (ad_…)       ← creative title/body/image
```

Listing ads always needs `ad_group_id`. Listing ad groups always needs `campaign_id`. Walk the tree (our `tree` command does this).

---

## Rate limits (Advertiser)

~600 req/min per endpoint, ~1200 overall per account/IP. Bulk create has a tighter limit. Fine for CLI; don’t hammer insights in a tight loop.

---

## Docs twins (Markdown)

OpenAI publishes Markdown twins — faster for agents than HTML:

- `https://developers.openai.com/ads/llms.txt` — index  
- `https://developers.openai.com/ads/<slug>.md` — e.g. `api-reference/conversion-setup.md`

Prefer those over scraping the rendered docs site.
