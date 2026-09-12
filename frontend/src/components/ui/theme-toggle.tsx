"use client";

import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { appleSprings, haptics } from "@/lib/applePhysics";

interface ThemeToggleProps {
  className?: string;
  isDark?: boolean;
  onToggle?: (isDark: boolean) => void;
}

export function ThemeToggle({ className, isDark: controlledIsDark, onToggle }: ThemeToggleProps) {
  const [internalDark, setInternalDark] = useState(false);

  const isDark = controlledIsDark !== undefined ? controlledIsDark : internalDark;

  useEffect(() => {
    if (controlledIsDark === undefined) {
      const isDocDark = document.documentElement.classList.contains("dark");
      setInternalDark(isDocDark);
    }
  }, [controlledIsDark]);

  const handleToggle = () => {
    const nextVal = !isDark;
    haptics.trigger('toggle');
    if (controlledIsDark === undefined) {
      setInternalDark(nextVal);
      if (nextVal) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
    if (onToggle) {
      onToggle(nextVal);
    }
  };

  return (
    <button
      type="button"
      className={cn(
        "relative flex w-14 h-7 p-0.5 rounded-full cursor-pointer select-none items-center",
        "transition-colors duration-200 border",
        "active:scale-95 transition-transform",
        isDark 
          ? "bg-zinc-900 border-white/[0.12] shadow-inner" 
          : "bg-zinc-200/90 border-zinc-300/80 shadow-inner",
        className
      )}
      onClick={handleToggle}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      role="switch"
      aria-checked={isDark}
    >
      {/* Background Icons */}
      <div className="absolute inset-0 px-1.5 flex items-center justify-between pointer-events-none text-zinc-400">
        <Sun className={cn("w-3 h-3 transition-opacity", isDark ? "opacity-30" : "opacity-0")} />
        <Moon className={cn("w-3 h-3 transition-opacity", isDark ? "opacity-0" : "opacity-30")} />
      </div>

      {/* Spring-Driven Thumb */}
      <motion.div
        className={cn(
          "relative z-10 flex justify-center items-center w-6 h-6 rounded-full shadow-md",
          "border-t border-t-white/60",
          isDark 
            ? "bg-white text-zinc-950 shadow-black/40" 
            : "bg-white text-zinc-800 shadow-zinc-400/40"
        )}
        animate={{
          x: isDark ? 28 : 0,
        }}
        transition={appleSprings.switch}
      >
        {isDark ? (
          <Moon className="w-3.5 h-3.5 text-zinc-950 fill-zinc-950" />
        ) : (
          <Sun className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
        )}
      </motion.div>
    </button>
  );
}
