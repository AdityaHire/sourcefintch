"use client";

import { motion, type Variants } from "motion/react";
import {
  Code2,
  Cpu,
  FileCode,
  Sparkles,
  GitBranch,
  Layers,
  ShieldCheck,
  Zap,
  ArrowRight,
  Database,
  Terminal,
  Bug,
  Search,
} from "lucide-react";
import { RuixenGradientFooter } from "./ui/ruixen-gradient-footer";

interface LandingPageContentProps {
  onExplore: () => void;
  onOpenDocs: () => void;
}

export default function LandingPageContent({ onExplore, onOpenDocs }: LandingPageContentProps) {
  // Motion scroll-reveal variants
  const sectionVariants: Variants = {
    hidden: { opacity: 0, y: 32 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  const cardContainerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.1,
      },
    },
  };

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 24, filter: "blur(6px)" },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        duration: 0.7,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  return (
    <div className="relative w-full z-10 flex flex-col font-sans-ui text-zinc-900 dark:text-zinc-100">
      {/* ── 1. CORE CAPABILITIES (Antigravity & NotebookLM style) ──────── */}
      <section className="relative px-6 sm:px-12 py-20 max-w-6xl mx-auto w-full">
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-zinc-200/80 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-4 shadow-2xs backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
            <span>AST-Grounded Code Intelligence</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4">
            Everything you need to understand any codebase in seconds
          </h2>
          <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Sourcefinch parses syntax trees, indexes dense semantic vectors in Qdrant, and synthesizes answers with verifiable file line citations.
          </p>
        </motion.div>

        {/* Feature Grid */}
        <motion.div
          variants={cardContainerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {/* Card 1 */}
          <motion.div
            variants={cardVariants}
            className="group relative rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/60 p-6 backdrop-blur-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all shadow-xs"
          >
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-center text-zinc-800 dark:text-zinc-200 mb-4 group-hover:scale-105 transition-transform">
              <FileCode className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-2">
              Verified File Citations
            </h3>
            <p className="text-xs sm:text-[13px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Every answer comes with clickable citation rows displaying exact start and end line ranges. Click any row to open the full code inspector.
            </p>
          </motion.div>

          {/* Card 2 */}
          <motion.div
            variants={cardVariants}
            className="group relative rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/60 p-6 backdrop-blur-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all shadow-xs"
          >
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-center text-zinc-800 dark:text-zinc-200 mb-4 group-hover:scale-105 transition-transform">
              <Database className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-2">
              Qdrant Vector Intelligence
            </h3>
            <p className="text-xs sm:text-[13px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
              High-dimensional vector embeddings match the semantic intent of your questions directly against relevant AST scopes and function bodies.
            </p>
          </motion.div>

          {/* Card 3 */}
          <motion.div
            variants={cardVariants}
            className="group relative rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/60 p-6 backdrop-blur-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all shadow-xs"
          >
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-center text-zinc-800 dark:text-zinc-200 mb-4 group-hover:scale-105 transition-transform">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-2">
              Architecture & Data Flow
            </h3>
            <p className="text-xs sm:text-[13px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Ask how state management works, map API routes to controllers, or trace data lifecycles across thousands of lines of multi-file repositories.
            </p>
          </motion.div>

          {/* Card 4 */}
          <motion.div
            variants={cardVariants}
            className="group relative rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/60 p-6 backdrop-blur-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all shadow-xs"
          >
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-center text-zinc-800 dark:text-zinc-200 mb-4 group-hover:scale-105 transition-transform">
              <Bug className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-2">
              Bugs & Edge-Case Detection
            </h3>
            <p className="text-xs sm:text-[13px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Identify missing error handling, unhandled edge cases, null pointer dereferences, and potential concurrency hazards across functions.
            </p>
          </motion.div>

          {/* Card 5 */}
          <motion.div
            variants={cardVariants}
            className="group relative rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/60 p-6 backdrop-blur-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all shadow-xs"
          >
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-center text-zinc-800 dark:text-zinc-200 mb-4 group-hover:scale-105 transition-transform">
              <Code2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-2">
              Fullscreen Code Inspector
            </h3>
            <p className="text-xs sm:text-[13px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Inspect full code files in immersive fullscreen mode with exact line gutters, syntax rendering, clipboard copy, and direct GitHub deep-links.
            </p>
          </motion.div>

          {/* Card 6 */}
          <motion.div
            variants={cardVariants}
            className="group relative rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/60 p-6 backdrop-blur-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all shadow-xs"
          >
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-center text-zinc-800 dark:text-zinc-200 mb-4 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-2">
              Zero Hallucinations
            </h3>
            <p className="text-xs sm:text-[13px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Unlike generic LLM chatbots, Sourcefinch strictly constrains answers to your actual indexed repository files with verified syntax grounding.
            </p>
          </motion.div>
        </motion.div>
      </section>

      {/* ── 2. HOW TO USE (3-Step Guided Walkthrough) ───────────────────── */}
      <section className="relative px-6 sm:px-12 py-20 bg-zinc-50/40 dark:bg-zinc-950/40 backdrop-blur-xs">
        <div className="max-w-6xl mx-auto w-full">
          <motion.div
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            className="text-center max-w-2xl mx-auto mb-16"
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-zinc-200/80 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-4 shadow-2xs backdrop-blur-xs">
              <Zap className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
              <span>Simple 3-Step Workflow</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4">
              How to use Sourcefinch
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
              From GitHub URL to complete codebase intelligence in three simple steps.
            </p>
          </motion.div>

          <motion.div
            variants={cardContainerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {/* Step 1 */}
            <motion.div
              variants={cardVariants}
              className="relative flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/70 p-6 backdrop-blur-md shadow-xs"
            >
              <div className="flex items-center justify-between mb-6">
                <span className="font-code text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  Step 01
                </span>
                <span className="h-2 w-2 rounded-full bg-zinc-400 dark:bg-zinc-500" />
              </div>
              <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-center text-zinc-800 dark:text-zinc-200 mb-4">
                <GitBranch className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-2">
                Connect GitHub Repository
              </h3>
              <p className="text-xs sm:text-[13px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Click <strong>Add Repo</strong> in the sidebar, paste any GitHub repository URL (e.g. <code>facebook/react</code>), specify the branch, and click Ingest.
              </p>
            </motion.div>

            {/* Step 2 */}
            <motion.div
              variants={cardVariants}
              className="relative flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/70 p-6 backdrop-blur-md shadow-xs"
            >
              <div className="flex items-center justify-between mb-6">
                <span className="font-code text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  Step 02
                </span>
                <span className="h-2 w-2 rounded-full bg-zinc-400 dark:bg-zinc-500" />
              </div>
              <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-center text-zinc-800 dark:text-zinc-200 mb-4">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-2">
                Automatic AST Ingestion
              </h3>
              <p className="text-xs sm:text-[13px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Our ingestion pipeline parses files into AST nodes, generates high-dimensional embeddings, and indexes them into Qdrant in real-time.
              </p>
            </motion.div>

            {/* Step 3 */}
            <motion.div
              variants={cardVariants}
              className="relative flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/70 p-6 backdrop-blur-md shadow-xs"
            >
              <div className="flex items-center justify-between mb-6">
                <span className="font-code text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  Step 03
                </span>
                <span className="h-2 w-2 rounded-full bg-zinc-400 dark:bg-zinc-500" />
              </div>
              <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-center text-zinc-800 dark:text-zinc-200 mb-4">
                <Search className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-2">
                Ask Questions & Inspect Citations
              </h3>
              <p className="text-xs sm:text-[13px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Ask architectural questions or use starter prompt cards. Click any citation row to inspect verified source code lines in the fullscreen inspector.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── 3. LIVE INTERACTIVE CODEBASE CTA ──────────────────────────── */}
      <section className="relative px-6 sm:px-12 py-20 max-w-4xl mx-auto w-full text-center">
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="relative rounded-3xl border border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 p-8 sm:p-12 shadow-xl backdrop-blur-md overflow-hidden"
        >
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center mx-auto mb-6 shadow-md">
            <Terminal className="w-6 h-6" />
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4">
            Ready to explore your codebase?
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed mb-8">
            Launch the Sourcefinch Workspace to index your repositories and start querying your source code with grounded AI intelligence.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onExplore}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 px-6 py-3 text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all cursor-pointer shadow-md font-sans-ui"
            >
              <span>Open Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onOpenDocs}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 text-zinc-700 dark:text-zinc-300 px-5 py-3 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer shadow-2xs font-sans-ui"
            >
              <span>Read Documentation</span>
            </button>
          </div>
        </motion.div>
      </section>

      {/* ── 4. NOTEBOOKLM-INSPIRED GRADIENT FOOTER ─────────────────────── */}
      <RuixenGradientFooter
        onOpenWorkspace={onExplore}
        onOpenDocs={onOpenDocs}
      />
    </div>
  );
}
