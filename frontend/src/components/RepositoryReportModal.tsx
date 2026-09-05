import { useState, useMemo } from 'react';
import type { Repository, RepositoryFile, RepositoryReport } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import {
  X,
  Sparkles,
  Copy,
  Check,
  Download,
  RefreshCw,
  FileCode,
  Layers,
  Cpu,
  FolderTree,
  ShieldCheck,
  Zap,
  ListChecks,
  ArrowRight,
  Search,
  ExternalLink,
  Package,
  Terminal,
  Clock,
  Code2,
  AlertTriangle,
} from 'lucide-react';

interface RepositoryReportModalProps {
  report: RepositoryReport | null;
  isLoading: boolean;
  errorMessage?: string | null;
  activeRepo?: Repository | null;
  repoFiles?: RepositoryFile[];
  onClose: () => void;
  onRefresh: () => void;
  onAskAI?: (prompt: string, autoSend?: boolean) => void;
  onInspectFile?: (filePath: string) => void;
}

type TabType = 'architecture' | 'tech_stack' | 'dependencies' | 'modules';

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f7df1e',
  Python: '#3572a5',
  TSX: '#61dafb',
  JSX: '#20c997',
  HTML: '#e34c26',
  CSS: '#563d7c',
  SCSS: '#c6538c',
  JSON: '#cbcb41',
  Markdown: '#083fa1',
  SQL: '#e38c00',
  Shell: '#89e051',
  Go: '#00add8',
  Rust: '#dea584',
  Java: '#b07219',
  Other: '#71717a',
};

const EXTENSION_MAP: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TSX',
  '.js': 'JavaScript',
  '.jsx': 'JSX',
  '.py': 'Python',
  '.json': 'JSON',
  '.html': 'HTML',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.sql': 'SQL',
  '.sh': 'Shell',
  '.bash': 'Shell',
  '.go': 'Go',
  '.rs': 'Rust',
  '.java': 'Java',
  '.md': 'Markdown',
};

function generateClientReport(activeRepo: Repository, files: RepositoryFile[]): RepositoryReport {
  const totalFiles = files.length;
  let totalBytes = 0;
  let totalLines = 0;

  const langCounts: Record<string, number> = {};
  const langLines: Record<string, number> = {};
  const dirCounts: Record<string, number> = {};
  const manifests: string[] = [];
  const dependencies: RepositoryReport['dependencies'] = [];
  const entryPoints: RepositoryReport['entry_points'] = [];
  const detectedApis: RepositoryReport['detected_apis'] = [];

  const entryNames = [
    'main.py', 'app.py', 'server.js', 'app.js', 'index.js',
    'index.ts', 'main.ts', 'main.tsx', 'App.tsx', 'index.tsx',
  ];

  for (const f of files) {
    const path = f.file_path || '';
    const content = f.content || '';
    const lines = content ? content.split('\n').length : 0;
    const size = f.file_size || (content ? content.length : 0);

    totalBytes += size;
    totalLines += lines;

    const parts = path.split('/');
    if (parts.length > 1) {
      dirCounts[parts[0]] = (dirCounts[parts[0]] || 0) + 1;
    }

    const ext = path.includes('.') ? '.' + path.split('.').pop()!.toLowerCase() : '';
    const lang = EXTENSION_MAP[ext] || f.language || 'Other';
    langCounts[lang] = (langCounts[lang] || 0) + 1;
    langLines[lang] = (langLines[lang] || 0) + lines;

    const base = path.split('/').pop() || '';
    if (entryNames.includes(base)) {
      entryPoints.push({
        file_path: path,
        name: base,
        language: lang,
        description: `Application entry point (${lang})`,
      });
    }

    if (base === 'package.json') {
      manifests.push(path);
      try {
        const pkg = JSON.parse(content);
        if (pkg.dependencies) {
          Object.entries(pkg.dependencies).forEach(([name, ver]) => {
            dependencies.push({
              name,
              version: String(ver),
              type: 'runtime',
              category: name.includes('react') || name.includes('express') || name.includes('next') ? 'Framework & Runtime' : 'Utility & Tooling',
            });
          });
        }
        if (pkg.devDependencies) {
          Object.entries(pkg.devDependencies).forEach(([name, ver]) => {
            dependencies.push({
              name,
              version: String(ver),
              type: 'dev',
              category: 'Testing & Tooling',
            });
          });
        }
      } catch {}
    } else if (base === 'requirements.txt') {
      manifests.push(path);
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const splitParts = trimmed.split(/[><=~]+/);
          dependencies.push({
            name: splitParts[0].trim(),
            version: splitParts[1]?.trim() || 'latest',
            type: 'runtime',
            category: 'Framework & Runtime',
          });
        }
      });
    }

    if (/router|route|api|controller/i.test(path)) {
      const matches = content.matchAll(/\b(router|app)\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/gi);
      for (const m of matches) {
        detectedApis.push({ method: m[2].toUpperCase(), path: m[3], file: path });
      }
    }
  }

  const languages = Object.entries(langCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([lang, count]) => ({
      language: lang,
      file_count: count,
      line_count: langLines[lang] || 0,
      byte_size: 0,
      percentage: Number(((count / Math.max(totalFiles, 1)) * 100).toFixed(1)),
      color: LANGUAGE_COLORS[lang] || LANGUAGE_COLORS.Other,
    }));

  const keyDirectories = Object.entries(dirCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([d, count]) => ({
      path: d,
      file_count: count,
      description: `Core module containing ${count} files`,
    }));

  const topLangs = languages.slice(0, 3).map((l) => `${l.language} (${l.percentage}%)`).join(', ');

  return {
    repository_id: activeRepo.id,
    repo_name: activeRepo.name,
    owner: activeRepo.owner || '',
    github_url: activeRepo.github_url || '',
    branch: activeRepo.branch || 'main',
    generated_at: new Date().toISOString(),
    metrics: {
      total_files: totalFiles,
      total_lines: totalLines,
      total_size_bytes: totalBytes,
      languages,
    },
    manifests,
    dependencies: dependencies.slice(0, 60),
    scripts: {},
    entry_points: entryPoints.slice(0, 8),
    key_directories: keyDirectories,
    detected_apis: detectedApis.slice(0, 25),
    ai_analysis: {
      executive_summary: `${activeRepo.name} is organized across ${totalFiles} source files, built primarily with ${topLangs || 'modern technologies'}.`,
      architecture_style: 'Modular Multi-Tier Application',
      architecture_deep_dive: `### Architecture Overview\n\nThe repository \`${activeRepo.name}\` is organized across ${totalFiles} source files and ${keyDirectories.length} primary directories. Key languages include ${topLangs}.\n\n### Subsystems & Components\n- **Entry Points**: ${entryPoints.map((e) => `\`${e.file_path}\``).join(', ') || 'Standard structure'}\n- **Dependencies**: ${dependencies.length} packages identified across runtime frameworks and development tooling.`,
      key_features: [
        { title: 'Modular Organization', description: `Structured into ${keyDirectories.length} distinct directories with clean separation.` },
        { title: 'Multi-Language Ecosystem', description: `Powered by ${topLangs || 'modern web technologies'}.` },
      ],
      security_and_performance: [
        { aspect: 'Architecture', observation: 'Clean decoupling of source directories and entry points.' },
      ],
      onboarding_guide: [
        { step: 1, title: 'Inspect Entry Points', detail: `Review primary files: ${entryPoints.map((e) => e.file_path).slice(0, 2).join(', ') || 'root source files'}.` },
        { step: 2, title: 'Check Dependencies', detail: `Examine ${manifests.join(', ') || 'package manifests'} for required packages and build scripts.` },
      ],
      recommended_questions: [
        `How is the overall data flow structured in ${activeRepo.name}?`,
        'What are the primary entry points and how do they start the application?',
        'Can you explain the main dependencies and their purposes?',
        'How do I add a new feature or endpoint to this project?',
      ],
    },
  };
}

export default function RepositoryReportModal({
  report: serverReport,
  isLoading,
  errorMessage,
  activeRepo,
  repoFiles,
  onClose,
  onRefresh,
  onAskAI,
  onInspectFile,
}: RepositoryReportModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('architecture');
  const [copied, setCopied] = useState(false);
  const [depSearch, setDepSearch] = useState('');
  const [depFilter, setDepFilter] = useState<'all' | 'runtime' | 'dev'>('all');

  // Effective report: server report if available, else client-side synthesis from loaded repoFiles
  const report = useMemo<RepositoryReport | null>(() => {
    if (serverReport) return serverReport;
    if (activeRepo && repoFiles && repoFiles.length > 0) {
      return generateClientReport(activeRepo, repoFiles);
    }
    return null;
  }, [serverReport, activeRepo, repoFiles]);

  const isClientSynthesized = Boolean(!serverReport && report);

  // Format full markdown for copy / export
  const fullMarkdown = useMemo(() => {
    if (!report) return '';
    const langs = report.metrics.languages.map((l) => `- **${l.language}**: ${l.percentage}% (${l.file_count} files, ${l.line_count.toLocaleString()} lines)`).join('\n');
    const keyDirs = report.key_directories.map((d) => `- **\`${d.path}/\`**: ${d.description} (${d.file_count} files)`).join('\n');
    const entries = report.entry_points.map((e) => `- **\`${e.file_path}\`** (${e.language}): ${e.description}`).join('\n');
    const features = report.ai_analysis.key_features.map((f) => `- **${f.title}**: ${f.description}`).join('\n');
    const secPerf = report.ai_analysis.security_and_performance.map((s) => `- **${s.aspect}**: ${s.observation}${s.recommendation ? ` *(Recommendation: ${s.recommendation})*` : ''}`).join('\n');
    const onboarding = report.ai_analysis.onboarding_guide.map((o) => `${o.step}. **${o.title}**: ${o.detail}`).join('\n');

    return `# Repository Intelligence Report: ${report.repo_name}
> Branch: \`${report.branch}\` | Generated: ${new Date(report.generated_at).toLocaleString()} | Total Files: ${report.metrics.total_files} | Total Lines: ${report.metrics.total_lines.toLocaleString()}

---

## 1. Executive Summary
${report.ai_analysis.executive_summary}

**Architecture Style**: ${report.ai_analysis.architecture_style}

---

## 2. Architectural Deep Dive
${report.ai_analysis.architecture_deep_dive}

---

## 3. Key Features & Capabilities
${features || 'No features listed'}

---

## 4. Language & Code Distribution
${langs || 'No language breakdown available'}

---

## 5. Modules & Entry Points
### Key Directories
${keyDirs || 'Standard directory layout'}

### Entry Points
${entries || 'Standard structure'}

---

## 6. Security, Performance & Quality
${secPerf || 'No specific observations'}

---

## 7. Developer Onboarding Guide
${onboarding || 'Follow standard project setup instructions'}
`;
  }, [report]);

  const handleCopyMarkdown = async () => {
    if (!fullMarkdown) return;
    try {
      await navigator.clipboard.writeText(fullMarkdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownloadMarkdown = () => {
    if (!fullMarkdown || !report) return;
    const blob = new Blob([fullMarkdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${report.repo_name}-intelligence-report.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filtered dependencies
  const filteredDeps = useMemo(() => {
    if (!report) return [];
    return report.dependencies.filter((d) => {
      const matchesSearch =
        d.name.toLowerCase().includes(depSearch.toLowerCase()) ||
        d.category.toLowerCase().includes(depSearch.toLowerCase());
      const matchesType = depFilter === 'all' || d.type === depFilter;
      return matchesSearch && matchesType;
    });
  }, [report, depSearch, depFilter]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-black/75 backdrop-blur-md animate-fade-in font-sans-ui select-text">
      {/* Modal Container */}
      <div className="relative flex flex-col w-full max-w-5xl h-[88vh] rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-purple-500/30 text-purple-400 shadow-inner">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  Repository Intelligence Report
                </h2>
                {report && (
                  <span className="rounded-md bg-zinc-800 border border-zinc-700/60 px-2 py-0.5 text-[11px] font-code text-zinc-300">
                    {report.repo_name}
                  </span>
                )}
                {isClientSynthesized && (
                  <span className="rounded-md bg-purple-950/60 border border-purple-500/40 px-2 py-0.5 text-[10.5px] font-medium text-purple-300">
                    Client-Side Analysis
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400">
                Auto-generated architectural synthesis and code intelligence
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyMarkdown}
              disabled={isLoading || !report}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700/80 bg-zinc-800/80 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-all cursor-pointer shadow-xs disabled:opacity-50"
              title="Copy full report as Markdown"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Report</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownloadMarkdown}
              disabled={isLoading || !report}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700/80 bg-zinc-800/80 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-all cursor-pointer shadow-xs disabled:opacity-50"
              title="Download report as .md"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export .md</span>
            </button>

            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-xs font-semibold text-purple-300 transition-all cursor-pointer shadow-xs disabled:opacity-50"
              title="Re-run intelligence analysis"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Analyzing...' : 'Regenerate'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer ml-1"
              title="Close report"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Loading Overlay */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center flex-1 p-8 text-center bg-zinc-950/80">
            <div className="relative flex items-center justify-center w-16 h-16 mb-4">
              <div className="absolute inset-0 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin" />
              <Sparkles className="w-6 h-6 text-purple-400 animate-pulse" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">
              Analyzing Codebase & Synthesizing Report
            </h3>
            <p className="text-xs text-zinc-400 max-w-sm">
              Scanning language distributions, parsing dependencies, and synthesizing architectural intelligence...
            </p>
          </div>
        )}

        {/* Error / Empty State */}
        {!isLoading && !report && (
          <div className="flex flex-col items-center justify-center flex-1 p-8 text-center bg-zinc-950">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-4">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">
              Unable to Load Repository Intelligence Report
            </h3>
            <p className="text-xs text-zinc-400 max-w-md mb-6 leading-relaxed">
              {errorMessage || 'The report could not be generated. Please make sure your repository is selected and indexed, then click Retry.'}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onRefresh}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-600/20 cursor-pointer transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry Analysis</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer transition-all"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Loaded Content */}
        {!isLoading && report && (
          <>
            {/* Sub-header Tabs & Quick Stats Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-2.5 border-b border-zinc-800/80 bg-zinc-900/40 gap-3 shrink-0">
              {/* Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('architecture')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'architecture'
                      ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40 shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Architecture & Deep Dive</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('tech_stack')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'tech_stack'
                      ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40 shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Tech Stack & Languages</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('dependencies')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'dependencies'
                      ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40 shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Dependencies ({report.dependencies.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('modules')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'modules'
                      ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40 shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                  }`}
                >
                  <FolderTree className="w-3.5 h-3.5" />
                  <span>Modules & APIs ({report.entry_points.length + report.detected_apis.length})</span>
                </button>
              </div>

              {/* Quick Metrics */}
              <div className="flex items-center gap-3 text-xs text-zinc-400 shrink-0 font-code">
                <span>{report.metrics.total_files} files</span>
                <span>·</span>
                <span>{report.metrics.total_lines.toLocaleString()} lines</span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-zinc-500" />
                  {new Date(report.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-zinc-200">
              {/* TAB 1: ARCHITECTURE & DEEP DIVE */}
              {activeTab === 'architecture' && (
                <div className="space-y-6 animate-fade-in">
                  {/* Executive Summary Card */}
                  <div className="rounded-xl border border-purple-500/30 bg-gradient-to-r from-purple-950/30 via-zinc-900/40 to-indigo-950/30 p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[11px] font-semibold tracking-wide uppercase">
                        Executive Summary
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 text-[11px] font-code">
                        {report.ai_analysis.architecture_style}
                      </span>
                    </div>
                    <p className="text-sm sm:text-base text-zinc-200 leading-relaxed font-sans">
                      {report.ai_analysis.executive_summary}
                    </p>
                  </div>

                  {/* Deep Dive Markdown Text */}
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xs">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-4 flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-purple-400" />
                      Architectural Deep Dive & Patterns
                    </h3>
                    <div className="prose prose-invert max-w-none text-zinc-300 text-sm">
                      <MarkdownRenderer
                        content={report.ai_analysis.architecture_deep_dive}
                        onOpenCode={(path) => {
                          if (onInspectFile) {
                            onInspectFile(path);
                            onClose();
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Key Features Grid */}
                  {report.ai_analysis.key_features.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-400" />
                        Core Functional Capabilities
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {report.ai_analysis.key_features.map((feat, idx) => (
                          <div
                            key={idx}
                            className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 hover:border-zinc-700 transition-colors"
                          >
                            <h4 className="text-xs font-semibold text-white mb-1 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                              {feat.title}
                            </h4>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                              {feat.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Security & Performance Insights */}
                  {report.ai_analysis.security_and_performance.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        Security, Performance & Best Practices
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {report.ai_analysis.security_and_performance.map((sec, idx) => (
                          <div
                            key={idx}
                            className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4"
                          >
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 mb-2">
                              {sec.aspect}
                            </span>
                            <p className="text-xs text-zinc-300 mb-1.5">
                              {sec.observation}
                            </p>
                            {sec.recommendation && (
                              <p className="text-[11px] text-zinc-500 italic">
                                Tip: {sec.recommendation}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Developer Onboarding Guide */}
                  {report.ai_analysis.onboarding_guide.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                        <ListChecks className="w-4 h-4 text-indigo-400" />
                        Developer Quickstart & Onboarding Roadmap
                      </h3>
                      <div className="space-y-2">
                        {report.ai_analysis.onboarding_guide.map((step, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3.5"
                          >
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold shrink-0 border border-purple-500/30">
                              {step.step || idx + 1}
                            </span>
                            <div>
                              <h4 className="text-xs font-semibold text-white mb-0.5">
                                {step.title}
                              </h4>
                              <p className="text-xs text-zinc-400 leading-relaxed">
                                {step.detail}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Suggested Exploration Chips */}
                  {report.ai_analysis.recommended_questions.length > 0 && (
                    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-2.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        Explore Further with AI
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {report.ai_analysis.recommended_questions.map((q, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              if (onAskAI) {
                                onAskAI(q, true);
                                onClose();
                              }
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-xs text-purple-200 transition-all cursor-pointer shadow-xs"
                          >
                            <span>{q}</span>
                            <ArrowRight className="w-3 h-3 text-purple-400" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: TECH STACK & LANGUAGES */}
              {activeTab === 'tech_stack' && (
                <div className="space-y-6 animate-fade-in">
                  {/* Visual Language Bar */}
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
                      Language Distribution
                    </h3>
                    {/* Multi-color Bar */}
                    <div className="h-3 w-full rounded-full bg-zinc-800 overflow-hidden flex shadow-inner">
                      {report.metrics.languages.map((l, idx) => (
                        <div
                          key={idx}
                          style={{
                            width: `${Math.max(l.percentage, 1)}%`,
                            backgroundColor: l.color,
                          }}
                          className="h-full transition-all hover:brightness-125"
                          title={`${l.language}: ${l.percentage}% (${l.file_count} files)`}
                        />
                      ))}
                    </div>

                    {/* Language Pills */}
                    <div className="flex flex-wrap gap-3 pt-1">
                      {report.metrics.languages.map((l, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: l.color }}
                          />
                          <span className="font-semibold text-zinc-200">{l.language}</span>
                          <span className="text-zinc-500 font-code">{l.percentage}%</span>
                          <span className="text-zinc-600 text-[11px]">({l.file_count} files)</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Languages Detailed Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {report.metrics.languages.map((l, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: l.color }}
                            />
                            <h4 className="text-sm font-bold text-white">{l.language}</h4>
                          </div>
                          <span className="font-code text-xs font-bold text-purple-400">
                            {l.percentage}%
                          </span>
                        </div>
                        <div className="space-y-1 text-xs text-zinc-400 font-code">
                          <div className="flex justify-between">
                            <span>Files:</span>
                            <span className="text-zinc-200">{l.file_count}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Lines of Code:</span>
                            <span className="text-zinc-200">{l.line_count.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Size:</span>
                            <span className="text-zinc-200">
                              {(l.byte_size / 1024).toFixed(1)} KB
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Detected Manifests */}
                  {report.manifests.length > 0 && (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-3">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-cyan-400" />
                        Project Manifests & Configuration
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {report.manifests.map((m, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              if (onInspectFile) {
                                onInspectFile(m);
                                onClose();
                              }
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-xs font-code text-zinc-200 cursor-pointer transition-colors"
                          >
                            <FileCode className="w-3.5 h-3.5 text-zinc-400" />
                            <span>{m}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: DEPENDENCIES */}
              {activeTab === 'dependencies' && (
                <div className="space-y-4 animate-fade-in">
                  {/* Search and Filters */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-900/50">
                    <div className="relative w-full sm:w-72">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                      <input
                        type="text"
                        placeholder="Search dependencies..."
                        value={depSearch}
                        onChange={(e) => setDepSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-zinc-800/80 border border-zinc-700/60 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-colors"
                      />
                    </div>

                    <div className="flex items-center gap-1 self-end sm:self-auto">
                      {(['all', 'runtime', 'dev'] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setDepFilter(type)}
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                            depFilter === type
                              ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dependency List Table */}
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400 font-semibold uppercase tracking-wider">
                          <th className="px-4 py-3">Package Name</th>
                          <th className="px-4 py-3">Version</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Type</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {filteredDeps.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                              No dependencies found matching filters.
                            </td>
                          </tr>
                        ) : (
                          filteredDeps.map((dep, idx) => (
                            <tr key={idx} className="hover:bg-zinc-800/40 transition-colors font-code">
                              <td className="px-4 py-2.5 font-medium text-zinc-200">
                                {dep.name}
                              </td>
                              <td className="px-4 py-2.5 text-purple-300">
                                {dep.version}
                              </td>
                              <td className="px-4 py-2.5 font-sans">
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 border border-zinc-700 text-zinc-300">
                                  {dep.category}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 font-sans">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                                    dep.type === 'runtime'
                                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                      : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                                  }`}
                                >
                                  {dep.type}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Project Scripts if available */}
                  {Object.keys(report.scripts).length > 0 && (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-3">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-emerald-400" />
                        Detected Run & Build Scripts
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {Object.entries(report.scripts).map(([name, cmd], idx) => (
                          <div
                            key={idx}
                            className="rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 font-code text-xs flex flex-col justify-between"
                          >
                            <span className="font-semibold text-zinc-300">{name}</span>
                            <span className="text-zinc-500 truncate mt-1 text-[11px]">{cmd}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: MODULES & ENTRY POINTS */}
              {activeTab === 'modules' && (
                <div className="space-y-6 animate-fade-in">
                  {/* Entry Points Section */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-purple-400" />
                      Primary Application Entry Points
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {report.entry_points.length === 0 ? (
                        <p className="text-xs text-zinc-500">Standard structure entry points.</p>
                      ) : (
                        report.entry_points.map((entry, idx) => (
                          <div
                            key={idx}
                            className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 flex flex-col justify-between hover:border-zinc-700 transition-colors"
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-bold text-white font-code truncate">
                                  {entry.file_path}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                  {entry.language}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-400">{entry.description}</p>
                            </div>
                            <div className="pt-3">
                              <button
                                type="button"
                                onClick={() => {
                                  if (onInspectFile) {
                                    onInspectFile(entry.file_path);
                                    onClose();
                                  }
                                }}
                                className="flex items-center gap-1 text-xs font-semibold text-purple-300 hover:text-purple-200 transition-colors cursor-pointer"
                              >
                                <span>Inspect in CodeViewer</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Key Directories Section */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                      <FolderTree className="w-4 h-4 text-indigo-400" />
                      Key Directory Layout
                    </h3>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse font-code">
                        <thead>
                          <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400 font-semibold uppercase tracking-wider font-sans">
                            <th className="px-4 py-3">Directory</th>
                            <th className="px-4 py-3">File Count</th>
                            <th className="px-4 py-3">Role / Purpose</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60">
                          {report.key_directories.map((dir, idx) => (
                            <tr key={idx} className="hover:bg-zinc-800/40 transition-colors">
                              <td className="px-4 py-2.5 font-bold text-purple-300">
                                {dir.path}/
                              </td>
                              <td className="px-4 py-2.5 text-zinc-400">
                                {dir.file_count} files
                              </td>
                              <td className="px-4 py-2.5 text-zinc-300 font-sans">
                                {dir.description}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Detected API Endpoints */}
                  {report.detected_apis.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-emerald-400" />
                        Identified API Endpoints & Routes
                      </h3>
                      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden max-h-72 overflow-y-auto">
                        <table className="w-full text-left text-xs border-collapse font-code">
                          <tbody className="divide-y divide-zinc-800/60">
                            {report.detected_apis.map((api, idx) => (
                              <tr key={idx} className="hover:bg-zinc-800/40 transition-colors">
                                <td className="px-4 py-2 w-20">
                                  <span
                                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      api.method === 'GET'
                                        ? 'bg-emerald-500/20 text-emerald-300'
                                        : api.method === 'POST'
                                        ? 'bg-blue-500/20 text-blue-300'
                                        : api.method === 'DELETE'
                                        ? 'bg-red-500/20 text-red-300'
                                        : 'bg-amber-500/20 text-amber-300'
                                    }`}
                                  >
                                    {api.method}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-zinc-200 font-medium">
                                  {api.path}
                                </td>
                                <td className="px-4 py-2 text-zinc-500 text-right">
                                  {api.file}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
