/**
 * Same-origin proxy for the keeper /status endpoint (Fly), so the /status ops
 * dashboard loads from sanctioned regions (e.g. Belarus) where fly.dev is
 * unreachable from the browser. Same rationale + pattern as /api/indexer and
 * /api/snapshot: the browser hits on-chaindat.com, Vercel's server (US/EU)
 * fetches Fly. Upstream URL stays server-only.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM =
  process.env.KEEPER_STATUS_URL ||
  process.env.NEXT_PUBLIC_KEEPER_STATUS_URL ||
  "https://lineadat-keeper.fly.dev/status";

export async function GET() {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6_000);
  try {
    const res = await fetch(UPSTREAM, { signal: ctrl.signal, cache: "no-store" });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") || "application/json",
        "cache-control": "no-store",
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: "keeper_proxy_failed" }), {
      status: 502,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } finally {
    clearTimeout(t);
  }
}
