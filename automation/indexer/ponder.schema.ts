import { onchainTable, index } from "ponder";

/**
 * Bag — one row per ERC20BoughtByProtocol event. Represents a 150k tLINEA bag the
 * bot purchased and listed at 1.2× markup. soldFor / soldAt populate later when
 * the bag is redeemed via ERC20SoldByProtocol.
 */
export const bag = onchainTable(
  "bag",
  (t) => ({
    bagId: t.bigint().primaryKey(),
    blockNumber: t.bigint().notNull(),
    timestamp: t.integer().notNull(),
    txHash: t.hex().notNull(),
    paid: t.bigint().notNull(),       // ETH the bot paid
    listPrice: t.bigint().notNull(),  // ETH list price (paid × 1.2)
    soldFor: t.bigint(),              // ETH actually received on redemption
    soldAt: t.integer(),              // unix seconds — null while still listed
    soldTxHash: t.hex(),
    buyer: t.hex(),
  }),
  (table) => ({
    blockIdx: index().on(table.blockNumber),
    soldAtIdx: index().on(table.soldAt),
  })
);

/**
 * Swap — one row per Trade event from the LINEASTR hook. Captures user-driven
 * buys/sells against the v4 pool (the bot path uses a different code path and
 * does not emit Trade).
 */
export const swap = onchainTable(
  "swap",
  (t) => ({
    id: t.text().primaryKey(),         // `${blockNumber}-${logIndex}`
    blockNumber: t.bigint().notNull(),
    timestamp: t.integer().notNull(),
    txHash: t.hex().notNull(),
    trader: t.hex().notNull(),         // tx.from at the time of the swap
    side: t.text().notNull(),          // "buy" | "sell"
    ethAmount: t.bigint().notNull(),   // absolute value, wei
    tokenAmount: t.bigint().notNull(), // absolute value, wei (LINEASTR has 18 decimals)
    sqrtPriceX96: t.bigint().notNull(),
  }),
  (table) => ({
    blockIdx: index().on(table.blockNumber),
    timeIdx: index().on(table.timestamp),
    sideIdx: index().on(table.side),
  })
);
