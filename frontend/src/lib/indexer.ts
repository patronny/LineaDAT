/**
 * Thin GraphQL client for the LINEASTR Ponder indexer.
 *
 * Indexer source: automation/indexer/. Deployed at NEXT_PUBLIC_INDEXER_URL
 * (default https://lineastr-indexer.fly.dev/graphql). Schema covers two
 * tables: `bag` (BoughtByProtocol+SoldByProtocol joined by bagId) and
 * `swap` (hook Trade events).
 *
 * No Apollo / urql / SWR pulled in — one tiny POST helper is enough; React
 * components manage their own loading state via useEffect + setInterval.
 */

export const INDEXER_URL =
  process.env.NEXT_PUBLIC_INDEXER_URL ?? "https://lineastr-indexer.fly.dev/graphql";

export const INDEXER_ENABLED = !!INDEXER_URL && !INDEXER_URL.includes("disabled");

export type BagRow = {
  bagId: string;          // bigint as string from GraphQL
  blockNumber: string;
  timestamp: number;
  txHash: `0x${string}`;
  paid: string;           // wei
  listPrice: string;      // wei
  soldFor: string | null;
  soldAt: number | null;
  soldTxHash: `0x${string}` | null;
  buyer: `0x${string}` | null;
};

export type SwapRow = {
  id: string;
  blockNumber: string;
  timestamp: number;
  txHash: `0x${string}`;
  trader: `0x${string}`;
  side: "buy" | "sell";
  ethAmount: string;
  tokenAmount: string;
  sqrtPriceX96: string;
};

export type Page<T> = {
  items: T[];
  totalCount: number;
  pageInfo: { endCursor: string | null; hasNextPage: boolean; startCursor: string | null; hasPreviousPage: boolean };
};

async function gql<T>(query: string, variables?: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  if (!INDEXER_ENABLED) throw new Error("indexer disabled");
  const res = await fetch(INDEXER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    signal,
  });
  if (!res.ok) throw new Error(`indexer http ${res.status}`);
  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
  if (!json.data) throw new Error("indexer empty response");
  return json.data;
}

const BAG_FIELDS = `bagId blockNumber timestamp txHash paid listPrice soldFor soldAt soldTxHash buyer`;
const SWAP_FIELDS = `id blockNumber timestamp txHash trader side ethAmount tokenAmount sqrtPriceX96`;

/**
 * All bags (active listings = soldAt:null, sold = soldAt_not:null).
 * Holdings table filters in-memory; Sales table filters in-memory.
 */
export async function fetchBags(signal?: AbortSignal): Promise<BagRow[]> {
  const data = await gql<{ bags: Page<BagRow> }>(
    `query { bags(orderBy: "blockNumber", orderDirection: "desc", limit: 1000) { items { ${BAG_FIELDS} } } }`,
    undefined,
    signal
  );
  return data.bags.items;
}

/**
 * Most-recent swaps. limit caps a single fetch — pagination via `after`
 * cursor is not wired into the table UI yet (it pages client-side).
 */
export async function fetchSwaps(limit = 200, signal?: AbortSignal): Promise<SwapRow[]> {
  const data = await gql<{ swaps: Page<SwapRow> }>(
    `query($limit: Int!) { swaps(orderBy: "timestamp", orderDirection: "desc", limit: $limit) { items { ${SWAP_FIELDS} } } }`,
    { limit },
    signal
  );
  return data.swaps.items;
}

/**
 * Earliest swap with timestamp >= sinceUnix (used to compute the 24h price
 * change baseline). Returns null when no swap exists in that window.
 */
export async function fetchOldestSwapSince(
  sinceUnix: number,
  signal?: AbortSignal
): Promise<SwapRow | null> {
  const data = await gql<{ swaps: Page<SwapRow> }>(
    `query($since: Int!) {
      swaps(
        where: { timestamp_gt: $since }
        orderBy: "timestamp"
        orderDirection: "asc"
        limit: 1
      ) { items { ${SWAP_FIELDS} } }
    }`,
    { since: sinceUnix },
    signal
  );
  return data.swaps.items[0] ?? null;
}

/**
 * Liveness probe for the indexer. Used by hooks to decide whether to fall
 * back to on-chain getLogs. ~120ms call, cached for 30s.
 */
let probeCache: { ok: boolean; at: number } | null = null;
export async function probeIndexer(): Promise<boolean> {
  if (!INDEXER_ENABLED) return false;
  const now = Date.now();
  if (probeCache && now - probeCache.at < 30_000) return probeCache.ok;
  try {
    await gql<{ __typename: string }>(`{ __typename }`);
    probeCache = { ok: true, at: now };
    return true;
  } catch {
    probeCache = { ok: false, at: now };
    return false;
  }
}
