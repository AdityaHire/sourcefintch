import { useEffect, useRef, useState, useId } from 'react';
import mermaid from 'mermaid';
import { Copy, Check, Maximize2, Minimize2, Sparkles, RefreshCw } from 'lucide-react';

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

let mermaidInitialized = false;

function ensureMermaidInit() {
  if (!mermaidInitialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      themeVariables: {
        darkMode: true,
        background: '#09090b',
        mainBkg: '#18181b',
        primaryColor: '#27272a',
        primaryTextColor: '#f4f4f5',
        primaryBorderColor: '#3f3f46',
        lineColor: '#71717a',
        secondaryColor: '#18181b',
        secondaryTextColor: '#e4e4e7',
        secondaryBorderColor: '#27272a',
        tertiaryColor: '#121215',
        tertiaryTextColor: '#a1a1aa',
        tertiaryBorderColor: '#27272a',
        clusterBkg: '#121215',
        clusterBorder: '#27272a',
        nodeBorder: '#3f3f46',
        defaultLinkColor: '#a1a1aa',
        edgeLabelBackground: '#18181b',
        fontSize: '12px',
      },
    });
    mermaidInitialized = true;
  }
}

export default function MermaidDiagram({ chart, className = '' }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const rawId = useId();
  const diagramId = `mermaid-${rawId.replace(/:/g, '')}`;

  useEffect(() => {
    let isMounted = true;
    if (!chart || !chart.trim()) {
      setSvgContent('');
      setError('No diagram syntax provided');
      return;
    }

    ensureMermaidInit();
    setError(null);

    const cleanChart = chart.trim().replace(/^```(?:mermaid)?\s*/i, '').replace(/\s*```$/i, '').trim();

    mermaid.render(diagramId, cleanChart)
      .then(({ svg }) => {
        if (isMounted) {
          // Clean up any inline fixed widths to allow fluid container scaling
          const responsiveSvg = svg.replace(/<svg\s+([^>]*?)>/i, (_match, attrs) => {
            let updated = attrs;
            if (!attrs.includes('viewBox') && attrs.includes('width') && attrs.includes('height')) {
              const wMatch = attrs.match(/width="([\d.]+)(?:px)?"/);
              const hMatch = attrs.match(/height="([\d.]+)(?:px)?"/);
              if (wMatch && hMatch) {
                updated += ` viewBox="0 0 ${wMatch[1]} ${hMatch[1]}"`;
              }
            }
            return `<svg ${updated} style="max-width: 100%; height: auto; display: block; margin: 0 auto;">`;
          });
          setSvgContent(responsiveSvg);
          setError(null);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.warn('Mermaid rendering error:', err);
          setError('Could not render architectural graph. Raw syntax available below.');
          // Remove temporary element injected by mermaid if error occurred
          const tempEl = document.getElementById(diagramId);
          if (tempEl) tempEl.remove();
        }
      });

    return () => {
      isMounted = false;
      const tempEl = document.getElementById(diagramId);
      if (tempEl) tempEl.remove();
    };
  }, [chart, diagramId]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(chart.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className={`rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-sm transition-all ${isExpanded ? 'ring-2 ring-indigo-500/30' : ''} ${className}`}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-zinc-800/80 bg-zinc-900/60 text-xs">
        <div className="flex items-center gap-2 text-zinc-300 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Interactive Architecture Diagram</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors cursor-pointer"
            title="Copy Mermaid Code"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-300">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy Code</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors cursor-pointer"
            title={isExpanded ? 'Collapse View' : 'Expand View'}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Content Body */}
      <div
        ref={containerRef}
        className={`p-4 transition-all flex items-center justify-center overflow-x-auto ${
          isExpanded ? 'min-h-[480px] max-h-[750px]' : 'min-h-[260px] max-h-[420px]'
        }`}
      >
        {error ? (
          <div className="w-full text-center py-4 space-y-2">
            <p className="text-xs text-amber-400/90">{error}</p>
            <pre className="text-[11px] font-code text-zinc-400 bg-zinc-900 p-3 rounded-lg text-left overflow-x-auto max-w-xl mx-auto border border-zinc-800">
              <code>{chart}</code>
            </pre>
          </div>
        ) : svgContent ? (
          <div
            className="w-full flex justify-center [&_svg]:max-w-full [&_svg]:h-auto select-none"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        ) : (
          <div className="flex items-center gap-2 text-zinc-500 text-xs py-8">
            <RefreshCw className="w-4 h-4 animate-spin text-zinc-500" />
            <span>Rendering diagram...</span>
          </div>
        )}
      </div>
    </div>
  );
}
