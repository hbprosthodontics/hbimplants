# OpenAI Ads — learnings (read this first next time)

Hard-won notes from wiring HB Prosthodontics to Ads Manager (2026-07). Goal: avoid re-debugging the same API footguns.

---

## 1. There are two APIs and two keys

| Mistake | What happens |
|---|---|
| Put Settings **Ads API** key in `OPENAI_ADS_CONVERSIONS_API_KEY` | `401` / `Missing scopes: ads.third_party_events.write` |
| Expect one key to do everything | Advertiser key manages objects; Conversions key **sends** events |
| Judge key type by `sk-svcacct-` prefix | Both can look identical — validate with the right host |

**Fix:** Settings → `OPENAI_ADS_API_KEY` → `api.ads.openai.com`.  
Conversions → Conversion keys → `OPENAI_ADS_CONVERSIONS_API_KEY` → `bzr.openai.com`.  
Smoke: `status` + `capi-validate`.

---

## 2. Conversion events can (and should) be created via API

Ads Manager empty state + “email a developer” implies UI-only. For this account, [Conversion setup](https://developers.openai.com/ads/api-reference/conversion-setup) works:

1. `GET /conversions/pixels` → take `id` (`cds_…`), not `pixel_id`
2. `POST /conversions/event_settings` with `event_type: "lead_created"`, `attribution_window_days: 30`, `source_ids: ["cds_…"]`

UI wizard samples (`order_created`, `registration_completed`) are ecommerce/signup defaults — wrong for a dental lead form.

If `/conversions/pixels` returns `404 Not found`, conversion management isn’t enabled — contact OpenAI partner support. Don’t thrash the UI.

---

## 3. `cds_…` vs Pixel ID

| Field | Example use |
|---|---|
| `pixel_id` (`RrQu…`) | Browser `oaiq("init")`, CAPI `?pid=`, env `PUBLIC_OPENAI_ADS_PIXEL_ID` |
| Source `id` (`cds_…`) | `source_ids` when creating event settings |

Swapping them → *Client data source not found*.

---

## 4. Event taxonomy for this practice

| Situation | Use |
|---|---|
| Appointment / referral form thank-you | `lead_created` |
| Confirmed booking (future) | `appointment_scheduled` |
| Phone / Book Online clicks | custom (`phone_click`, `booking_click`) — not oCPC goals |
| Purchase sample from email | **Never** for HBP |

Custom events cannot be conversion-bidding optimization goals.

---

## 5. Ads list endpoints need parents

- `GET /ads` requires `ad_group_id`
- `GET /ad_groups` requires `campaign_id`

Use `tree` (or walk campaigns → groups → ads). Don’t expect a flat “list all ads” call.

---

## 6. `GET /conversions/api_keys` does not exist

Creating a CAPI key via API is `POST` only; listing returns `405`. Manage keys in the UI Conversion keys dropdown, or store the one-time `POST` response immediately.

---

## 7. Event settings list can lag after create

`POST /conversions/event_settings` returned the object, then `GET` was empty for a moment. Retry once before assuming failure. Ads Manager UI may need a hard refresh.

---

## 8. Billing banner ≠ API broken

“Ads cannot serve until you finish account setup / billing” blocks **delivery**. Pixel, conversion defs, and API reads/writes can still succeed. Don’t debug measurement when the real issue is unpaid billing.

---

## 9. oCPC cannot retrofit a CPC campaign

Current Dental Implants campaign is `bidding_type: clicks`. To optimize to `lead_created`, create a **new** campaign with `bidding_type: "conversions"` and the event setting ID. Goal/event are immutable after create.

---

## 10. Production pixel needs a GitHub secret

`PUBLIC_OPENAI_ADS_PIXEL_ID` is build-time. Local `.env` does not deploy it. Add the GitHub Actions secret or production HTML won’t include OAIQ.

---

## 11. Prefer OpenAI Markdown docs for agents

Use `https://developers.openai.com/ads/llms.txt` and `…/ads/<path>.md` instead of scraping HTML. Faster and more accurate for CLI/automation work.

---

## 12. Insights empty ≠ auth failure

Launch-day / zero-delivery windows return empty `data` with HTTP 200. Confirm with `status` / `tree` before chasing insights bugs.

---

## 13. Money: micros vs display

Campaign `budget.lifetime_spend_limit_micros` and bids use micros (`$1 = 1_000_000`). Don’t assume every money field in insights is micros — check the field docs / observed response shape.

---

## Fast path for a new OpenAI Ads client repo

1. Copy env var names + CLI pattern from this repo.  
2. Settings key → `status`.  
3. Create/list pixel → save `cds_` + `pixel_id`.  
4. API-create `lead_created` (or vertical-appropriate standard event).  
5. Conversion keys → `capi-validate`.  
6. Wire pixel in layouts; fire standard event on thank-you.  
7. GitHub secret for `PUBLIC_…` pixel.  
8. Finish billing before expecting delivery.  
9. Skim this file before any “why is my key failing?” rabbit hole.

Account IDs and current event IDs: [README.md](./README.md).
