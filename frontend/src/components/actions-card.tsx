"use client";

import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { Button } from "./ui/button";
import { strategyAbi } from "@/lib/abis/strategy";
import { erc20Abi } from "@/lib/abis/erc20";
import { useStrategyStats } from "@/hooks/useStrategyStats";
import { ADDR } from "@/lib/wagmi";
import { formatEth } from "@/lib/utils";

/**
 * Actions card — quick-access secondary actions: Approve tLINEA (for bot bag flow),
 * Trigger TWAP (anyone earns 0.5% reward), Faucet (claim 100k tLINEA per hour).
 */
export function ActionsCard() {
  const { data: stats } = useStrategyStats();
  const { address, isConnected } = useAccount();
  const { writeContract, isPending } = useWriteContract();

  const { data: tlineaBal } = useReadContract({
    address: ADDR.tLINEA,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 12_000 },
  });
  const { data: tlineaAllowance } = useReadContract({
    address: ADDR.tLINEA,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, ADDR.strategy] : undefined,
    query: { enabled: !!address, refetchInterval: 12_000 },
  });
  const { data: lastFaucet } = useReadContract({
    address: ADDR.tLINEA,
    abi: erc20Abi,
    functionName: "lastFaucetAt",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 30_000 },
  });

  const ethToTwap = stats?.ethToTwap ?? 0n;
  const twapReady = ethToTwap > 0n;

  const bagSize = stats?.bagSize ?? 0n;
  const availableFunds = stats?.availableFunds ?? 0n;
  const enoughT = (tlineaBal ?? 0n) >= bagSize;
  const approved = (tlineaAllowance ?? 0n) >= bagSize;
  const canSellBag = approved && enoughT && availableFunds > 0n;

  const cooldown = 3600;
  const last = Number(lastFaucet ?? 0n);
  const now = Math.floor(Date.now() / 1000);
  const faucetReady = last === 0 || now - last >= cooldown;

  function approveTlinea() {
    writeContract({ address: ADDR.tLINEA, abi: erc20Abi, functionName: "approve", args: [ADDR.strategy, bagSize] });
  }
  function sellBag() {
    writeContract({ address: ADDR.strategy, abi: strategyAbi, functionName: "buyTokens" });
  }
  function triggerTwap() {
    writeContract({ address: ADDR.strategy, abi: strategyAbi, functionName: "processTokenTwap" });
  }
  function claimFaucet() {
    writeContract({ address: ADDR.tLINEA, abi: erc20Abi, functionName: "faucetClaim" });
  }

  return (
    <div className="p-4 sm:p-5 space-y-2">
        {!approved ? (
          <Button
            variant="secondary"
            className="w-full"
            onClick={approveTlinea}
            disabled={!isConnected || isPending || !enoughT}
          >
            {!enoughT ? "Get tLINEA from faucet first" : isPending ? "Approving..." : "Approve $tLINEA"}
          </Button>
        ) : (
          <Button
            className="w-full"
            onClick={sellBag}
            disabled={!isConnected || isPending || !canSellBag}
          >
            {availableFunds === 0n
              ? "No fees yet — wait for next bot round"
              : !enoughT
                ? "Need 150k tLINEA to sell a bag"
                : isPending
                  ? "Selling bag..."
                  : `Sell 150k tLINEA bag → ${formatEth(availableFunds)} ETH`}
          </Button>
        )}

        <Button
          variant="secondary"
          className="w-full"
          onClick={triggerTwap}
          disabled={!isConnected || isPending || !twapReady}
        >
          {!twapReady
            ? "No ETH to TWAP yet"
            : isPending
              ? "Burning..."
              : `Trigger TWAP — ${formatEth(ethToTwap)} ETH pending burn`}
        </Button>

        <Button
          variant="secondary"
          className="w-full"
          onClick={claimFaucet}
          disabled={!isConnected || isPending || !faucetReady}
        >
          {!faucetReady
            ? `Faucet cooldown: ${Math.ceil((cooldown - (now - last)) / 60)} min`
            : isPending
              ? "Claiming..."
              : "Faucet — claim 100k tLINEA"}
        </Button>
    </div>
  );
}
