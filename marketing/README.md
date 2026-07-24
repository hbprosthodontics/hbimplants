# Marketing Strategy Folder

Internal strategy documents for HB Prosthodontics Google Ads, ChatGPT Ads, and digital marketing.

## Files

| File | Purpose |
|---|---|
| `personas.md` | 5 detailed patient personas — drives all ad copy, landing page messaging, and keyword targeting |
| `keywords.md` | Keyword database with persona, intent, match type, landing page, and priority for each keyword. Includes negatives and bidding roadmap. |
| _(ops)_ [`docs/openai-ads/`](../docs/openai-ads/) | OpenAI Ads ops (keys, CLI, API). Campaign SoT: `_References/hb_prosthodontics_chatgpt_ads_implementation_plan_v2.md` |
| `performance/template.md` | Monthly report template — copy and rename to `YYYY-MM.md` each month |
| `performance/YYYY-MM.md` | Completed monthly reports (add one per month) |

## Monthly Workflow

1. At month end, duplicate `performance/template.md` → `performance/YYYY-MM.md`
2. Pull Google Ads data (Campaigns → Columns: Conversions, CPA, CTR, CPC, Spend)
3. Pull GA4 data (Reports → Landing pages, filter to /lp/ pages)
4. Fill in lead quality numbers from front desk / Dentrix
5. Document decisions made and next month's actions
6. Commit the completed report to git for historical record
