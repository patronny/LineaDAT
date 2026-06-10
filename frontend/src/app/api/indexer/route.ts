/**
 * Same-origin proxy for the Ponder indexer (GraphQL + healthz).
 *
 * Why this exists: the browser used to fetch the indexer directly at
 * NEXT_PUBLIC_INDEXER_URL (lineadat-indexer.fly.dev). fly.dev is unreachable
 * from sanctioned regions (e.g. Belarus) - the request never leaves the user's
 * network - so LAST SWAPS / HOLDINGS / SALES / 24h volume / 24h change rendered
 * empty there, while everything served from Vercel (/api/snapshot) and the
 * Cloudflare-fronted GeckoTerminal embed worked fine. Routing through this
 * Node.js route handler means the browser only ever talks to on-chaindat.com
 * (reachable); Vercel's server (US/EU region, not Belarus) makes the outbound
 * call to Fly. Same pattern as /api/snapshot. The upstream URL stays
 * SERVER-ONLY so the fly.dev host is never shipped in the client bundle.
 *
 *   POST -> forwards the GraphQL body to <upstream>/graphql
 *   GET  -> proxies <upstream>/healthz (used by the /status ops dashboard)
 *
 * runtime=nodejs is load-bearing: the outbound fetch must leave from a fixed
 * Vercel serverless region, NOT a geo-distributed Edge node.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GRAPHQL =
  process.env.INDEXER_URL ||
  process.env.NEXT_PUBLIC_INDEXER_URL ||
  "https://lineadat-indexer.fly.dev/graphql";
const HEALTHZ = GRAPHQL.replace(/\/graphql\/?$/, "/healthz");

const TIMEOUT_MS = 8_000;

async function pass(upstream: string, init: RequestInit, failBody: string) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(upstream, { ...init, signal: ctrl.signal, cache: "no-store" });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") || "application/json",
        "cache-control": "no-store",
      },
    });
  } catch {
    return new Response(failBody, {
      status: 502,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } finally {
    clearTimeout(t);
  }
}

export async function POST(req: Request) {
  const body = await req.text();
  return pass(
    GRAPHQL,
    { method: "POST", headers: { "content-type": "application/json" }, body },
    JSON.stringify({ errors: [{ message: "indexer_proxy_failed" }] })
  );
}

export async function GET() {
  return pass(HEALTHZ, { method: "GET" }, JSON.stringify({ error: "indexer_proxy_failed" }));
}
