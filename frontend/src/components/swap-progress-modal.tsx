"use client";

import { ReactNode, useEffect } from "react";
import { Check, ExternalLink, Loader2, X } from "lucide-react";
import { Button } from "./ui/button";
import { txUrl } from "@/lib/wagmi";

export type SwapStep =
  | "idle"
  | "awaiting-approve" // user must click Approve to fire wallet popup
  | "approving"        // approve tx in flight (signing or mining)
  | "awaiting-swap"    // approve done, swap tx queued (auto-fires)
  | "swapping"         // swap tx in flight
  | "success"
  | "error";

export interface SwapProgressModalProps {
  open: boolean;
  mode: "buy" | "sell";
  step: SwapStep;
  fromAmount: string;
  fromSymbol: string;
  toAmount: string;
  toSymbol: string;
  swapTxHash?: `0x${string}`;
  errorMessage?: string;
  onApproveClick: () => void;
  onClose: () => void;
}

const neonGreen = "rgb(74, 222, 128)";
const neonGreenGlow = "0 0 6px rgba(74,222,128,0.85), 0 0 14px rgba(74,222,128,0.5)";

/**
 * LlamaSwap-style step modal. Buy (no approve) shows a single-step swap
 * tracker; Sell (approve required) shows two steps and auto-advances to the
 * swap popup once approve confirms. The action button surface is owned by
 * the modal, not the page - so users physically cannot fire a duplicate
 * tx via stray clicks while a swap is mid-flight.
 */
export function SwapProgressModal({
  open,
  mode,
  step,
  fromAmount,
  fromSymbol,
  toAmount,
  toSymbol,
  swapTxHash,
  errorMessage,
  onApproveClick,
  onClose,
}: SwapProgressModalProps) {
  // Lock background scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const totalSteps = mode === "sell" ? 2 : 1;
  const approveDone = step === "awaiting-swap" || step === "swapping" || step === "success";
  const swapDone = step === "success";
  const swapActive = step === "awaiting-swap" || step === "swapping";

  const title =
    step === "success"
      ? `Swapped ${fromSymbol} for ${toSymbol}`
      : `Swapping ${fromSymbol} for ${toSymbol}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="swap-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      {/* Backdrop. Closing only allowed when no tx in flight. */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={() => {
          if (step === "approving" || step === "swapping") return;
          onClose();
        }}
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-md bg-card border border-border rounded-lg shadow-[0_0_40px_rgba(0,0,0,0.6)] overflow-hidden">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border">
          <h2 id="swap-modal-title" className="text-base sm:text-lg font-display font-bold tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => {
              if (step === "approving" || step === "swapping") return;
              onClose();
            }}
            disabled={step === "approving" || step === "swapping"}
            aria-label="Close"
            className="p-1 rounded-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" strokeWidth={2.25} />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <div className="rounded-md border border-border bg-secondary/30 p-3 space-y-1">
            <div className="font-mono tabular text-base sm:text-lg font-semibold">
              {fromAmount} {fromSymbol}
            </div>
            <div className="text-muted-foreground text-sm">↓</div>
            <div className="font-mono tabular text-base sm:text-lg font-semibold">
              {toAmount ? `≈ ${toAmount}` : "…"} {toSymbol}
            </div>
          </div>

          <ol className="space-y-2">
            {mode === "sell" && (
              <StepRow
                index={1}
                total={totalSteps}
                label={
                  approveDone
                    ? `${fromSymbol} approved`
                    : step === "approving"
                      ? `Approving ${fromSymbol}…`
                      : `Approve ${fromSymbol}`
                }
                state={
                  approveDone
                    ? "done"
                    : step === "approving"
                      ? "active"
                      : step === "awaiting-approve"
                        ? "current"
                        : "pending"
                }
              />
            )}
            <StepRow
              index={mode === "sell" ? 2 : 1}
              total={totalSteps}
              label={
                swapDone
                  ? "Swap completed"
                  : step === "swapping"
                    ? "Submitting swap…"
                    : swapActive
                      ? "Confirm swap"
                      : "Confirm swap"
              }
              state={
                swapDone
                  ? "done"
                  : step === "swapping"
                    ? "active"
                    : swapActive
                      ? "active"
                      : "pending"
              }
            />
          </ol>

          {step === "error" && errorMessage && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {errorMessage}
            </div>
          )}

          {/* Bottom action: Approve initiator (sell flow) or Done/Close. */}
          {step === "awaiting-approve" ? (
            <Button onClick={onApproveClick} className="w-full" size="lg">
              Approve {fromSymbol}
            </Button>
          ) : step === "success" ? (
            <div className="space-y-2">
              {swapTxHash && (
                <a
                  href={txUrl(swapTxHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-secondary/30 px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary/60 hover:border-primary/60 transition-colors focus-visible:ring-2 focus-visible:ring-primary"
                >
                  View on explorer
                  <ExternalLink className="w-4 h-4" strokeWidth={2.25} />
                </a>
              )}
              <Button
                onClick={onClose}
                size="lg"
                className="w-full"
                style={{
                  color: "rgb(0, 0, 0)",
                  background: neonGreen,
                  textShadow: neonGreenGlow,
                  boxShadow: neonGreenGlow,
                }}
              >
                <Check className="w-4 h-4 mr-2" strokeWidth={3} />
                Done
              </Button>
            </div>
          ) : step === "error" ? (
            <Button onClick={onClose} variant="secondary" size="lg" className="w-full">
              Close
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface StepRowProps {
  index: number;
  total: number;
  label: ReactNode;
  state: "pending" | "current" | "active" | "done";
}

function StepRow({ index, total, label, state }: StepRowProps) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-border bg-secondary/20 px-3 py-2.5">
      <div className="flex items-center gap-3 min-w-0">
        <StepIcon state={state} />
        <span
          className={`text-sm truncate ${
            state === "done"
              ? "text-foreground font-medium"
              : state === "active" || state === "current"
                ? "text-foreground"
                : "text-muted-foreground"
          }`}
        >
          {label}
        </span>
      </div>
      <span className="text-xs text-muted-foreground font-mono tabular flex-shrink-0">
        {index}/{total}
      </span>
    </li>
  );
}

function StepIcon({ state }: { state: "pending" | "current" | "active" | "done" }) {
  if (state === "done") {
    return (
      <span
        className="inline-flex items-center justify-center w-6 h-6 rounded-full"
        style={{ color: neonGreen, textShadow: neonGreenGlow }}
        aria-hidden
      >
        <Check className="w-4 h-4" strokeWidth={3} />
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 text-primary" aria-hidden>
        <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />
      </span>
    );
  }
  // pending / current
  return (
    <span
      className={`inline-flex w-3 h-3 ml-1.5 mr-1.5 rounded-full border-2 ${
        state === "current" ? "border-primary" : "border-muted-foreground/50"
      }`}
      aria-hidden
    />
  );
}
