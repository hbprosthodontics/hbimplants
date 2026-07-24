# OpenAI Ads (ChatGPT Ads) — HB Prosthodontics

Internal runbook for managing [Ads Manager](https://ads.openai.com/) from this repo.

Campaign structure / creatives / UTMs → `_References/hb_prosthodontics_chatgpt_ads_implementation_plan_v2.md` (source of truth)  
Official docs → [developers.openai.com/ads](https://developers.openai.com/ads)

| Doc | Use when |
|---|---|
| [setup.md](./setup.md) | First-time wiring (keys, pixel, GitHub secret, billing) |
| [api.md](./api.md) | Calling Advertiser API or Conversions API; auth gotchas |
| [conversions.md](./conversions.md) | Pixel events, `lead_created`, CAPI payloads |
| [cli.md](./cli.md) | `npm run chatgpt-ads` command reference |
| [learnings.md](./learnings.md) | Hard-won gotchas — read before reinventing |

## This account (non-secret)

| Resource | Value |
|---|---|
| Ad account | `adacct_6a63b2a72094819a992baad65e705d9d` |
| Account name | Huntington Beach Prosthodontics |
| Pixel ID | `RrQuNrWD1bXxiN4UzJEqKQ` |
| Pixel source ID | `cds_6a63c24a7c4c819aa2b28e262fc4156b` |
| Conversion event | `Appointment lead` → `lead_created` |
| Event setting ID | `6a63c91ee710819ab06f17927db72e13` |
| Primary campaign | `cmpn_6a63bc15501c8190aa43451a62de9e37` |
| Ad group | `adgrp_6a63bc16bcc88190a7d5d39d9741fdb6` |

## Env vars

| Var | Where created | Purpose |
|---|---|---|
| `OPENAI_ADS_API_KEY` | Ads Manager → **Settings** | Advertiser API (campaigns, ads, insights, conversion *setup*) |
| `OPENAI_ADS_CONVERSIONS_API_KEY` | Ads Manager → Conversions → **Conversion keys** | Send events to `bzr.openai.com` |
| `PUBLIC_OPENAI_ADS_PIXEL_ID` | Conversions → Data source | Browser pixel (`PUBLIC_` = baked into site build) |

Never commit keys. Never put either API key in a `PUBLIC_` var.

## Smoke checks

```bash
npm run chatgpt-ads -- status
npm run chatgpt-ads -- conversions
npm run chatgpt-ads -- capi-validate
npm run chatgpt-ads -- tree
```

## Code map

| Path | Role |
|---|---|
| `scripts/chatgpt-ads.js` | CLI |
| `scripts/lib/chatgpt-ads-client.js` | Advertiser API client |
| `functions/api/openai-conversion.js` | Pages Function → Conversions API relay |
| `src/scripts/track-openai-lead.js` | Thank-you dual-send (pixel + CAPI) |
| `src/layouts/BaseLayout.astro` | Sitewide pixel + click events |
| `src/layouts/LandingLayout.astro` | LP pixel + click events |
| `src/pages/thank-you.astro` | `lead_created` (appointment) |
| `src/pages/thank-you-referral.astro` | `lead_created` (referral) |
| `.github/workflows/deploy.yml` | Injects `PUBLIC_OPENAI_ADS_PIXEL_ID` at build |
