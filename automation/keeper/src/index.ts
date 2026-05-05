/**
 * LineaDAT Self-Hosted Keeper
 *
 * Long-running cron service that calls bot.executeRound() when strategy state
 * indicates a productive action is available (fee threshold reached, unsold
 * bag, or pending TWAP burn). Designed for Fly.io but runs anywhere with Node 20+.
 *
 * Replaces:
 *   - Gelato W3F (deprecated May 2026)
 *   - GitHub Actions cron (unreliable on free tier, drops/delays scheduled runs)
 *
 * Env vars (see .env.example):
 *   RPC_URL              — JSON-RPC endpoint (Base Sepolia or Linea mainnet)
 *   KEEPER_PK            — private key of the EOA that submits tx
 *   STRATEGY_ADDR        — strategy proxy
 *   BOT_ADDR             — bot contract
 *   BUY_THRESHOLD_WEI    — fees threshold below which we no-op (default 1e15 = 0.001 ETH)
 *   CRON_SCHEDULE        — node-cron expression (default "every 30 min")
 *   CHAIN_NAME           — log label only (default "base-sepolia")
 *   ROUND_ID_OFFSET      — added to monotonic counter for visibility (default 0)
 *
 * Usage:
 *   npm run dev          — long-running with cron loop
 *   npm run tick         — single execution, exits (good for one-off testing)
 */

import { config } from "dotenv";
import { Contract, Interface, JsonRpcProvider, Wallet, formatEther } from "ethers";
import cron from "node-cron";

config();

const STRATEGY_ABI = [
  "function currentFees() view returns (uint256)",
  "function availableFunds() view returns (uint256)",
  "function ethToTwap() view returns (uint256)",
  "function lastBagId() view returns (uint256)",
];

const BOT_ABI = ["function executeRound(uint256 roundId)"];

interface KeeperConfig {
  rpcUrl: string;
  privateKey: string;
  strategyAddr: string;
  botAddr: string;
  buyThreshold: bigint;
  cronSchedule: string;
  chainName: string;
  roundIdOffset: bigint;
}

function loadConfig(): KeeperConfig {
  const required = ["RPC_URL", "KEEPER_PK", "STRATEGY_ADDR", "BOT_ADDR"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
  return {
    rpcUrl: process.env.RPC_URL!,
    privateKey: process.env.KEEPER_PK!,
    strategyAddr: process.env.STRATEGY_ADDR!,
    botAddr: process.env.BOT_ADDR!,
    buyThreshold: BigInt(process.env.BUY_THRESHOLD_WEI ?? "1000000000000000"),
    cronSchedule: process.env.CRON_SCHEDULE ?? "*/30 * * * *",
    chainName: process.env.CHAIN_NAME ?? "base-sepolia",
    roundIdOffset: BigInt(process.env.ROUND_ID_OFFSET ?? "0"),
  };
}

let tickCounter = 0n;

async function tick(cfg: KeeperConfig): Promise<void> {
  const startedAt = new Date().toISOString();
  tickCounter += 1n;
  const localId = tickCounter;
  const tag = `[${startedAt}] tick#${localId}`;

  try {
    const provider = new JsonRpcProvider(cfg.rpcUrl);
    const signer = new Wallet(cfg.privateKey, provider);
    const strategy = new Contract(cfg.strategyAddr, STRATEGY_ABI, provider);

    const [currentFees, availableFunds, ethToTwap, lastBagId, signerBal] = await Promise.all([
      strategy.currentFees(),
      strategy.availableFunds(),
      strategy.ethToTwap(),
      strategy.lastBagId(),
      provider.getBalance(signer.address),
    ]);

    console.log(
      `${tag} state chain=${cfg.chainName} ` +
        `fees=${formatEther(currentFees)} ` +
        `funds=${formatEther(availableFunds)} ` +
        `twap=${formatEther(ethToTwap)} ` +
        `bagId=${lastBagId} ` +
        `signerBal=${formatEther(signerBal)}`
    );

    const fundsReady = (availableFunds as bigint) >= cfg.buyThreshold;
    const twapPending = (ethToTwap as bigint) > 0n;
    const reasons: string[] = [];
    if (fundsReady) reasons.push(`funds>=${formatEther(cfg.buyThreshold)}`);
    if (twapPending) reasons.push("twap>0");

    if (reasons.length === 0) {
      console.log(`${tag} no-op: nothing to do`);
      return;
    }

    if (signerBal < 1_000_000_000_000_000n) {
      console.warn(
        `${tag} signer balance ${formatEther(signerBal)} < 0.001 ETH — top up keeper EOA`
      );
    }

    const roundId = cfg.roundIdOffset + localId + BigInt(Math.floor(Date.now() / 1000));
    const bot = new Contract(cfg.botAddr, BOT_ABI, signer);
    console.log(`${tag} executeRound(${roundId}) reasons=[${reasons.join(",")}]`);
    // Explicit 1.5M gas — eth_estimateGas under-budgets because the bot's
    // try/catch silently swallows nested-call OOG. processTokenTwap goes 5
    // levels deep (poolManager.unlock → unlockCallback → swap → afterSwap →
    // swap-back), and the 63/64 rule strangles the innermost swap when called
    // with estimated gas. Over-budgeting here costs ~$0 on Base/Linea L2.
    const tx = await bot.executeRound(roundId, { gasLimit: 1_500_000n });
    console.log(`${tag} sent tx=${tx.hash} nonce=${tx.nonce}`);
    const receipt = await tx.wait();
    console.log(
      `${tag} mined block=${receipt?.blockNumber} gasUsed=${receipt?.gasUsed} status=${receipt?.status}`
    );
  } catch (err) {
    console.error(`${tag} error:`, (err as Error).message ?? err);
  }
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  const once = process.argv.includes("--once");

  console.log(
    `LineaDAT keeper start chain=${cfg.chainName} strategy=${cfg.strategyAddr} bot=${cfg.botAddr} cron=${cfg.cronSchedule}`
  );

  if (once) {
    await tick(cfg);
    return;
  }

  // Run once on boot, then on schedule
  await tick(cfg);

  if (!cron.validate(cfg.cronSchedule)) {
    throw new Error(`Invalid CRON_SCHEDULE: ${cfg.cronSchedule}`);
  }

  cron.schedule(cfg.cronSchedule, () => {
    void tick(cfg);
  });

  // Keep process alive
  process.on("SIGTERM", () => {
    console.log("SIGTERM received, exiting");
    process.exit(0);
  });
  process.on("SIGINT", () => {
    console.log("SIGINT received, exiting");
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
