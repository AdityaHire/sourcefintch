"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";


interface ThinkingToolProps {
  isThinking: boolean;
  className?: string;
}

const THINKING_STAGES = [
  "Connecting to repository graph...",
  "Analyzing semantic AST code chunks...",
  "Querying vector embeddings & rankings...",
  "Synthesizing verified response with citations...",
];

export function ThinkingTool({
  isThinking,
  className,
}: ThinkingToolProps) {
  const [elapsed, setElapsed] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (!isThinking) return;

    setElapsed(0);
    setStageIndex(0);
    const startTime = performance.now();

    const interval = setInterval(() => {
      const seconds = (performance.now() - startTime) / 1000;
      setElapsed(Number(seconds.toFixed(1)));

      if (seconds > 6.5) {
        setStageIndex(3);
      } else if (seconds > 3.8) {
        setStageIndex(2);
      } else if (seconds > 1.4) {
        setStageIndex(1);
      } else {
        setStageIndex(0);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [isThinking]);

  if (!isThinking) return null;

  return (
    <div
      className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-zinc-300/70 dark:border-zinc-700/70 bg-zinc-100/70 dark:bg-zinc-900/70 backdrop-blur-xs font-sans-ui text-xs transition-all duration-300 shadow-xs ${
        className || ""
      }`}
    >
      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-700 dark:text-zinc-300" />

      <div className="flex items-center gap-1.5 font-medium text-zinc-700 dark:text-zinc-200">
        <span className="transition-all duration-300">
          {THINKING_STAGES[stageIndex]}
        </span>
      </div>

      <span className="rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[10.5px] font-code font-semibold px-2 py-0.5 text-zinc-500 dark:text-zinc-400 shrink-0">
        {elapsed}s
      </span>
    </div>
  );
}

export default ThinkingTool;
