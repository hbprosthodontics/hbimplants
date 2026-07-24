/**
 * Thin client for the OpenAI Ads Advertiser API.
 * Docs: https://developers.openai.com/ads/api-overview
 */

import 'dotenv/config';

export const ADS_API_BASE = 'https://api.ads.openai.com/v1';

export function getAdsApiKey() {
  return process.env.OPENAI_ADS_API_KEY?.trim() || '';
}

/**
 * @param {string} path
 * @param {{ method?: string, query?: Record<string, string | number | undefined>, body?: unknown }} [opts]
 */
export async function adsFetch(path, opts = {}) {
  const key = getAdsApiKey();
  if (!key) {
    throw new Error(
      'OPENAI_ADS_API_KEY is not set. Create a key in Ads Manager → Settings, then add it to .env.'
    );
  }

  const url = new URL(path.startsWith('http') ? path : `${ADS_API_BASE}${path}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.message ||
      data?.raw ||
      `${res.status} ${res.statusText}`;
    const err = new Error(`Ads API ${opts.method || 'GET'} ${url.pathname}: ${msg}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

/** @param {number | undefined} micros */
export function microsToUsd(micros) {
  if (micros == null) return null;
  return Number(micros) / 1_000_000;
}

/** @param {number | undefined} ts */
export function formatUnix(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toISOString().slice(0, 10);
}
