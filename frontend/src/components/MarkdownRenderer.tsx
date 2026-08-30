import React, { useState } from 'react';
import { marked, type Token, type Tokens } from 'marked';
import { Copy, Check, Code2 } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  onOpenCode?: (filePath: string, startLine?: number, endLine?: number) => void;
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

  return (
    <div className="my-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-900 text-zinc-100 overflow-hidden text-xs shadow-2xs">
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-3.5 py-1.5 font-code text-[11px] text-zinc-400">
        <span className="text-zinc-400 font-medium">{language || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-zinc-300" />
              <span className="text-zinc-300 font-sans-ui">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span className="font-sans-ui">Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto font-code text-zinc-200 leading-relaxed text-[12.5px]">
        <code>{code}</code>
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
          <strong key={idx} className="font-semibold text-zinc-900 dark:text-zinc-100">
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
        // Check if codespan is a file line range e.g. index.html:246-285
        const match = t.text.match(/^([\w./\-]+):(\d+)(?:[–-](\d+))?$/);
        if (match && onOpenCode) {
          const [, filePath, start, end] = match;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onOpenCode(filePath, parseInt(start, 10), end ? parseInt(end, 10) : parseInt(start, 10))}
              className="inline-flex items-center gap-1 font-code text-[11.5px] text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700 mx-0.5 font-medium cursor-pointer transition-colors"
              title={`Inspect ${t.text}`}
            >
              <Code2 className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />
              <span>{t.text}</span>
            </button>
          );
        }
        return (
          <code
            key={idx}
            className="font-code text-[12px] text-zinc-800 dark:text-zinc-200 bg-zinc-100/80 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200/80 dark:border-zinc-700/60 mx-0.5 font-medium"
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
            className="text-zinc-900 dark:text-zinc-100 hover:text-zinc-600 dark:hover:text-zinc-300 underline underline-offset-2 transition-colors font-medium"
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
        return <React.Fragment key={idx}>{t.text}</React.Fragment>;
      }
    }
  });
}

function renderBlockToken(
  token: Token,
  key: number | string,
  onOpenCode?: (filePath: string, startLine?: number, endLine?: number) => void
): React.ReactNode {
  switch (token.type) {
    case 'heading': {
      const t = token as Tokens.Heading;
      const HeadingTag = `h${Math.min(Math.max(t.depth, 1), 6)}` as React.ElementType;
      const headingStyles: Record<number, string> = {
        1: 'text-lg font-semibold text-zinc-900 dark:text-white mt-4 mb-2 tracking-tight',
        2: 'text-base font-semibold text-zinc-900 dark:text-white mt-3.5 mb-1.5 tracking-tight',
        3: 'text-[14.5px] font-semibold text-zinc-900 dark:text-zinc-100 mt-3 mb-1 tracking-tight',
        4: 'text-sm font-semibold text-zinc-900 dark:text-zinc-200 mt-2.5 mb-1',
        5: 'text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mt-2 mb-1',
        6: 'text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-500 mt-2 mb-1',
      };
      return (
        <HeadingTag key={key} className={headingStyles[t.depth] || headingStyles[3]}>
          {t.tokens ? renderInlineTokens(t.tokens, onOpenCode) : t.text}
        </HeadingTag>
      );
    }
    case 'paragraph': {
      const t = token as Tokens.Paragraph;
      return (
        <p key={key} className="my-2 text-[14px] sm:text-[14.5px] leading-relaxed text-zinc-800 dark:text-zinc-200 font-sans-ui">
          {t.tokens ? renderInlineTokens(t.tokens, onOpenCode) : t.text}
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
          <ol key={key} start={t.start || 1} className="my-2 space-y-1.5 pl-5 list-decimal text-zinc-800 dark:text-zinc-200 text-[14px] sm:text-[14.5px] leading-relaxed font-sans-ui">
            {t.items.map((item, i) => (
              <li key={i} className="pl-1">
                {item.tokens ? renderInlineTokens(item.tokens, onOpenCode) : item.text}
              </li>
            ))}
          </ol>
        );
      }
      return (
        <ul key={key} className="my-2 space-y-1.5 pl-5 list-disc text-zinc-800 dark:text-zinc-200 text-[14px] sm:text-[14.5px] leading-relaxed marker:text-zinc-400 dark:marker:text-zinc-500 font-sans-ui">
          {t.items.map((item, i) => (
            <li key={i} className="pl-1">
              {item.tokens ? renderInlineTokens(item.tokens, onOpenCode) : item.text}
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
          className="my-3 border-l-2 border-zinc-400 dark:border-zinc-600 bg-zinc-100/50 dark:bg-zinc-900/40 py-2 px-3.5 text-zinc-700 dark:text-zinc-300 rounded-r-lg text-[13.5px] leading-relaxed font-sans-ui"
        >
          {t.tokens ? t.tokens.map((subToken, i) => renderBlockToken(subToken, i, onOpenCode)) : t.text}
        </blockquote>
      );
    }
    case 'table': {
      const t = token as Tokens.Table;
      return (
        <div key={key} className="my-3.5 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-2xs">
          <table className="w-full text-left text-[13px] font-sans-ui">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300">
              <tr>
                {t.header.map((cell, i) => (
                  <th key={i} className="px-3.5 py-2 font-semibold text-xs tracking-tight">
                    {renderInlineTokens(cell.tokens, onOpenCode)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/80 dark:divide-zinc-800/60 text-zinc-800 dark:text-zinc-300">
              {t.rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-zinc-50/80 dark:hover:bg-white/[0.02] transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3.5 py-2.5 leading-relaxed">
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
}: MarkdownRendererProps) {
  const tokens = React.useMemo(() => {
    try {
      return marked.lexer(content, { gfm: true, breaks: true });
    } catch {
      return null;
    }
  }, [content]);

  if (!tokens) {
    return (
      <div className={`whitespace-pre-wrap leading-relaxed font-sans-ui text-zinc-800 dark:text-zinc-200 ${className}`}>
        {content}
      </div>
    );
  }

  return (
    <div className={`markdown-body max-w-[72ch] text-[14px] sm:text-[14.5px] leading-relaxed text-zinc-800 dark:text-zinc-200 font-sans-ui ${className}`}>
      {tokens.map((token, idx) => renderBlockToken(token, idx, onOpenCode))}
    </div>
  );
}
