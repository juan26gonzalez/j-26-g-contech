import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface FxResponsePayload {
  ok: boolean;
  copPerUsd: number;
  copPerEur: number;
  eurPerUsd: number;
  source: string;
  updatedAt: string;
}

const FALLBACK_FX: FxResponsePayload = {
  ok: false,
  copPerUsd: 4350,
  copPerEur: 4680,
  eurPerUsd: 0.9295,
  source: "fallback-reference",
  updatedAt: new Date().toISOString(),
};

let cachedFx: { data: FxResponsePayload; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

async function fetchFromOpenErApi(): Promise<FxResponsePayload | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      result?: string;
      time_last_update_utc?: string;
      rates?: Record<string, number>;
    };
    const cop = Number(json?.rates?.COP);
    const eur = Number(json?.rates?.EUR);
    if (!Number.isFinite(cop) || cop <= 1000 || !Number.isFinite(eur) || eur <= 0.1) {
      return null;
    }
    return {
      ok: true,
      copPerUsd: Math.round(cop * 100) / 100,
      copPerEur: Math.round((cop / eur) * 100) / 100,
      eurPerUsd: Math.round(eur * 10000) / 10000,
      source: "open.er-api.com (live)",
      updatedAt: json.time_last_update_utc || new Date().toISOString(),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFromFawazCdn(): Promise<FxResponsePayload | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(
      "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
      { signal: controller.signal, cache: "no-store" }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      date?: string;
      usd?: Record<string, number>;
    };
    const cop = Number(json?.usd?.cop);
    const eur = Number(json?.usd?.eur);
    if (!Number.isFinite(cop) || cop <= 1000 || !Number.isFinite(eur) || eur <= 0.1) {
      return null;
    }
    return {
      ok: true,
      copPerUsd: Math.round(cop * 100) / 100,
      copPerEur: Math.round((cop / eur) * 100) / 100,
      eurPerUsd: Math.round(eur * 10000) / 10000,
      source: "fawazahmed0-cdn (live)",
      updatedAt: json.date || new Date().toISOString(),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const now = Date.now();
  if (cachedFx && now - cachedFx.fetchedAt < CACHE_TTL_MS && cachedFx.data.ok) {
    return NextResponse.json(cachedFx.data, {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
      },
    });
  }

  const live = (await fetchFromOpenErApi()) || (await fetchFromFawazCdn());
  if (live) {
    cachedFx = { data: live, fetchedAt: now };
    return NextResponse.json(live, {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
      },
    });
  }

  if (cachedFx) {
    return NextResponse.json(cachedFx.data);
  }

  return NextResponse.json({
    ...FALLBACK_FX,
    updatedAt: new Date().toISOString(),
  });
}
