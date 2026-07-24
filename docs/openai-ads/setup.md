# OpenAI Ads — setup checklist

One-time wiring so this repo can manage Ads Manager and measure conversions.

Official: [Ads overview](https://developers.openai.com/ads) · [Auth](https://developers.openai.com/ads/api-reference/authentication) · [Pixel](https://developers.openai.com/ads/measurement-pixel)

---

## 1. Advertiser API key

1. [ads.openai.com](https://ads.openai.com/) → **Settings** → issue an Ads API key.
2. `.env`:

```bash
OPENAI_ADS_API_KEY=sk-svcacct-...
```

3. `npm run chatgpt-ads -- status` → account `active`, review `approved`.

This key talks to `https://api.ads.openai.com/v1`. It can **create** conversion event settings; it cannot **send** conversion events (that needs the Conversions API key).

---

## 2. Pixel (data source)

1. Ads Manager → **Conversions** → create / open data source.
2. Copy **Pixel ID** → `.env`:

```bash
PUBLIC_OPENAI_ADS_PIXEL_ID=RrQuNrWD1bXxiN4UzJEqKQ
```

3. GitHub Actions secret with the same name (see `deploy.yml`) so production builds include the pixel.

Site loads OAIQ from `BaseLayout` + `LandingLayout` when the env var is set. `debug: true` only in `astro dev`.

---

## 3. Conversion event (`lead_created`)

Prefer API ([Conversion setup](https://developers.openai.com/ads/api-reference/conversion-setup)) over the Ads Manager wizard sample (`order_created` is ecommerce — wrong for us).

Already created for this account:

- Name: `Appointment lead`
- Type: `lead_created`
- Window: 30 days
- Source: HB Prosthodontics pixel

```bash
npm run chatgpt-ads -- conversions
```

UI path if needed: Conversions → **+ Create conversion events**.

---

## 4. Conversions API key

1. Ads Manager → Conversions → **Conversion keys** → create.
2. `.env` (server-only):

```bash
OPENAI_ADS_CONVERSIONS_API_KEY=...
```

3. `npm run chatgpt-ads -- capi-validate` → `accepted_events: 1`.

If you see `Missing scopes: ads.third_party_events.write`, you pasted the **Settings** Ads API key again. Create a real Conversion key.

---

## 5. Billing

If Ads Manager shows *“Ads cannot serve until you finish account setup”*, finish billing. Pixel/API can work while ads are blocked from serving.

---

## 6. Verify measurement

```bash
npm run dev
```

1. Console: OAIQ debug logs.
2. Network: `bzrcdn.openai.com` (script), `bzr.openai.com` (events).
3. Hit `/thank-you` → `lead_created`.
4. Ads Manager → Conversions → Event Stream (may lag a few minutes).

CSP later: `script-src https://bzrcdn.openai.com`; `connect-src` + `img-src https://bzr.openai.com`.

---

## Done when

- [ ] `status` OK  
- [ ] `conversions` shows pixel + `lead_created`  
- [ ] `capi-validate` OK  
- [ ] GitHub secret `PUBLIC_OPENAI_ADS_PIXEL_ID` set  
- [ ] Billing finished (if banner present)  
- [ ] Production page source includes `oaiq` / pixel ID  

Next: [conversions.md](./conversions.md) for event map · [learnings.md](./learnings.md) before API work.
