import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Subdomain ↔ path rewrites for sister sites of on-chaindat.com.
 *
 * Each subdomain is served by the same Next.js app at a `/<prefix>/*` route.
 *
 *   docs.on-chaindat.com/             ←→  /docs            (rewrite, transparent)
 *   docs.on-chaindat.com/quickstart   ←→  /docs/quickstart (rewrite, transparent)
 *   docs.on-chaindat.com/docs/foo     →   docs.on-chaindat.com/foo  (308 redirect - strip stray prefix)
 *
 * Why both rewrite and redirect? `Link href="/docs/quickstart"` on the canonical
 * domain works as-is; on the subdomain, clicks would push the literal `/docs/...`
 * into the address bar. The redirect normalizes those URLs back to clean form.
 *
 * Static assets (`_next/static`, `_next/image`, files with an extension) are
 * excluded via the matcher.
 */
const SUBDOMAIN_PREFIXES: Array<[string, string]> = [
  ["docs.", "/docs"],
];

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") || "").toLowerCase();

  for (const [hostPrefix, pathPrefix] of SUBDOMAIN_PREFIXES) {
    if (!host.startsWith(hostPrefix)) continue;

    const url = req.nextUrl.clone();

    // 1. Strip stray `/docs` prefix on the subdomain - keeps URL bar clean.
    if (url.pathname === pathPrefix || url.pathname.startsWith(pathPrefix + "/")) {
      const stripped = url.pathname.slice(pathPrefix.length) || "/";
      url.pathname = stripped;
      return NextResponse.redirect(url);
    }

    // 2. Bare path on the subdomain → rewrite to internal `/<prefix>/<path>`.
    const trimmed = url.pathname.replace(/\/$/, "");
    url.pathname = `${pathPrefix}${trimmed}` || pathPrefix;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
