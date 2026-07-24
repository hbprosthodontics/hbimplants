#!/usr/bin/env node
/**
 * ChatGPT / OpenAI Ads CLI for hbimplants.
 *
 * Usage:
 *   npm run chatgpt-ads -- status
 *   npm run chatgpt-ads -- campaigns
 *   npm run chatgpt-ads -- ad-groups --campaign-id cmpn_...
 *   npm run chatgpt-ads -- ads --ad-group-id adgrp_...
 *   npm run chatgpt-ads -- tree
 *   npm run chatgpt-ads -- insights [--days 7] [--campaign-id ID] [--ad-id ID]
 *   npm run chatgpt-ads -- conversions
 *   npm run chatgpt-ads -- capi-validate
 *
 * Setup: docs/openai-ads/
 */

import {
  adsFetch,
  formatUnix,
  getAdsApiKey,
  microsToUsd,
} from './lib/chatgpt-ads-client.js';

const HELP = `
ChatGPT Ads CLI (hbimplants)

Setup (once):
  docs/openai-ads/setup.md
  1. Ads Manager → Settings → issue an API key → OPENAI_ADS_API_KEY in .env
  2. Ads Manager → Conversions → Pixel ID → PUBLIC_OPENAI_ADS_PIXEL_ID in .env
  3. Create a lead_created conversion event pointed at that pixel
  4. Ads Manager → Conversions → Conversion keys → OPENAI_ADS_CONVERSIONS_API_KEY
  5. Add PUBLIC_OPENAI_ADS_PIXEL_ID as a GitHub Actions secret for production builds
  Gotchas: docs/openai-ads/learnings.md

Commands:
  status       Confirm API key + print ad account metadata
  campaigns    List campaigns
  ad-groups    List ad groups (--campaign-id required)
  ads          List ads (--ad-group-id required)
  tree         Campaigns → ad groups → ads overview
  insights     Performance metrics (--days N, optional --campaign-id / --ad-id)
  conversions  List pixel + conversion event settings
  capi-validate  Dry-run a lead_created event via Conversions API

Examples:
  npm run chatgpt-ads -- status
  npm run chatgpt-ads -- campaigns
  npm run chatgpt-ads -- tree
  npm run chatgpt-ads -- conversions
  npm run chatgpt-ads -- capi-validate
  npm run chatgpt-ads -- insights --days 7
  npm run chatgpt-ads -- insights --campaign-id cmpn_xxx --days 14
`;

function parseArgs(argv) {
  const [command, ...rest] = argv;
  /** @type {Record<string, string | boolean>} */
  const flags = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--help' || a === '-h') flags.help = true;
    else if (a.startsWith('--') && rest[i + 1] && !rest[i + 1].startsWith('--')) {
      flags[a.slice(2)] = rest[++i];
    } else if (a.startsWith('--')) {
      flags[a.slice(2)] = true;
    }
  }
  return { command, flags };
}

function printTable(rows, columns) {
  if (!rows.length) {
    console.log('(none)');
    return;
  }
  const widths = columns.map((c) =>
    Math.max(c.label.length, ...rows.map((r) => String(c.value(r) ?? '').length))
  );
  console.log(columns.map((c, i) => c.label.padEnd(widths[i])).join('  '));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const row of rows) {
    console.log(columns.map((c, i) => String(c.value(row) ?? '—').padEnd(widths[i])).join('  '));
  }
}

async function cmdStatus() {
  const key = getAdsApiKey();
  if (!key) {
    console.error('✗ OPENAI_ADS_API_KEY missing from .env');
    process.exit(1);
  }
  console.log(`API key: ${key.slice(0, 8)}…${key.slice(-4)} (${key.length} chars)`);

  const account = await adsFetch('/ad_account');
  console.log('\nAd account');
  console.log(`  id:       ${account.id}`);
  console.log(`  name:     ${account.name}`);
  console.log(`  url:      ${account.url || '—'}`);
  console.log(`  status:   ${account.status || '—'}`);
  console.log(`  timezone: ${account.timezone || '—'}`);
  console.log(`  currency: ${account.currency_code || '—'}`);
  console.log(`  review:   ${account.review?.status || '—'}`);

  const pixelId = process.env.PUBLIC_OPENAI_ADS_PIXEL_ID?.trim();
  console.log('\nSite pixel');
  console.log(
    pixelId
      ? `  PUBLIC_OPENAI_ADS_PIXEL_ID: ${pixelId}`
      : '  PUBLIC_OPENAI_ADS_PIXEL_ID: (not set — site will not load OAIQ)'
  );
  console.log('\n✓ Ads API reachable');
}

async function cmdCampaigns() {
  const res = await adsFetch('/campaigns', { query: { limit: 100, order: 'desc' } });
  const rows = res.data || [];
  printTable(rows, [
    { label: 'ID', value: (r) => r.id },
    { label: 'Name', value: (r) => r.name },
    { label: 'Status', value: (r) => r.status },
    { label: 'Bidding', value: (r) => r.bidding_type },
    {
      label: 'Budget $',
      value: (r) => {
        const usd = microsToUsd(r.budget?.lifetime_spend_limit_micros);
        return usd == null ? '—' : usd.toFixed(2);
      },
    },
    { label: 'Start', value: (r) => formatUnix(r.start_time) },
  ]);
  console.log(`\n${rows.length} campaign(s)`);
}

async function cmdAdGroups(flags) {
  const campaignId = flags['campaign-id'];
  if (!campaignId) {
    console.error('Error: --campaign-id is required');
    process.exit(1);
  }
  const res = await adsFetch('/ad_groups', {
    query: { campaign_id: campaignId, limit: 100, order: 'desc' },
  });
  const rows = res.data || [];
  printTable(rows, [
    { label: 'ID', value: (r) => r.id },
    { label: 'Name', value: (r) => r.name },
    { label: 'Status', value: (r) => r.status },
    {
      label: 'Max bid $',
      value: (r) => {
        const usd = microsToUsd(r.bidding_config?.max_bid_micros);
        return usd == null ? '—' : usd.toFixed(2);
      },
    },
    {
      label: 'Hints',
      value: (r) => (r.context_hints || []).slice(0, 2).join('; ') || '—',
    },
  ]);
  console.log(`\n${rows.length} ad group(s) in ${campaignId}`);
}

async function cmdAds(flags) {
  const adGroupId = flags['ad-group-id'];
  if (!adGroupId) {
    console.error('Error: --ad-group-id is required');
    process.exit(1);
  }
  const res = await adsFetch('/ads', {
    query: { ad_group_id: adGroupId, limit: 100, order: 'desc' },
  });
  const rows = res.data || [];
  printTable(rows, [
    { label: 'ID', value: (r) => r.id },
    { label: 'Name', value: (r) => r.name },
    { label: 'Status', value: (r) => r.status },
    { label: 'Review', value: (r) => r.review_status },
    { label: 'Title', value: (r) => r.creative?.title },
  ]);
  console.log(`\n${rows.length} ad(s) in ${adGroupId}`);
}

async function cmdTree() {
  const campaigns = (await adsFetch('/campaigns', { query: { limit: 100, order: 'desc' } })).data || [];
  if (!campaigns.length) {
    console.log('(no campaigns)');
    return;
  }

  for (const campaign of campaigns) {
    const budget = microsToUsd(campaign.budget?.lifetime_spend_limit_micros);
    console.log(
      `\n▸ ${campaign.name}  [${campaign.status}]  ${campaign.id}` +
        (budget != null ? `  budget $${budget.toFixed(2)}` : '')
    );

    const groups =
      (
        await adsFetch('/ad_groups', {
          query: { campaign_id: campaign.id, limit: 100, order: 'desc' },
        })
      ).data || [];

    if (!groups.length) {
      console.log('    (no ad groups)');
      continue;
    }

    for (const group of groups) {
      console.log(`  ├─ ${group.name}  [${group.status}]  ${group.id}`);
      const ads =
        (
          await adsFetch('/ads', {
            query: { ad_group_id: group.id, limit: 100, order: 'desc' },
          })
        ).data || [];

      if (!ads.length) {
        console.log('  │    (no ads)');
        continue;
      }
      for (const ad of ads) {
        const title = ad.creative?.title ? ` — “${ad.creative.title}”` : '';
        console.log(
          `  │    • ${ad.name}  [${ad.status}/${ad.review_status || '?'}]  ${ad.id}${title}`
        );
      }
    }
  }
}

async function cmdConversions() {
  const pixels = (await adsFetch('/conversions/pixels')).data || [];
  console.log('Pixels / data sources\n');
  printTable(pixels, [
    { label: 'Source ID', value: (r) => r.id },
    { label: 'Name', value: (r) => r.name },
    { label: 'Pixel ID', value: (r) => r.pixel_id },
    { label: 'Type', value: (r) => r.client_type },
  ]);

  const events = (await adsFetch('/conversions/event_settings', { query: { limit: 100 } })).data || [];
  console.log('\nConversion events\n');
  printTable(events, [
    { label: 'ID', value: (r) => r.id },
    { label: 'Name', value: (r) => r.name },
    { label: 'Event', value: (r) => r.event_type },
    { label: 'Window', value: (r) => `${r.attribution_window_days}d` },
    { label: 'Archived', value: (r) => (r.archived ? 'yes' : 'no') },
  ]);
  if (!events.length) console.log('(none — create via API or Ads Manager → + Create conversion events)');
}

async function cmdCapiValidate() {
  const key = process.env.OPENAI_ADS_CONVERSIONS_API_KEY?.trim();
  const pixelId = process.env.PUBLIC_OPENAI_ADS_PIXEL_ID?.trim();
  if (!key) {
    console.error('✗ OPENAI_ADS_CONVERSIONS_API_KEY missing');
    console.error('  Create one in Ads Manager → Conversions → Conversion keys');
    process.exit(1);
  }
  if (!pixelId) {
    console.error('✗ PUBLIC_OPENAI_ADS_PIXEL_ID missing');
    process.exit(1);
  }

  const res = await fetch(`https://bzr.openai.com/v1/events?pid=${encodeURIComponent(pixelId)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      validate_only: true,
      events: [
        {
          id: `validate_lead_${Date.now()}`,
          type: 'lead_created',
          timestamp_ms: Date.now(),
          source_url: 'https://hbimplants.com/thank-you',
          action_source: 'web',
          data: { type: 'customer_action' },
        },
      ],
    }),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    console.error(`✗ CAPI validate failed (HTTP ${res.status})`);
    console.error(`  ${data?.error?.message || text}`);
    if (String(data?.error?.message || '').includes('Missing scopes')) {
      console.error('\n  That key is not a Conversions API key (or lacks ads.third_party_events.write).');
      console.error('  Ads Manager → Conversions → Conversion keys → create a new key.');
      console.error('  Do not reuse OPENAI_ADS_API_KEY from Settings.');
    }
    process.exit(1);
  }

  console.log('✓ Conversions API key accepted (validate_only)');
  console.log(JSON.stringify(data, null, 2));
}

async function cmdInsights(flags) {
  const days = Number(flags.days || 7);
  const end = Math.floor(Date.now() / 1000);
  const start = end - days * 24 * 60 * 60;

  let path = '/ad_account/insights';
  let label = 'ad account';
  if (flags['ad-id']) {
    path = `/ads/${flags['ad-id']}/insights`;
    label = `ad ${flags['ad-id']}`;
  } else if (flags['campaign-id']) {
    path = `/campaigns/${flags['campaign-id']}/insights`;
    label = `campaign ${flags['campaign-id']}`;
  } else if (flags['ad-group-id']) {
    path = `/ad_groups/${flags['ad-group-id']}/insights`;
    label = `ad group ${flags['ad-group-id']}`;
  }

  const res = await adsFetch(path, {
    query: {
      time_granularity: 'daily',
      start_time: start,
      end_time: end,
      limit: Math.min(days + 2, 100),
    },
  });

  const rows = res.data || [];
  console.log(`Insights: ${label} · last ${days} day(s)\n`);
  printTable(rows, [
    { label: 'Date', value: (r) => r.readable_time || formatUnix(r.start_time) },
    { label: 'Impr', value: (r) => r.impressions ?? '—' },
    { label: 'Clicks', value: (r) => r.clicks ?? '—' },
    { label: 'Spend', value: (r) => (r.spend != null ? Number(r.spend).toFixed(2) : '—') },
    { label: 'CTR', value: (r) => (r.ctr != null ? `${(Number(r.ctr) * 100).toFixed(2)}%` : '—') },
    { label: 'CPC', value: (r) => (r.cpc != null ? Number(r.cpc).toFixed(2) : '—') },
  ]);

  if (!rows.length) {
    console.log('(no rows — campaign may be too new or outside the window)');
  }
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));

  if (!command || command === 'help' || flags.help) {
    console.log(HELP);
    process.exit(0);
  }

  try {
    switch (command) {
      case 'status':
        await cmdStatus();
        break;
      case 'campaigns':
        await cmdCampaigns();
        break;
      case 'ad-groups':
        await cmdAdGroups(flags);
        break;
      case 'ads':
        await cmdAds(flags);
        break;
      case 'tree':
        await cmdTree();
        break;
      case 'insights':
        await cmdInsights(flags);
        break;
      case 'conversions':
        await cmdConversions();
        break;
      case 'capi-validate':
        await cmdCapiValidate();
        break;
      default:
        console.error(`Unknown command: ${command}\n`);
        console.log(HELP);
        process.exit(1);
    }
  } catch (err) {
    console.error(`\n✗ ${err.message}`);
    if (err.status === 401 || err.status === 403) {
      console.error('  Check OPENAI_ADS_API_KEY in .env (Ads Manager → Settings).');
    }
    process.exit(1);
  }
}

main();
