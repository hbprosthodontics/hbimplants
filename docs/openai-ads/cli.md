# OpenAI Ads — CLI

```bash
npm run chatgpt-ads -- <command> [flags]
```

Implementation: `scripts/chatgpt-ads.js` · client: `scripts/lib/chatgpt-ads-client.js`  
Setup: [setup.md](./setup.md)

Requires `dotenv` → project-root `.env`.

---

## Commands

| Command | What it does |
|---|---|
| `status` | Advertiser key + ad account + whether pixel env is set |
| `campaigns` | List campaigns (budget in USD from micros) |
| `ad-groups --campaign-id cmpn_…` | List ad groups |
| `ads --ad-group-id adgrp_…` | List ads |
| `tree` | Campaigns → groups → ads (walks required parent IDs) |
| `insights [--days N]` | Account daily metrics |
| `insights --campaign-id …` | Campaign metrics |
| `insights --ad-group-id …` | Ad group metrics |
| `insights --ad-id …` | Ad metrics |
| `conversions` | List pixels (`cds_…` + `pixel_id`) and event settings |
| `capi-validate` | Dry-run `lead_created` via Conversions API |

```bash
npm run chatgpt-ads -- status
npm run chatgpt-ads -- tree
npm run chatgpt-ads -- conversions
npm run chatgpt-ads -- capi-validate
npm run chatgpt-ads -- insights --days 7
npm run chatgpt-ads -- insights --campaign-id cmpn_6a63bc15501c8190aa43451a62de9e37 --days 14
npm run chatgpt-ads -- ad-groups --campaign-id cmpn_6a63bc15501c8190aa43451a62de9e37
npm run chatgpt-ads -- ads --ad-group-id adgrp_6a63bc16bcc88190a7d5d39d9741fdb6
```

Empty insights rows usually mean the campaign is new or outside the window — not necessarily a broken key.

---

## Extending the CLI

1. Add a case in `scripts/chatgpt-ads.js`.
2. Prefer `adsFetch(path, { query, method, body })` for Advertiser API.
3. Keep secrets out of logs (status already truncates the Ads key).
4. Document the command here + in the script `HELP` string.

Useful future commands (not built yet): `pause` / `activate`, create/update from campaign SoT plan, post CAPI event helper, sync insights → performance log.
