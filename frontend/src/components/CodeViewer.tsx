import { useState } from 'react';
import type { SourceCitation, Repository } from '../types';

interface CodeViewerProps {
  citation: SourceCitation | null;
  activeRepo: Repository | null;
  onClose?: () => void;
}

export default function CodeViewer({ citation, activeRepo, onClose }: CodeViewerProps) {
  const [copied, setCopied] = useState(false);

  if (!citation) {
    return (
      <div className="flex h-full flex-col items-center justify-center border-l border-white/[0.08] bg-zinc-950/80 p-8 text-center backdrop-blur-xl">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.02] text-zinc-500 mb-4 shadow-inner">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-1">Code Viewer</h3>
        <p className="max-w-xs text-xs leading-relaxed text-zinc-500">
          Click any citation chip in the conversation to inspect its exact source chunk, line numbers, and GitHub link.
        </p>
      </div>
    );
  }

  // Construct GitHub line-range permalink
  const repoUrl = activeRepo?.github_url?.replace(/\/$/, '') || '';
  const branch = activeRepo?.branch || 'main';
  const cleanFilePath = citation.file_path.replace(/^\//, '');
  const githubLink = `${repoUrl}/blob/${branch}/${cleanFilePath}#L${citation.start_line}-L${citation.end_line}`;

  const handleCopyCode = async () => {
    if (!citation.content) return;
    try {
      await navigator.clipboard.writeText(citation.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const lines = (citation.content || '// No chunk content available.').split('\n');
  const scorePct = Math.round((citation.score || 0) * 100);

  return (
    <div className="flex h-full flex-col border-l border-white/[0.08] bg-zinc-950/95 backdrop-blur-xl">
      {/* ── Top Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-white/[0.08] bg-zinc-900/60 px-4 py-3">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="truncate">
            <div className="text-xs font-semibold text-white truncate font-mono" title={citation.file_path}>
              {citation.file_path}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono">
              <span>Lines {citation.start_line}–{citation.end_line}</span>
              <span>·</span>
              <span className="text-violet-300 font-medium">{scorePct}% match</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.08] hover:text-white transition-all cursor-pointer"
              title="Close viewer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Action Toolbar ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-black/40 px-4 py-2 text-xs">
        <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
          Source Chunk Preview
        </span>

        <div className="flex items-center gap-2">
          {/* Copy button */}
          <button
            type="button"
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:bg-white/[0.08] hover:text-white transition-all cursor-pointer"
          >
            {copied ? (
              <>
                <svg className="h-3.5 w-3.5 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Copy</span>
              </>
            )}
          </button>

          {/* Open on GitHub link */}
          {repoUrl && (
            <a
              href={githubLink}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-medium text-indigo-300 hover:bg-indigo-500/20 hover:text-indigo-200 transition-all"
              title={githubLink}
            >
              <span>GitHub</span>
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>
      </div>

      {/* ── Line-Numbered Code Area ───────────────────────────────────────── */}
      <div className="flex-1 overflow-auto bg-zinc-950 p-4 font-mono text-xs">
        <div className="table w-full border-collapse">
          {lines.map((lineText, idx) => {
            const currentLineNumber = (citation.start_line || 1) + idx;
            return (
              <div
                key={idx}
                className="table-row group hover:bg-white/[0.04] transition-colors"
              >
                {/* Line number gutter */}
                <span className="table-cell select-none pr-4 text-right text-zinc-600 group-hover:text-zinc-400 w-10 py-0.5 border-r border-white/[0.06]">
                  {currentLineNumber}
                </span>

                {/* Line code text */}
                <span className="table-cell pl-4 text-zinc-200 whitespace-pre py-0.5 leading-relaxed font-mono">
                  {lineText || ' '}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
