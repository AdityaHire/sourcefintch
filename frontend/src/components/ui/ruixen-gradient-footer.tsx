"use client";

import { FolderGit2, BookOpen, ExternalLink, Heart } from "lucide-react";

interface RuixenFooterProps {
  onOpenWorkspace?: () => void;
  onOpenDocs?: () => void;
}

export function RuixenGradientFooter({ onOpenWorkspace, onOpenDocs }: RuixenFooterProps) {
  return (
    <footer className="relative w-full overflow-hidden bg-transparent pt-16 pb-12 font-sans-ui z-20">
      {/* ── The Dia / NotebookLM Aurora Mesh Floor Gradient (Inline SVG) ── */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none -z-10 flex justify-center overflow-hidden h-[340px] opacity-40 dark:opacity-50 select-none">
        <svg
          className="w-full min-w-[1000px] max-w-[1600px] h-full object-cover transform translate-y-12"
          viewBox="0 0 1200 400"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g filter="url(#dia-blur)">
            <path
              d="M100 360 C300 240, 450 380, 600 300 C750 220, 900 340, 1100 260 L1100 400 L100 400 Z"
              fill="url(#teal-grad)"
              fillOpacity="0.75"
            />
            <path
              d="M0 380 C250 280, 500 360, 700 290 C900 220, 1050 330, 1200 270 L1200 400 L0 400 Z"
              fill="url(#indigo-grad)"
              fillOpacity="0.65"
            />
            <path
              d="M150 390 C350 320, 550 390, 750 330 C950 270, 1050 360, 1200 320 L1200 400 L150 400 Z"
              fill="url(#violet-grad)"
              fillOpacity="0.55"
            />
            <circle cx="600" cy="340" r="180" fill="url(#cyan-glow)" fillOpacity="0.5" />
          </g>

          <defs>
            <filter id="dia-blur" x="-20%" y="-20%" width="140%" height="140%" filterUnits="userSpaceOnUse">
              <feGaussianBlur stdDeviation="65" />
            </filter>

            <linearGradient id="teal-grad" x1="100" y1="300" x2="1100" y2="300" gradientUnits="userSpaceOnUse">
              <stop stopColor="#10B981" />
              <stop offset="0.5" stopColor="#14B8A6" />
              <stop offset="1" stopColor="#06B6D4" />
            </linearGradient>

            <linearGradient id="indigo-grad" x1="0" y1="300" x2="1200" y2="300" gradientUnits="userSpaceOnUse">
              <stop stopColor="#06B6D4" />
              <stop offset="0.5" stopColor="#6366F1" />
              <stop offset="1" stopColor="#8B5CF6" />
            </linearGradient>

            <linearGradient id="violet-grad" x1="150" y1="350" x2="1200" y2="350" gradientUnits="userSpaceOnUse">
              <stop stopColor="#8B5CF6" />
              <stop offset="0.5" stopColor="#A855F7" />
              <stop offset="1" stopColor="#EC4899" />
            </linearGradient>

            <radialGradient id="cyan-glow" cx="0.5" cy="0.5" r="0.5" fx="0.5" fy="0.5">
              <stop stopColor="#38BDF8" />
              <stop offset="1" stopColor="#6366F1" stopOpacity="0" />
            </radialGradient>
          </defs>
        </svg>
      </div>

      {/* ── Footer Grid ─────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 sm:px-12">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10 pb-12 border-b border-zinc-200/50 dark:border-zinc-800/60">
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center text-white shadow-xs">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white font-sans-ui">
                Sourcefinch
              </span>
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm leading-relaxed font-sans-ui">
              Your AI-powered research and thinking partner for software architecture, grounded in repositories with dense AST embeddings and Qdrant vector retrieval.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://github.com/AdityaHire/sourcefintch"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 bg-white/60 dark:bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-900 dark:hover:text-white transition-all shadow-2xs backdrop-blur-xs"
              >
                <FolderGit2 className="w-3.5 h-3.5" />
                <span>GitHub</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-60 ml-0.5" />
              </a>

              <button
                type="button"
                onClick={onOpenDocs}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 bg-white/60 dark:bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-900 dark:hover:text-white transition-all shadow-2xs backdrop-blur-xs cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Documentation</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-200">
              Product
            </h4>
            <ul className="space-y-2 text-xs text-zinc-500 dark:text-zinc-400">
              <li>
                <button
                  type="button"
                  onClick={onOpenWorkspace}
                  className="hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Workspace IDE
                </button>
              </li>
              <li>
                <span className="hover:text-zinc-900 dark:hover:text-white transition-colors">
                  AST Chunking
                </span>
              </li>
              <li>
                <span className="hover:text-zinc-900 dark:hover:text-white transition-colors">
                  Qdrant Vectors
                </span>
              </li>
              <li>
                <span className="hover:text-zinc-900 dark:hover:text-white transition-colors">
                  Grounded Permalinks
                </span>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-200">
              Architecture
            </h4>
            <ul className="space-y-2 text-xs text-zinc-500 dark:text-zinc-400">
              <li>
                <span className="hover:text-zinc-900 dark:hover:text-white transition-colors">
                  Tree-sitter Parser
                </span>
              </li>
              <li>
                <span className="hover:text-zinc-900 dark:hover:text-white transition-colors">
                  FastAPI AI Engine
                </span>
              </li>
              <li>
                <span className="hover:text-zinc-900 dark:hover:text-white transition-colors">
                  Express Ingestion API
                </span>
              </li>
              <li>
                <span className="hover:text-zinc-900 dark:hover:text-white transition-colors">
                  Prisma / MySQL Store
                </span>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-200">
              Resources
            </h4>
            <ul className="space-y-2 text-xs text-zinc-500 dark:text-zinc-400">
              <li>
                <button
                  type="button"
                  onClick={onOpenDocs}
                  className="hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Quickstart Guide
                </button>
              </li>
              <li>
                <a
                  href="https://github.com/AdityaHire/sourcefintch"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  Source Repository
                </a>
              </li>
              <li>
                <a
                  href="https://qdrant.tech"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  Qdrant Vector DB
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 dark:text-zinc-500 font-sans-ui">
          <div className="flex items-center gap-1.5">
            <span>© {new Date().getFullYear()} Sourcefinch. Built with</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 inline fill-rose-500" />
            <span>for intelligent code research.</span>
          </div>

          <div className="flex items-center gap-4 text-zinc-500">
            <span className="hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors">
              Privacy Policy
            </span>
            <span>·</span>
            <span className="hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors">
              Terms of Service
            </span>
            <span>·</span>
            <span className="hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors">
              Security
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
