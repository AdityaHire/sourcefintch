import { useState } from 'react';
import type { SourceCitation, Repository, RepositoryFile } from '../types';
import {
  Copy,
  Check,
  ExternalLink,
  Code2,
  X,
  FileCode,
  Sparkles,
  Lightbulb,
  Search,
  ShieldAlert,
  TestTube,
  ArrowRight,
} from 'lucide-react';

interface CodeViewerProps {
  citation?: SourceCitation | null;
  activeFile?: RepositoryFile | null;
  activeRepo: Repository | null;
  onClose?: () => void;
  onAskAI?: (prompt: string, autoSend?: boolean) => void;
}

export default function CodeViewer({
  citation: rawCitation,
  activeFile,
  activeRepo,
  onClose,
  onAskAI,
}: CodeViewerProps) {
  const [copied, setCopied] = useState(false);
  const [selectedRange, setSelectedRange] = useState<[number, number] | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');

  const citation: SourceCitation | null =
    rawCitation ||
    (activeFile
      ? {
          file_path: activeFile.file_path,
          start_line: 1,
          end_line: activeFile.content ? activeFile.content.split('\n').length : 1,
          content: activeFile.content || '// Empty file',
          score: 1,
        }
      : null);

  if (!citation) {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center border-l border-zinc-200/80 dark:border-zinc-800/60 bg-white/40 dark:bg-zinc-950/50 backdrop-blur-md p-8 text-center select-none font-sans-ui">
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

  // Active line boundaries (selected range or citation defaults)
  const activeStartLine = selectedRange ? selectedRange[0] : (citation.start_line || 1);
  const activeEndLine = selectedRange ? selectedRange[1] : (citation.end_line || activeStartLine);
  const hasCustomSelection = Boolean(selectedRange);

  // Construct GitHub line-range permalink
  const repoUrl = activeRepo?.github_url?.replace(/\/$/, '') || '';
  const branch = activeRepo?.branch || 'main';
  const cleanFilePath = citation.file_path.replace(/^\//, '');
  const githubLink = `${repoUrl}/blob/${branch}/${cleanFilePath}#L${activeStartLine}-L${activeEndLine}`;

  const handleCopyCode = async () => {
    if (!citation.content) return;
    try {
      if (selectedRange) {
        const allLines = citation.content.split('\n');
        const offset = citation.start_line || 1;
        const startIndex = Math.max(0, selectedRange[0] - offset);
        const endIndex = Math.min(allLines.length - 1, selectedRange[1] - offset);
        const snippet = allLines.slice(startIndex, endIndex + 1).join('\n');
        await navigator.clipboard.writeText(snippet);
      } else {
        await navigator.clipboard.writeText(citation.content);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleLineClick = (lineNum: number, e: React.MouseEvent) => {
    if (e.shiftKey && selectedRange) {
      const start = Math.min(selectedRange[0], lineNum);
      const end = Math.max(selectedRange[1], lineNum);
      setSelectedRange([start, end]);
    } else if (selectedRange && selectedRange[0] === lineNum && selectedRange[1] === lineNum) {
      setSelectedRange(null);
    } else {
      setSelectedRange([lineNum, lineNum]);
    }
  };

  // AI Prompt Builders
  const targetLabel = hasCustomSelection
    ? `lines ${activeStartLine}–${activeEndLine} of "${citation.file_path}"`
    : `"${citation.file_path}" (lines ${activeStartLine}–${activeEndLine})`;

  const triggerExplain = () => {
    onAskAI?.(
      hasCustomSelection
        ? `Explain what lines ${activeStartLine}–${activeEndLine} of "${citation.file_path}" do. Explain the logic, inputs/outputs, and how edge cases are handled in this section.`
        : `Explain the architecture and implementation of "${citation.file_path}". What are its core functions, exported symbols, and role in this project?`
    );
  };

  const triggerFindUsages = () => {
    onAskAI?.(
      `Find where "${citation.file_path}" or the functions and exports defined in it are imported, invoked, or referenced across this repository.`
    );
  };

  const triggerAudit = () => {
    onAskAI?.(
      `Audit ${targetLabel} for potential bugs, security vulnerabilities, unhandled error cases, race conditions, or performance optimizations.`
    );
  };

  const triggerTests = () => {
    onAskAI?.(
      `Generate comprehensive unit test suites for ${targetLabel}. Include happy path, boundary conditions, and error cases.`
    );
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPrompt.trim()) return;
    onAskAI?.(`Regarding ${targetLabel}: ${customPrompt.trim()}`);
    setCustomPrompt('');
  };

  const lines = (citation.content || '// No code chunk content available.').split('\n');
  const scorePct = Math.round((citation.score || 0) * 100);

  return (
    <div className="flex h-full w-full flex-col border-l border-zinc-200/80 dark:border-zinc-800/60 bg-white/50 dark:bg-zinc-950/60 backdrop-blur-md font-sans-ui select-none">
      {/* ── Top Header: File Info & Primary Controls ──────────────────────── */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/50 px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
          <div className="w-6 h-6 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-700 dark:text-zinc-300 shrink-0">
            <FileCode className="w-3.5 h-3.5" />
          </div>
          <div className="truncate min-w-0">
            <div
              className="text-[13px] font-semibold text-zinc-900 dark:text-white truncate font-code"
              title={citation.file_path}
            >
              {citation.file_path}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 font-code">
              <span>
                Lines {citation.start_line}–{citation.end_line}
              </span>
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
            title={selectedRange ? 'Copy selected lines to clipboard' : 'Copy code to clipboard'}
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-500 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 text-zinc-400" />
                <span>{selectedRange ? 'Copy Selection' : 'Copy'}</span>
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

          {/* Exit / Close button */}
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

      {/* ── AI Quick Actions Bar ──────────────────────────────────────────── */}
      {onAskAI && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/90 dark:border-zinc-800/90 bg-gradient-to-r from-purple-50/50 via-zinc-50/80 to-indigo-50/50 dark:from-purple-950/20 dark:via-zinc-900/60 dark:to-indigo-950/20 px-4 py-2 shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400 mr-1 select-none">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI</span>
            </span>

            {/* Selection indicator pill */}
            {hasCustomSelection && (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100/80 dark:bg-purple-900/40 text-[11px] font-code text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 mr-1">
                <span>
                  L{activeStartLine}–L{activeEndLine}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedRange(null)}
                  className="hover:text-purple-900 dark:hover:text-purple-100 cursor-pointer font-sans"
                  title="Clear line selection"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            )}

            {/* Action 1: Explain Code */}
            <button
              type="button"
              onClick={triggerExplain}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white dark:bg-zinc-800/90 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:border-amber-400 dark:hover:border-amber-500/60 hover:bg-amber-50/40 dark:hover:bg-amber-950/20 hover:text-amber-700 dark:hover:text-amber-300 transition-all cursor-pointer shadow-2xs"
              title="Ask AI to explain this code snippet and its architecture"
            >
              <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>{hasCustomSelection ? 'Explain Selection' : 'Explain File'}</span>
            </button>

            {/* Action 2: Find Usages */}
            <button
              type="button"
              onClick={triggerFindUsages}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white dark:bg-zinc-800/90 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:border-blue-400 dark:hover:border-blue-500/60 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 hover:text-blue-700 dark:hover:text-blue-300 transition-all cursor-pointer shadow-2xs"
              title="Search codebase for calls and imports of this file"
            >
              <Search className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>Find Usages</span>
            </button>

            {/* Action 3: Audit & Review */}
            <button
              type="button"
              onClick={triggerAudit}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white dark:bg-zinc-800/90 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:border-emerald-400 dark:hover:border-emerald-500/60 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 hover:text-emerald-700 dark:hover:text-emerald-300 transition-all cursor-pointer shadow-2xs"
              title="Scan code for potential bugs, edge cases, and security vulnerabilities"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Audit Code</span>
            </button>

            {/* Action 4: Write Tests */}
            <button
              type="button"
              onClick={triggerTests}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white dark:bg-zinc-800/90 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:border-violet-400 dark:hover:border-violet-500/60 hover:bg-violet-50/40 dark:hover:bg-violet-950/20 hover:text-violet-700 dark:hover:text-violet-300 transition-all cursor-pointer shadow-2xs"
              title="Generate unit test suite for this file or selected lines"
            >
              <TestTube className="w-3.5 h-3.5 text-violet-500 shrink-0" />
              <span>Write Tests</span>
            </button>
          </div>

          {/* Quick inline prompt form */}
          <form
            onSubmit={handleCustomSubmit}
            className="flex items-center gap-1.5 min-w-[200px] max-w-xs flex-1 sm:flex-initial"
          >
            <div className="relative w-full">
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder={
                  hasCustomSelection
                    ? `Ask about lines ${activeStartLine}–${activeEndLine}...`
                    : 'Ask anything about this code...'
                }
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 px-2.5 py-1 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 shadow-2xs font-sans-ui pr-7"
              />
              {customPrompt.trim() && (
                <button
                  type="submit"
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded text-purple-600 hover:text-purple-700 dark:text-purple-400 cursor-pointer"
                  title="Submit prompt to chat"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* ── Line-Numbered Code Inspector ─────────────────────────────────── */}
      <div className="flex-1 overflow-auto bg-white/40 dark:bg-transparent p-0 font-code text-[12.5px] select-text">
        <div className="table w-full border-collapse">
          {lines.map((lineText, idx) => {
            const currentLineNumber = (citation.start_line || 1) + idx;
            const isLineSelected =
              selectedRange &&
              currentLineNumber >= selectedRange[0] &&
              currentLineNumber <= selectedRange[1];

            return (
              <div
                key={idx}
                className={`table-row transition-colors ${
                  isLineSelected
                    ? 'bg-purple-500/10 dark:bg-purple-500/15'
                    : 'hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30'
                }`}
              >
                {/* Line number gutter with click-to-select */}
                <span
                  onClick={(e) => handleLineClick(currentLineNumber, e)}
                  title="Click to select line, Shift+click for range"
                  className={`table-cell select-none pr-3 text-right w-12 py-0.5 pl-4 border-r leading-5 cursor-pointer transition-colors ${
                    isLineSelected
                      ? 'border-purple-400 dark:border-purple-500 text-purple-600 dark:text-purple-400 font-bold bg-purple-500/15 dark:bg-purple-500/20'
                      : 'border-zinc-100 dark:border-zinc-800/80 text-zinc-400 dark:text-zinc-600 hover:text-zinc-800 dark:hover:text-zinc-300 bg-zinc-50/20 dark:bg-transparent'
                  }`}
                >
                  {currentLineNumber}
                </span>

                {/* Line code content */}
                <span
                  className={`table-cell pl-4 whitespace-pre py-0.5 leading-5 font-code ${
                    isLineSelected
                      ? 'text-zinc-950 dark:text-white font-medium'
                      : 'text-zinc-800 dark:text-zinc-200'
                  }`}
                >
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
