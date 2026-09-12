import { motion, type Variants } from 'motion/react';
import { haptics } from '../lib/applePhysics';

interface CinematicLandingHeroProps {
  onExplore: () => void;
}

export default function CinematicLandingHero({ onExplore }: CinematicLandingHeroProps) {
  // Deliberate, graceful cinematic reveal
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.15,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 24, filter: 'blur(10px)' },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: {
        duration: 0.9,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="relative z-10 h-[calc(100vh-4rem)] min-h-[580px] flex flex-col items-center justify-center px-6 sm:px-12 py-8 max-w-5xl mx-auto text-center font-sans-ui shrink-0 select-none"
    >
      {/* ── 1. Atmospheric Ambient Spotlight (Calm Breathing Glow) ───────── */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[450px] sm:w-[650px] h-[300px] bg-gradient-to-tr from-emerald-500/15 via-teal-500/15 to-indigo-500/15 dark:from-emerald-500/20 dark:via-cyan-500/20 dark:to-indigo-500/20 blur-[120px] rounded-full pointer-events-none -z-10 animate-subtle-pulse" />

      {/* ── 2. Big Bold Headline with Apple Optical Typography ───────────── */}
      <motion.h1
        variants={itemVariants}
        className="text-5xl sm:text-7xl md:text-8xl font-bold apple-display text-zinc-900 dark:text-white leading-[1.04] mb-6 select-none whitespace-nowrap"
      >
        Understand{' '}
        <span className="bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500 bg-clip-text text-transparent">
          Codebase
        </span>
      </motion.h1>

      {/* ── 3. Subtitle with Comfortable Leading & Apple Body Tracking ──── */}
      <motion.p
        variants={itemVariants}
        className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl leading-relaxed mb-9 font-normal apple-body"
      >
        Your research and thinking partner, grounded in the repositories that<br className="hidden sm:block" /> you trust, built with dense AST embeddings and RAG intelligence.
      </motion.p>

      {/* ── 4. Cinematic Glowing Primary CTA with Specular Highlight ─────── */}
      <motion.div
        variants={itemVariants}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className="relative group"
      >
        {/* Ambient button glow aura */}
        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-emerald-500/30 via-teal-500/30 to-indigo-500/30 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        <button
          type="button"
          onClick={() => {
            haptics.trigger('medium');
            onExplore();
          }}
          className="relative overflow-hidden rounded-2xl border-t border-t-white/30 dark:border-t-white/60 bg-black dark:bg-white text-white dark:text-black px-10 py-4 text-[15px] sm:text-base font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all cursor-pointer shadow-lg hover:shadow-xl font-sans-ui flex items-center justify-center tracking-tight active:scale-95"
        >
          {/* Shimmer sweep line */}
          <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 dark:via-black/10 to-transparent" />

          <span>Try Sourcefinch</span>
        </button>
      </motion.div>
    </motion.div>
  );
}
