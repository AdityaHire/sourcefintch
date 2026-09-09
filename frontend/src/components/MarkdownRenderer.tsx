import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { marked, type Token, type Tokens } from 'marked';
import { Copy, Check, FileCode, Terminal } from 'lucide-react';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markup'; // HTML/XML

interface MarkdownRendererProps {
  content: string;
  className?: string;
  onOpenCode?: (filePath: string, startLine?: number, endLine?: number) => void;
  /** Whether to animate this message with a smooth staggered fade-rise animation */
  animate?: boolean;
  onTypingComplete?: () => void;
  isStreaming?: boolean;
}

function highlightCode(code: string, language?: string): string {
  if (!code) return '';
  const lang = (language || '').toLowerCase().trim();
  const langMap: Record<string, string> = {
    js: 'javascript',
    javascript: 'javascript',
    ts: 'typescript',
    typescript: 'typescript',
    jsx: 'jsx',
    tsx: 'tsx',
    py: 'python',
    python: 'python',
    json: 'json',
    sh: 'bash',
    bash: 'bash',
    shell: 'bash',
    zsh: 'bash',
    sql: 'sql',
    html: 'markup',
    xml: 'markup',
    svg: 'markup',
    css: 'css',
    md: 'markdown',
    markdown: 'markdown',
    yaml: 'yaml',
    yml: 'yaml',
  };
  const grammarName = langMap[lang] || lang;
  const grammar = Prism.languages[grammarName];
  if (grammar) {
    try {
      return Prism.highlight(code, grammar, grammarName);
    } catch {
      return escapeHtml(code);
    }
  }
  return escapeHtml(code);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const highlightedHtml = useMemo(() => {
    return highlightCode(code, language);
  }, [code, language]);

  const displayLanguage = language ? language.toUpperCase() : 'CODE';

  return (
    <div className="my-3.5 rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-[#0d1117] dark:bg-[#090d16] text-zinc-100 overflow-hidden text-xs shadow-md">
      {/* Code Header (Claude / ChatGPT / Replit style) */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-[#161b22]/90 dark:bg-[#0e131f] px-4 py-2 font-code text-[11px] text-zinc-400">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-zinc-400" />
          <span className="font-semibold tracking-wider text-zinc-300">{displayLanguage}</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[11.5px] px-2.5 py-1 rounded-md bg-zinc-800/60 hover:bg-zinc-700/80 text-zinc-300 hover:text-white transition-all cursor-pointer font-sans-ui"
          title="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 text-zinc-400" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto font-code text-zinc-200 leading-relaxed text-[12.5px] sm:text-[13px]">
        <code
          className={`language-${language || 'text'}`}
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      </pre>
    </div>
  );
}

function renderInlineTokens(
  tokens: Token[] | undefined,
  onOpenCode?: (filePath: string, startLine?: number, endLine?: number) => void
): React.ReactNode {
  if (!tokens || tokens.length === 0) return null;

  return tokens.map((token, idx) => {
    switch (token.type) {
      case 'strong': {
        const t = token as Tokens.Strong;
        return (
          <strong key={idx} className="font-semibold text-zinc-950 dark:text-white">
            {renderInlineTokens(t.tokens, onOpenCode)}
          </strong>
        );
      }
      case 'em': {
        const t = token as Tokens.Em;
        return (
          <em key={idx} className="italic text-zinc-800 dark:text-zinc-300">
            {renderInlineTokens(t.tokens, onOpenCode)}
          </em>
        );
      }
      case 'codespan': {
        const t = token as Tokens.Codespan;
        // Match citation pattern: path/to/file.ext:start-end
        const match = t.text.match(/^([\w./\-]+):(\d+)(?:[–-](\d+))?$/);
        if (match && onOpenCode) {
          const [, filePath, start, end] = match;
          const startNum = parseInt(start, 10);
          const endNum = end ? parseInt(end, 10) : startNum;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onOpenCode(filePath, startNum, endNum)}
              className="inline-flex items-center gap-1.5 font-code text-[11.5px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 px-2 py-0.5 rounded-md border border-indigo-200/90 dark:border-indigo-800/70 mx-0.5 font-medium cursor-pointer transition-all shadow-2xs group"
              title={`Inspect ${filePath}:${startNum}–${endNum} in CodeViewer`}
            >
              <FileCode className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
              <span>{t.text}</span>
            </button>
          );
        }
        return (
          <code
            key={idx}
            className="font-code text-[12px] text-pink-700 dark:text-pink-300 bg-zinc-100/90 dark:bg-zinc-800/90 px-1.5 py-0.5 rounded-md border border-zinc-200/80 dark:border-zinc-700/60 mx-0.5 font-medium"
          >
            {t.text}
          </code>
        );
      }
      case 'link': {
        const t = token as Tokens.Link;
        return (
          <a
            key={idx}
            href={t.href}
            title={t.title || undefined}
            target="_blank"
            rel="noreferrer"
            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 underline underline-offset-2 transition-colors font-medium"
          >
            {renderInlineTokens(t.tokens, onOpenCode)}
          </a>
        );
      }
      case 'del': {
        const t = token as Tokens.Del;
        return (
          <del key={idx} className="line-through text-zinc-400 dark:text-zinc-500">
            {renderInlineTokens(t.tokens, onOpenCode)}
          </del>
        );
      }
      case 'br':
        return <br key={idx} />;
      case 'text':
      default: {
        const t = token as Tokens.Text;
        if (t.tokens && t.tokens.length > 0) {
          return <React.Fragment key={idx}>{renderInlineTokens(t.tokens, onOpenCode)}</React.Fragment>;
        }

        // Detect inline citations formatted as [path/to/file.ext:10-25] or path:10
        if (onOpenCode && /([\w\-./]+\.[a-zA-Z0-9]+):(\d+)(?:[–-](\d+))?/.test(t.text)) {
          const parts = t.text.split(/((?:[\w\-./]+\.[a-zA-Z0-9]+):(?:\d+)(?:[–-](?:\d+))?)/g);
          return (
            <React.Fragment key={idx}>
              {parts.map((part, pIdx) => {
                const match = part.match(/^([\w\-./]+\.[a-zA-Z0-9]+):(\d+)(?:[–-](\d+))?$/);
                if (match) {
                  const [, filePath, start, end] = match;
                  const startNum = parseInt(start, 10);
                  const endNum = end ? parseInt(end, 10) : startNum;
                  return (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() => onOpenCode(filePath, startNum, endNum)}
                      className="inline-flex items-center gap-1.5 font-code text-[11.5px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 px-2 py-0.5 rounded-md border border-indigo-200/90 dark:border-indigo-800/70 mx-0.5 font-medium cursor-pointer transition-all shadow-2xs group"
                      title={`Inspect ${filePath}:${startNum}–${endNum} in CodeViewer`}
                    >
                      <FileCode className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
                      <span>{part}</span>
                    </button>
                  );
                }
                return part;
              })}
            </React.Fragment>
          );
        }

        return <React.Fragment key={idx}>{t.text}</React.Fragment>;
      }
    }
  });
}

function StreamingCursor() {
  return (
    <span className="inline-inline-flex items-center align-baseline ml-1 select-none pointer-events-none" aria-hidden="true">
      <span className="relative inline-flex items-center justify-center">
        <span className="h-3.5 w-[2.5px] rounded-full bg-indigo-600 dark:bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.9)] animate-stream-cursor" />
      </span>
    </span>
  );
}

function renderBlockToken(
  token: Token,
  key: number | string,
  onOpenCode?: (filePath: string, startLine?: number, endLine?: number) => void,
  isLastStreamingToken?: boolean
): React.ReactNode {
  switch (token.type) {
    case 'heading': {
      const t = token as Tokens.Heading;
      const HeadingTag = `h${Math.min(Math.max(t.depth, 1), 6)}` as React.ElementType;
      const headingStyles: Record<number, string> = {
        1: 'text-lg font-bold text-zinc-950 dark:text-white mt-5 mb-2.5 tracking-tight border-b border-zinc-200/80 dark:border-zinc-800/80 pb-1.5',
        2: 'text-[16px] font-bold text-zinc-950 dark:text-white mt-4 mb-2 tracking-tight',
        3: 'text-[14.5px] font-semibold text-zinc-900 dark:text-zinc-100 mt-3.5 mb-1.5 tracking-tight',
        4: 'text-sm font-semibold text-zinc-900 dark:text-zinc-200 mt-3 mb-1',
        5: 'text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mt-2.5 mb-1',
        6: 'text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-500 mt-2.5 mb-1',
      };
      return (
        <HeadingTag key={key} className={headingStyles[t.depth] || headingStyles[3]}>
          {t.tokens ? renderInlineTokens(t.tokens, onOpenCode) : t.text}
          {isLastStreamingToken && <StreamingCursor />}
        </HeadingTag>
      );
    }
    case 'paragraph': {
      const t = token as Tokens.Paragraph;
      return (
        <p key={key} className="my-2.5 text-[13.8px] sm:text-[14.2px] leading-relaxed text-left text-zinc-800 dark:text-zinc-200 font-sans-ui">
          {t.tokens ? renderInlineTokens(t.tokens, onOpenCode) : t.text}
          {isLastStreamingToken && <StreamingCursor />}
        </p>
      );
    }
    case 'code': {
      const t = token as Tokens.Code;
      return <CodeBlock key={key} code={t.text} language={t.lang} />;
    }
    case 'list': {
      const t = token as Tokens.List;
      if (t.ordered) {
        return (
          <ol key={key} start={t.start || 1} className="my-2.5 space-y-1.5 pl-5 list-decimal text-left text-zinc-800 dark:text-zinc-200 text-[13.8px] sm:text-[14.2px] leading-relaxed font-sans-ui">
            {t.items.map((item, i) => (
              <li key={i} className="pl-1">
                {item.tokens ? renderInlineTokens(item.tokens, onOpenCode) : item.text}
                {isLastStreamingToken && i === t.items.length - 1 && <StreamingCursor />}
              </li>
            ))}
          </ol>
        );
      }
      return (
        <ul key={key} className="my-2.5 space-y-1.5 pl-5 list-disc text-left text-zinc-800 dark:text-zinc-200 text-[13.8px] sm:text-[14.2px] leading-relaxed marker:text-zinc-400 dark:marker:text-zinc-500 font-sans-ui">
          {t.items.map((item, i) => (
            <li key={i} className="pl-1">
              {item.tokens ? renderInlineTokens(item.tokens, onOpenCode) : item.text}
              {isLastStreamingToken && i === t.items.length - 1 && <StreamingCursor />}
            </li>
          ))}
        </ul>
      );
    }
    case 'blockquote': {
      const t = token as Tokens.Blockquote;
      return (
        <blockquote
          key={key}
          className="my-3.5 border-l-4 border-indigo-500/80 dark:border-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20 py-2.5 px-4 text-zinc-800 dark:text-zinc-200 rounded-r-xl text-[13.5px] leading-relaxed font-sans-ui shadow-2xs"
        >
          {t.tokens ? t.tokens.map((subToken, i) => renderBlockToken(subToken, i, onOpenCode, isLastStreamingToken && i === t.tokens!.length - 1)) : t.text}
          {isLastStreamingToken && (!t.tokens || t.tokens.length === 0) && <StreamingCursor />}
        </blockquote>
      );
    }
    case 'table': {
      const t = token as Tokens.Table;
      return (
        <div key={key} className="my-4 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 shadow-xs">
          <table className="w-full text-left text-[13px] font-sans-ui border-collapse">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-900/90 text-zinc-900 dark:text-zinc-200">
              <tr>
                {t.header.map((cell, i) => (
                  <th key={i} className="px-4 py-2.5 font-semibold text-xs tracking-tight uppercase text-zinc-600 dark:text-zinc-400">
                    {renderInlineTokens(cell.tokens, onOpenCode)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800/60 text-zinc-800 dark:text-zinc-300">
              {t.rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-4 py-2.5 leading-relaxed">
                      {renderInlineTokens(cell.tokens, onOpenCode)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case 'hr':
      return <hr key={key} className="my-4 border-zinc-200 dark:border-zinc-800/80" />;
    case 'space':
      return null;
    default: {
      const anyToken = token as any;
      if (anyToken.tokens) {
        return <div key={key}>{renderInlineTokens(anyToken.tokens, onOpenCode)}</div>;
      }
      return <div key={key}>{anyToken.text || ''}</div>;
    }
  }
}

export default function MarkdownRenderer({
  content,
  className = '',
  onOpenCode,
  animate = false,
  onTypingComplete,
  isStreaming = false,
}: MarkdownRendererProps) {
  const tokens = useMemo(() => {
    try {
      return marked.lexer(content, { gfm: true, breaks: true });
    } catch {
      return null;
    }
  }, [content]);

  React.useEffect(() => {
    if (animate) {
      const timer = setTimeout(() => {
        onTypingComplete?.();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [animate, onTypingComplete]);

  if (!tokens) {
    if (animate) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className={`whitespace-pre-wrap leading-relaxed font-sans-ui text-zinc-800 dark:text-zinc-200 ${className}`}
        >
          {content}
          {isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 align-middle bg-indigo-500 dark:bg-indigo-400 rounded-xs animate-pulse" />
          )}
        </motion.div>
      );
    }
    return (
      <div className={`whitespace-pre-wrap leading-relaxed font-sans-ui text-zinc-800 dark:text-zinc-200 ${className}`}>
        {content}
        {isStreaming && (
          <span className="inline-block w-2 h-4 ml-1 align-middle bg-indigo-500 dark:bg-indigo-400 rounded-xs animate-pulse" />
        )}
      </div>
    );
  }

  // ── Smooth Staggered Block Reveal ───────────────────────────────────────
  if (animate) {
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              staggerChildren: 0.06,
              delayChildren: 0.02,
            },
          },
        }}
        className={`markdown-body w-full max-w-[80ch] text-[13.8px] sm:text-[14.2px] leading-relaxed text-left text-zinc-800 dark:text-zinc-200 font-sans-ui ${className}`}
      >
        {tokens.map((token, idx) => (
          <motion.div
            key={idx}
            variants={{
              hidden: { opacity: 0, y: 8, filter: 'blur(3px)' },
              visible: {
                opacity: 1,
                y: 0,
                filter: 'blur(0px)',
                transition: {
                  duration: 0.32,
                  ease: [0.16, 1, 0.3, 1],
                },
              },
            }}
          >
            {renderBlockToken(token, idx, onOpenCode, isStreaming && idx === tokens.length - 1)}
          </motion.div>
        ))}
        {isStreaming && tokens.length === 0 && <StreamingCursor />}
      </motion.div>
    );
  }

  return (
    <div className={`markdown-body w-full max-w-[80ch] text-[13.8px] sm:text-[14.2px] leading-relaxed text-left text-zinc-800 dark:text-zinc-200 font-sans-ui ${className}`}>
      {tokens.map((token, idx) =>
        renderBlockToken(token, idx, onOpenCode, isStreaming && idx === tokens.length - 1)
      )}
      {isStreaming && tokens.length === 0 && <StreamingCursor />}
    </div>
  );
}
