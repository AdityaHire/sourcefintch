import { useState } from 'react';
import type { SourceCitation, Repository } from '../types';
import { Copy, Check, ExternalLink, Code2, X, FileCode } from 'lucide-react';

interface CodeViewerProps {
  citation: SourceCitation | null;
  activeRepo: Repository | null;
  onClose?: () => void;
}

export default function CodeViewer({ citation, activeRepo, onClose }: CodeViewerProps) {
  const [copied, setCopied] = useState(false);

  if (!citation) {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center border-l border-zinc-200/80 dark:border-zinc-800/60 bg-white/40 dark:bg-[#0a0a0c]/50 backdrop-blur-md p-8 text-center select-none font-sans-ui">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer shadow-xs"
          >
            <X className="w-3.5 h-3.5" />
            <span>Back to Chat</span>
          </button>
        )}
        <div className="w-12 h-12 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-center font-code text-base text-zinc-400 dark:text-zinc-500 mb-4 shadow-xs">
          <Code2 className="w-6 h-6 text-zinc-400 dark:text-zinc-500" />
        </div>
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5 font-sans-ui">
          Source Code Inspector
        </h3>
        <p className="max-w-[260px] text-xs leading-relaxed text-zinc-500 font-sans-ui">
          Select any cited source in chat or ask a question to inspect verified repository lines.
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

  const lines = (citation.content || '// No code chunk content available.').split('\n');
  const scorePct = Math.round((citation.score || 0) * 100);

  return (
    <div className="flex h-full w-full flex-col border-l border-zinc-200/80 dark:border-zinc-800/60 bg-white/50 dark:bg-[#0a0a0c]/60 backdrop-blur-md font-sans-ui select-none">
      {/* ── Top Header: File Info & Controls ──────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/50 px-4 py-2.5">
        <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
          <div className="w-6 h-6 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-700 dark:text-zinc-300 shrink-0">
            <FileCode className="w-3.5 h-3.5" />
          </div>
          <div className="truncate min-w-0">
            <div className="text-[13px] font-semibold text-zinc-900 dark:text-white truncate font-code" title={citation.file_path}>
              {citation.file_path}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 font-code">
              <span>Lines {citation.start_line}–{citation.end_line}</span>
              <span className="text-zinc-300 dark:text-zinc-700">·</span>
              <span className="text-zinc-600 dark:text-zinc-400 font-medium">{scorePct}% relevance</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Copy button */}
          <button
            type="button"
            onClick={handleCopyCode}
            className="flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer shadow-2xs font-sans-ui"
            title="Copy code to clipboard"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-zinc-600 dark:text-zinc-300" />
                <span className="text-zinc-600 dark:text-zinc-300">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 text-zinc-400" />
                <span>Copy</span>
              </>
            )}
          </button>

          {/* GitHub permalink */}
          {repoUrl && (
            <a
              href={githubLink}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs font-sans-ui"
              title="Open permalink on GitHub"
            >
              <span>GitHub</span>
              <ExternalLink className="w-2.5 h-2.5 text-zinc-400" />
            </a>
          )}

          {/* Exit Fullscreen / Close button */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 px-2.5 py-1 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all cursor-pointer shadow-xs ml-1 font-sans-ui"
              title="Back to conversation"
            >
              <X className="w-3.5 h-3.5" />
              <span>Back to Chat</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Line-Numbered Code Inspector ─────────────────────────────────── */}
      <div className="flex-1 overflow-auto bg-white/40 dark:bg-transparent p-0 font-code text-[12.5px] select-text">
        <div className="table w-full border-collapse">
          {lines.map((lineText, idx) => {
            const currentLineNumber = (citation.start_line || 1) + idx;
            return (
              <div
                key={idx}
                className="table-row group hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
              >
                {/* Line number gutter */}
                <span className="table-cell select-none pr-3 text-right text-zinc-400 dark:text-zinc-600 group-hover:text-zinc-600 dark:group-hover:text-zinc-400 w-12 py-0.5 pl-4 border-r border-zinc-100 dark:border-zinc-800/80 leading-5 bg-zinc-50/20 dark:bg-transparent">
                  {currentLineNumber}
                </span>

                {/* Line code text */}
                <span className="table-cell pl-4 text-zinc-800 dark:text-zinc-200 whitespace-pre py-0.5 leading-5 font-code">
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
