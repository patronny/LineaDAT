"use client";

import { useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { strategyAbi } from "@/lib/abis/strategy";
import { erc20Abi } from "@/lib/abis/erc20";
import { ADDR } from "@/lib/wagmi";
import { useStrategyStats } from "@/hooks/useStrategyStats";
import { formatEth, formatTokens } from "@/lib/utils";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

type Tab = "buy" | "faucet" | "twap";

/**
 * Sticky right-rail trade widget. On mobile, this surfaces ABOVE bags-for-sale.
 *
 * 3 tabs:
 *   - Buy bag: bot/user calls strategy.buyTokens (sells tLINEA for ETH from currentFees)
 *   - Faucet: claim 100k tLINEA from MockTLINEA
 *   - TWAP: anyone can trigger processTokenTwap (earns 0.5% reward)
 */
export function TradeWidgetClient() {
  const [tab, setTab] = useState<Tab>("buy");
  const { isConnected } = useAccount();

  return (
    <Card className="overflow-hidden">
      {/* Tab nav */}
      <div className="grid grid-cols-3 border-b border-border">
        {(["buy", "faucet", "twap"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-3 text-xs sm:text-sm font-medium uppercase tracking-wider transition-colors ${
              tab === t
                ? "text-primary border-b-2 border-primary -mb-px bg-primary/5"
                : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-6">
        {tab === "buy" && <BuyTab disabled={!isConnected} />}
        {tab === "faucet" && <FaucetTab disabled={!isConnected} />}
        {tab === "twap" && <TwapTab disabled={!isConnected} />}
      </div>
    </Card>
  );
}

function BuyTab({ disabled }: { disabled: boolean }) {
  const { data: stats } = useStrategyStats();
  const { address } = useAccount();
  const { writeContract, isPending } = useWriteContract();

  const { data: userTLineaBal } = useReadContract({
    address: ADDR.tLINEA,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && ADDR.tLINEA !== "0x0000000000000000000000000000000000000000", refetchInterval: 12_000 },
  });

  const { data: allowance } = useReadContract({
    address: ADDR.tLINEA,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, ADDR.strategy] : undefined,
    query: { enabled: !!address && ADDR.tLINEA !== "0x0000000000000000000000000000000000000000", refetchInterval: 12_000 },
  });

  const bagSize = stats?.bagSize ?? 0n;
  const availableFunds = stats?.availableFunds ?? 0n;
  const userBal = userTLineaBal ?? 0n;
  const userAllowance = allowance ?? 0n;
  const enoughBalance = userBal >= bagSize;
  const enoughAllowance = userAllowance >= bagSize;

  function approve() {
    writeContract({
      address: ADDR.tLINEA,
      abi: erc20Abi,
      functionName: "approve",
      args: [ADDR.strategy, bagSize],
    });
  }

  function buy() {
    writeContract({
      address: ADDR.strategy,
      abi: strategyAbi,
      functionName: "buyTokens",
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Buy a bag</div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Sell {formatTokens(bagSize)} tLINEA → receive {formatEth(availableFunds)} ETH from
          protocol fees. Bag will be relisted at 1.2× your paid price.
        </p>
      </div>

      <div className="space-y-2 text-sm">
        <Row label="Bag size" value={`${formatTokens(bagSize)} tLINEA`} />
        <Row label="You'll receive" value={`${formatEth(availableFunds)} ETH`} highlight={availableFunds > 0n} />
        <Row label="Your tLINEA balance" value={formatTokens(userBal)} muted={!enoughBalance} />
      </div>

      {availableFunds === 0n && (
        <p className="text-xs text-warning">Available funds = 0. Bot will buy when fees accumulate.</p>
      )}

      {!enoughBalance ? (
        <Button className="w-full" disabled>
          Need {formatTokens(bagSize - userBal)} more tLINEA
        </Button>
      ) : !enoughAllowance ? (
        <Button className="w-full" onClick={approve} disabled={disabled || isPending}>
          {isPending ? "Approving..." : `Approve tLINEA`}
        </Button>
      ) : (
        <Button className="w-full" onClick={buy} disabled={disabled || isPending || availableFunds === 0n}>
          {isPending ? "Buying..." : "Buy bag"}
        </Button>
      )}
    </div>
  );
}

function FaucetTab({ disabled }: { disabled: boolean }) {
  const { address } = useAccount();
  const { writeContract, isPending } = useWriteContract();

  const { data: lastFaucet } = useReadContract({
    address: ADDR.tLINEA,
    abi: erc20Abi,
    functionName: "lastFaucetAt",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 30_000 },
  });

  const now = Math.floor(Date.now() / 1000);
  const cooldown = 3600;
  const last = Number(lastFaucet ?? 0n);
  const ready = last === 0 || now - last >= cooldown;

  function claim() {
    writeContract({ address: ADDR.tLINEA, abi: erc20Abi, functionName: "faucetClaim" });
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">tLINEA faucet</div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Claim 100 000 tLINEA per hour to test the protocol. Total cap 100M to prevent griefing.
        </p>
      </div>
      <Button className="w-full" onClick={claim} disabled={disabled || isPending || !ready}>
        {!ready
          ? `Cooldown: ${Math.ceil((cooldown - (now - last)) / 60)} min remaining`
          : isPending
            ? "Claiming..."
            : "Claim 100 000 tLINEA"}
      </Button>
    </div>
  );
}

function TwapTab({ disabled }: { disabled: boolean }) {
  const { data: stats } = useStrategyStats();
  const { writeContract, isPending } = useWriteContract();

  const ethToTwap = stats?.ethToTwap ?? 0n;
  const twapInc = stats?.twapIncrement ?? 0n;
  const reward = (ethToTwap > twapInc ? twapInc : ethToTwap) * 5n / 1000n; // 0.5% of burn amount

  function trigger() {
    writeContract({ address: ADDR.strategy, abi: strategyAbi, functionName: "processTokenTwap" });
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">TWAP burn</div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Trigger the next TWAP cycle. The protocol buys LINEASTR with {formatEth(twapInc)} ETH and burns it.
          You earn 0.5% reward.
        </p>
      </div>
      <div className="space-y-2 text-sm">
        <Row label="Pending ETH" value={`${formatEth(ethToTwap)} ETH`} highlight={ethToTwap >= twapInc} />
        <Row label="Reward you'd earn" value={`${formatEth(reward)} ETH`} />
      </div>
      <Button className="w-full" onClick={trigger} disabled={disabled || isPending || ethToTwap < twapInc}>
        {isPending ? "Processing..." : "Trigger TWAP burn"}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        Note: requires LINEASTR/ETH Uniswap v4 pool. Disabled in Phase 3 testnet.
      </p>
    </div>
  );
}

function Row({ label, value, highlight, muted }: { label: string; value: string; highlight?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`font-mono tabular ${highlight ? "text-primary font-semibold" : ""} ${muted ? "text-destructive" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
