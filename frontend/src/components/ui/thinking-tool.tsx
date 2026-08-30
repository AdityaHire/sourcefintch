"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

interface ThinkingToolProps {
  isThinking: boolean;
  className?: string;
  defaultExpanded?: boolean;
  steps?: string[];
}

export function ThinkingTool({
  isThinking,
  className,
}: ThinkingToolProps) {
  const [elapsed, setElapsed] = useState(0);
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    if (!isThinking) return;

    setElapsed(0);
    const startTime = performance.now();

    const interval = setInterval(() => {
      const seconds = (performance.now() - startTime) / 1000;
      setElapsed(Number(seconds.toFixed(1)));
      setDotCount((prev) => (prev % 3) + 1);
    }, 400);

    return () => clearInterval(interval);
  }, [isThinking]);

  if (!isThinking) return null;

  return (
    <div className={`flex items-center gap-2.5 py-1 font-sans-ui ${className || ""}`}>
      <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400 dark:text-zinc-500" />
      <span className="text-[13px] text-zinc-500 dark:text-zinc-400">
        Thinking{".".repeat(dotCount)}
      </span>
      <span className="text-[11px] font-code text-zinc-400 dark:text-zinc-600">
        {elapsed}s
      </span>
    </div>
  );
}
