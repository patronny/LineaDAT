"use client";

import { useEffect, useRef } from "react";

/**
 * Matrix-style binary rain backdrop. Columns of 0/1 characters fall vertically,
 * head bright white, trail dim grey. Pure monochrome to match the hero image
 * reference (no green Matrix tint). Sits behind text content as decorative
 * texture - pointer-events disabled, aria-hidden, doesn't grab focus.
 *
 * Performance:
 *   - Single canvas, requestAnimationFrame loop.
 *   - Paused via IntersectionObserver when the canvas leaves the viewport.
 *   - prefers-reduced-motion -> single static frame.
 *   - DPR-aware sizing via ResizeObserver.
 */
export function BinaryRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const FONT_SIZE = 14;
    let cols = 0;
    // Float row position of the active head per column.
    let drops: number[] = [];
    // Last integer row already drawn - so the glyph stays put for multiple
    // frames and the destination-out fade has time to chew through it.
    let lastRow: number[] = [];
    // Per-column fall speed in chars-per-frame. Re-rolled on each activation.
    let speeds: number[] = [];
    // Per-column on/off flag. Idle columns render nothing; activation rolls
    // every frame with a low probability, which keeps the field sparse.
    let active: boolean[] = [];
    let cssWidth = 0;
    let cssHeight = 0;

    const randSpeed = () => 0.05 + Math.random() * 0.11;
    // Probability per idle column per frame to start a new drop. At ~150 cols
    // on desktop this yields ~5-7 active drops on screen at any time.
    const ACTIVATION_RATE = 0.0008;
    // Per-frame trail erosion. 0.07 => trail visible ~25-30 frames before
    // going fully transparent. With slow fall speeds, a typical drop carries
    // 4-6 visible glyphs.
    const FADE = 0.07;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      cssWidth = rect.width;
      cssHeight = rect.height;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(cssWidth * dpr);
      canvas.height = Math.floor(cssHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${FONT_SIZE}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
      ctx.textBaseline = "top";
      const newCols = Math.ceil(cssWidth / FONT_SIZE);
      if (newCols > cols) {
        for (let i = cols; i < newCols; i++) {
          drops[i] = 0;
          lastRow[i] = -1;
          speeds[i] = randSpeed();
          active[i] = false;
        }
      } else if (newCols < cols) {
        drops.length = newCols;
        lastRow.length = newCols;
        speeds.length = newCols;
        active.length = newCols;
      }
      cols = newCols;
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let raf: number | null = null;

    const draw = () => {
      // Erode existing pixels' alpha. destination-out subtracts alpha instead
      // of painting near-black on top, so trails fade to *fully transparent*
      // (no dim grey "cells" left behind anywhere).
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = `rgba(0,0,0,${FADE})`;
      ctx.fillRect(0, 0, cssWidth, cssHeight);
      ctx.globalCompositeOperation = "source-over";

      for (let i = 0; i < cols; i++) {
        if (!active[i]) {
          // Idle: small chance per frame to start a fresh drop.
          if (Math.random() < ACTIVATION_RATE) {
            active[i] = true;
            drops[i] = 0;
            lastRow[i] = -1;
            speeds[i] = randSpeed();
          }
          continue;
        }

        drops[i] += speeds[i];
        const row = Math.floor(drops[i]);

        if (row !== lastRow[i]) {
          const ch = Math.random() < 0.5 ? "0" : "1";
          const x = i * FONT_SIZE;
          const y = row * FONT_SIZE;
          // All freshly-stamped glyphs spawn bright - the fade alone gives
          // each one a natural head-to-tail brightness ramp.
          ctx.fillStyle = "rgba(230,230,235,0.95)";
          ctx.fillText(ch, x, y);
          lastRow[i] = row;
        }

        // Drop has run off the bottom -> column goes idle until the next roll.
        if (drops[i] * FONT_SIZE > cssHeight + FONT_SIZE) {
          active[i] = false;
        }
      }
      raf = requestAnimationFrame(draw);
    };

    const start = () => {
      if (raf === null && !reduceMotion) raf = requestAnimationFrame(draw);
    };
    const stop = () => {
      if (raf !== null) {
        cancelAnimationFrame(raf);
        raf = null;
      }
    };

    const io = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? start() : stop()),
      { threshold: 0 },
    );
    io.observe(canvas);

    if (reduceMotion) {
      // One static frame so the section still has texture.
      draw();
      if (raf !== null) {
        cancelAnimationFrame(raf);
        raf = null;
      }
    } else {
      start();
    }

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  );
}
