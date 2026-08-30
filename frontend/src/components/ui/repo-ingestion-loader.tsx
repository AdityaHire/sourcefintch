"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { Loader2 } from "lucide-react";

interface RepoIngestionLoaderProps {
  repoName: string;
  statusText?: string;
  onComplete?: () => void;
}

export function RepoIngestionLoader({
  repoName,
  statusText = "Analyzing code structure...",
}: RepoIngestionLoaderProps) {
  const displayRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Parse clean repository display name (e.g., owner / repo)
  const cleanRepoName = repoName
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/\/$/, "");

  // Format concise status without exposing raw internal implementation jargon
  const conciseStatus = statusText.includes("Current status:")
    ? statusText.replace(/Current status:\s*/i, "Status: ")
    : statusText.includes("Indexing started")
    ? "Building code index..."
    : statusText.includes("Initiating")
    ? "Connecting repository..."
    : statusText || "Analyzing code structure...";

  useEffect(() => {
    const display = displayRef.current;
    const bar = barRef.current;
    const counter = { val: 0 };

    // Fast, crisp entrance
    if (modalRef.current) {
      gsap.fromTo(
        modalRef.current,
        { scale: 0.98, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.18, ease: "power2.out" }
      );
    }

    const tween = gsap.to(counter, {
      val: 100,
      duration: 2.5,
      ease: "power2.inOut",
      onUpdate: () => {
        if (display) {
          display.textContent = Math.round(counter.val) + "%";
        }
        if (bar) {
          bar.style.width = counter.val + "%";
        }
      },
    });

    return () => {
      tween.kill();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4 font-sans-ui select-none">
      <div
        ref={modalRef}
        className="w-full max-w-[420px] rounded-2xl border border-zinc-200/90 dark:border-white/10 bg-white dark:bg-[#0A0A0B] p-5 sm:p-6 shadow-xl text-left"
      >
        {/* ── 1. Header: Title + Tiny Spinner + Repo Name ────────────────── */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-white font-sans-ui">
                Indexing repository
              </h3>
            </div>
            {/* Real-time Percentage Indicator */}
            <span
              ref={displayRef}
              className="text-xs font-code font-semibold text-zinc-700 dark:text-zinc-300"
            >
              0%
            </span>
          </div>

          <p className="mt-1 text-[12.5px] text-zinc-500 dark:text-zinc-400 font-code truncate">
            {cleanRepoName || "Repository"}
          </p>
        </div>

        {/* ── 2. Compact 3px Progress Bar ───────────────────────────────── */}
        <div className="relative w-full h-[3px] rounded-full bg-zinc-100 dark:bg-zinc-800/80 overflow-hidden mb-3.5">
          <div
            ref={barRef}
            className="h-full rounded-full bg-gradient-to-r from-zinc-600 via-zinc-800 to-zinc-950 dark:from-zinc-400 dark:via-zinc-200 dark:to-white transition-all duration-75"
            style={{ width: "0%" }}
          />
        </div>

        {/* ── 3. Single Concise Status Line ──────────────────────────────── */}
        <div className="flex items-center justify-between text-[12px] text-zinc-500 dark:text-zinc-400 font-sans-ui">
          <span className="truncate">{conciseStatus}</span>
          <span className="text-[11px] text-zinc-400 dark:text-zinc-600 font-code shrink-0 ml-2">
            AST Ingestion
          </span>
        </div>
      </div>
    </div>
  );
}
