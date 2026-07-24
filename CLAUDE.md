# HB Prosthodontics — Project Context for Claude

## Project Overview
Production website for **Huntington Beach Prosthodontics** at `https://hbimplants.com`.
Built with Astro v5 + Tailwind CSS. Deployed to Cloudflare Pages via GitHub Actions.

## Stack
- **Framework**: Astro v5 (SSG, zero JS by default)
- **CSS**: Tailwind CSS with custom brand tokens
- **Deployment**: Cloudflare Pages (auto-deploy on push to `main`)
- **Forms**: Formspree (endpoint in `schedule.astro`) + Cloudflare Turnstile CAPTCHA
- **Analytics**: GA4 (tag in BaseLayout.astro)
- **Blog**: Astro Content Collections (`src/content/blog/`)

## Brand Design Tokens (tailwind.config.mjs)
- `brand-navy`: #1B3A5C — primary dark, hero backgrounds
- `brand-blue`: #2E6DA4 — links, CTAs
- `brand-light`: #EBF2FA — light section backgrounds
- `brand-gold`: #C9A84C — accent, headings highlight
- `neutral-mid`: #4B5563 — body text
- `neutral-border`: #E5E7EB — dividers

## Key Files
- `src/layouts/BaseLayout.astro` — SEO head, GA4, JSON-LD schema, fonts
- `src/components/Header.astro` — sticky nav with dropdowns and mobile menu
- `src/components/Footer.astro` — NAP, links, review CTA
- `src/components/CTABlock.astro` — reusable CTA (navy/light/white variants)
- `src/components/FAQBlock.astro` — accordion FAQ with JS toggle
- `src/content/config.ts` — blog collection TypeScript schema

## Placeholder Tokens (Replace Before Launch)
These tokens appear throughout all pages and must be replaced with real values:
- `{{PHONE}}` — practice phone number (e.g., (714) 555-0100)
- `{{DOCTOR_NAME}}` — doctor's full name (e.g., "Dr. Jane Smith")
- `{{STREET}}` — street address
- `{{ZIP}}` — ZIP code
- `{{HOURS}}` — opening hours string (e.g., "Mo-Fr 08:00-17:00")
- `{{FORMSPREE_ID}}` — Formspree form ID (in schedule.astro)
- `{{TURNSTILE_SITE_KEY}}` — Cloudflare Turnstile key (in schedule.astro)
- `{{GA4_MEASUREMENT_ID}}` — GA4 property ID (in BaseLayout.astro)

To replace all at once, use find-and-replace across `src/` directory.

## Site Structure
```
src/pages/
├── index.astro                    # Homepage
├── about.astro                    # About / doctor bio
├── schedule.astro                 # Appointment form
├── gallery.astro                  # Before/after gallery
├── dental-implants/
│   ├── index.astro                # Implants hub
│   ├── single-tooth.astro
│   ├── bone-grafting.astro
│   ├── implant-placement.astro
│   └── consultation.astro
├── all-on-x/
│   ├── index.astro                # All-on-X hub
│   ├── all-on-4.astro
│   ├── all-on-6.astro
│   ├── full-arch.astro
│   └── full-mouth-reconstruction.astro
├── implant-restorations/
│   ├── index.astro
│   ├── crowns.astro
│   ├── bridges.astro
│   ├── dentures.astro
│   └── snap-on.astro
├── veneers/
│   ├── index.astro
│   ├── porcelain.astro
│   └── smile-makeover.astro
├── cosmetic-dentistry/
│   ├── index.astro
│   ├── whitening.astro
│   └── bonding.astro
├── restorative-dentistry/
│   ├── index.astro
│   ├── crowns.astro
│   └── bridges.astro
├── dentures/
│   ├── index.astro
│   ├── full.astro
│   └── partial.astro
├── general-dentistry/
│   ├── index.astro
│   └── cleanings.astro
├── clear-aligners/
│   └── index.astro
└── blog/
    ├── index.astro
    └── [slug].astro               # Dynamic blog renderer
```

## Automation Scripts (`/scripts/`)
Require additional .env variables — see `.env.example`:
- `gsc-report.js` — Google Search Console top queries/pages
- `gbp.js` — Unified GBP CLI (`npm run gbp -- login|status|reviews|reply|post|locations`)
- `gbp-post.js` — Create Google Business Profile post
- `gbp-reviews.js` — Fetch GBP reviews
- `gbp-respond.js` — Reply to a GBP review
- Setup: `docs/gbp-setup-walkthrough.md` · CLI: `docs/gbp-cli.md` · Offboarding: `docs/gbp-offboarding.md`
- `chatgpt-ads.js` — OpenAI Ads CLI (`npm run chatgpt-ads -- status|campaigns|tree|insights|conversions|capi-validate`)
- Setup: `docs/openai-ads/` · Learnings: `docs/openai-ads/learnings.md` · Campaign SoT: `_References/hb_prosthodontics_chatgpt_ads_implementation_plan_v2.md`
- `ga4-report.js` — GA4 sessions, conversions, top pages
- `site-audit.js` — Crawl site, check SEO issues

Run with: `node scripts/<script>.js --help` (most accept --help flags or display usage on error)

## Git Workflow
This Claude Code environment requires pushes to go to `claude/<task>-<sessionId>` branches — direct push to `main` returns 403. The repo has **no branch protection rules on GitHub**, so PRs can be merged immediately via the GitHub web UI or auto-merged after pushing. Every merge to `main` triggers an automatic Cloudflare Pages deploy.

## GitHub Actions Deploy
`.github/workflows/deploy.yml` — triggers on push to `main`.
Required GitHub Secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Cloudflare Pages project name: `huntington-beach-prosthodontics`

## Development
```bash
npm install          # Install dependencies
npm run dev          # Dev server at localhost:4321
npm run build        # Production build to /dist
npm run preview      # Preview /dist locally
```

## Adding a New Blog Post
Create `src/content/blog/your-slug.md` with frontmatter:
```yaml
---
title: "Post Title"
description: "Meta description (120–160 chars)"
publishDate: 2025-01-15
targetKeyword: "primary keyword"
category: "patient-education"  # or "implants" | "cosmetic" | "prosthodontics" | "practice-news"
author: "Dr. {{DOCTOR_NAME}}"
draft: false
---
```

## Conventions
- All pages use `BaseLayout.astro` with title, description, schema props
- Every page has `localBusiness` JSON-LD schema
- Treatment pages also include `procedureSchema` or `faqSchema` as appropriate
- FAQs use the `FAQBlock` component
- All CTAs use `CTABlock` component or `btn-accent` / `btn-primary` classes
- `section-heading` class for h2, `section-subheading` for sub-h2
- `card` class for content cards
