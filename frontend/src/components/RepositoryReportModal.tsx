import { useState, useMemo } from 'react';
import type { Repository, RepositoryFile, RepositoryReport } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import {
  X,
  Copy,
  Check,
  Download,
  RefreshCw,
  ExternalLink,
  Sparkles,
  AlertTriangle,
  ArrowRight,
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
    const lang = ext === '.ts' ? 'TypeScript' : ext === '.tsx' ? 'TSX' : ext === '.js' ? 'JavaScript' : ext === '.jsx' ? 'JSX' : ext === '.py' ? 'Python' : ext === '.json' ? 'JSON' : ext === '.html' ? 'HTML' : ext === '.css' ? 'CSS' : ext === '.scss' ? 'SCSS' : ext === '.sql' ? 'SQL' : ext === '.sh' || ext === '.bash' ? 'Shell' : ext === '.go' ? 'Go' : ext === '.rs' ? 'Rust' : ext === '.java' ? 'Java' : ext === '.md' ? 'Markdown' : f.language || 'Other';
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

  const colors: Record<string, string> = {
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
    'C++': '#f34b7d',
    C: '#555555',
    YAML: '#cb171e',
    Other: '#71717a',
  };

  const languages = Object.entries(langCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([lang, count]) => ({
      language: lang,
      file_count: count,
      line_count: langLines[lang] || 0,
      byte_size: 0,
      percentage: Number(((count / Math.max(totalFiles, 1)) * 100).toFixed(1)),
      color: colors[lang] || colors.Other,
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
  const [copied, setCopied] = useState(false);

  const report = useMemo<RepositoryReport | null>(() => {
    if (serverReport) return serverReport;
    if (activeRepo && repoFiles && repoFiles.length > 0) {
      return generateClientReport(activeRepo, repoFiles);
    }
    return null;
  }, [serverReport, activeRepo, repoFiles]);

  const isClientSynthesized = Boolean(!serverReport && report);

  const fullMarkdown = useMemo(() => {
    if (!report) return '';
    const primaryLang = report.metrics.languages[0];
    const primaryColor = (primaryLang?.color || '#71717a').replace('#', '');
    const langName = primaryLang?.language || 'Code';
    const langSlug = langName.toLowerCase().replace(/[^a-z0-9]/g, '');

    const badges = [
      `![${encodeURIComponent(langName)}](https://img.shields.io/badge/${encodeURIComponent(langName)}-${primaryColor}?logo=${langSlug}&logoColor=white)`,
      `![Files](https://img.shields.io/badge/${report.metrics.total_files}%20files-blue)`,
      report.branch ? `![Branch](https://img.shields.io/badge/branch-${encodeURIComponent(report.branch)}-lightgrey)` : '',
    ].filter(Boolean).join(' ');

    const rawTagline = report.ai_analysis.executive_summary.replace(/\s+/g, ' ').trim();
    const tagline = rawTagline.length > 140 ? rawTagline.slice(0, 137).trimEnd() + '...' : rawTagline;
    const shortSummary = report.ai_analysis.executive_summary;

    const frameworks = report.dependencies.filter(d => d.category === 'Framework & Runtime').map(d => d.name).join(', ') || 'None detected';
    const dbs = report.dependencies.filter(d => d.category === 'Database & Store').map(d => d.name).join(', ') || 'None detected';
    const auths = report.dependencies.filter(d => d.category === 'Auth & Security').map(d => d.name).join(', ') || 'None detected';
    const testing = report.dependencies.filter(d => d.category === 'Testing & QA').map(d => d.name).join(', ') || 'None detected';
    const ai_ml = report.dependencies.filter(d => d.category === 'AI & Machine Learning').map(d => d.name).join(', ') || 'None detected';
    const ui = report.dependencies.filter(d => d.category === 'UI & Styling').map(d => d.name).join(', ') || 'None detected';

    const maxDirLen = Math.max(...report.key_directories.map(d => d.path.length), 8);
    const treeLines = report.key_directories.slice(0, 15).map(d => {
      const pad = ' '.repeat(Math.max(0, maxDirLen - d.path.length));
      return `  ${d.path}/${pad} ${'.'.repeat(Math.max(3, 36 - d.path.length - pad.length))} ${d.file_count} files`;
    });
    const fileTree = `${report.repo_name}/\n${treeLines.join('\n')}`;

    const entriesList = report.entry_points.map((e, i) => `${i + 1}. **\`${e.file_path}\`** (${e.language}): ${e.description}`).join('\n');

    const apisByMethod = report.detected_apis.reduce((acc, api) => {
      if (!acc[api.method]) acc[api.method] = [];
      if (!acc[api.method].includes(api.path)) acc[api.method].push(api.path);
      return acc;
    }, {} as Record<string, string[]>);
    const apiSections = Object.entries(apisByMethod).map(([method, paths]) => {
      return `### ${method}\n${paths.map(p => `- \`${p}\``).join('\n')}`;
    }).join('\n\n');

    const runtimeDeps = report.dependencies.filter(d => d.type === 'runtime');
    const devDeps = report.dependencies.filter(d => d.type === 'dev');

    const renderDepGroup = (deps: typeof report.dependencies) => {
      const grouped = deps.reduce((acc, d) => {
        const cat = d.category || 'Utility & Tooling';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(d);
        return acc;
      }, {} as Record<string, typeof report.dependencies>);
      return Object.entries(grouped).map(([cat, items]) => {
        const list = items.map(d => `- **${d.name}** — \`${d.version}\``).join('\n');
        return `#### ${cat}\n${list}`;
      }).join('\n\n');
    };

    const runtimeSection = runtimeDeps.length > 0 ? renderDepGroup(runtimeDeps) : '_No runtime dependencies detected._';
    const devSection = devDeps.length > 0 ? renderDepGroup(devDeps) : '_No development dependencies detected._';

    const prerequisitesList = (report.ai_analysis.prerequisites || []).map(p => `- ${p}`).join('\n');
    const setupSteps = (report.ai_analysis.setup_instructions || []).map((s, i) => `${i + 1}. ${s}`).join('\n');
    const configList = (report.ai_analysis.configuration_environment || []).map(c => `- ${c}`).join('\n');
    const quickStart = report.ai_analysis.quick_start || '';

    const secPerfList = report.ai_analysis.security_and_performance.map(s => `- **${s.aspect}**: ${s.observation}${s.recommendation ? ` — *Recommendation: ${s.recommendation}*` : ''}`).join('\n');

    const exploreQuestions = (report.ai_analysis.recommended_questions || []).map(q => `- ${q}`).join('\n');

    const featuresList = report.ai_analysis.key_features.map(f => `- **${f.title}**: ${f.description}`).join('\n');

    const langTable = `| Language | Files | Lines | Size | Share |\n|----------|------:|------:|-----:|------:|\n${report.metrics.languages.map(l => `| ${l.language} | ${l.file_count} | ${l.line_count.toLocaleString()} | ${(l.byte_size / 1024).toFixed(1)} KB | ${l.percentage}% |`).join('\n')}`;

    return `# ${report.repo_name}

${badges}

> ${tagline}

---

## Overview

${shortSummary}

${featuresList ? `### Key Features\n${featuresList}\n` : ''}

---

## Tech Stack

${report.ai_analysis.tech_stack_summary || 'No tech stack summary available'}

| Category | Technologies |
|----------|-------------|
| Languages | ${report.metrics.languages.slice(0, 5).map(l => l.language).join(', ') || 'Mixed'} |
| Frameworks & Runtime | ${frameworks} |
| Databases & Storage | ${dbs} |
| Auth & Security | ${auths} |
| Testing & QA | ${testing} |
| AI & Machine Learning | ${ai_ml} |
| UI & Styling | ${ui} |

### Language Breakdown

${langTable}

---

## Architecture

${report.ai_analysis.top_level_architecture ? `### High-Level Architecture\n\n${report.ai_analysis.top_level_architecture}\n` : ''}

${report.ai_analysis.repository_layout ? `### Repository Layout\n\n${report.ai_analysis.repository_layout}\n` : ''}

${report.ai_analysis.architecture_deep_dive}

${report.ai_analysis.backend_description ? `### Backend\n\n${report.ai_analysis.backend_description}\n` : ''}
${report.ai_analysis.frontend_apis_description ? `### Frontend APIs\n\n${report.ai_analysis.frontend_apis_description}\n` : ''}

---

## Project Structure

\`\`\`
${fileTree}
\`\`\`

### Entry Points

${entriesList || '_No explicit entry points detected._'}

---

## API Endpoints

${apiSections || '_No API endpoints detected._'}

---

## Dependencies

### Runtime Dependencies

${runtimeSection}

### Development Dependencies

${devSection}

---

## Getting Started

${prerequisitesList ? `### Prerequisites\n${prerequisitesList}\n` : ''}

${setupSteps ? `### Installation\n\n${setupSteps}\n` : ''}

${configList ? `### Configuration\n\n${configList}\n` : ''}

${quickStart ? `### Quick Start\n\n${quickStart}\n` : ''}

---

## Security & Performance Notes

${secPerfList || '_No specific observations._'}

---

## Explore This Codebase

${exploreQuestions || '_No recommended questions._'}

---

*Generated by Sourcefinch on ${new Date(report.generated_at).toLocaleString()}*
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-black/60 backdrop-blur-sm animate-fade-in font-sans-ui select-text">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-sm font-semibold text-white truncate">
              {report ? report.repo_name : 'Repository Report'}
            </h2>
            {report && (
              <span className="hidden sm:inline-flex items-center gap-2 text-[11px] text-zinc-500 font-code shrink-0">
                <span>{report.branch}</span>
                <span>·</span>
                <span>{report.metrics.total_files} files</span>
                <span>·</span>
                <span>{report.metrics.total_lines.toLocaleString()} lines</span>
              </span>
            )}
            {isClientSynthesized && (
              <span className="rounded-md bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 shrink-0">
                Client-Side Analysis
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleCopyMarkdown}
              disabled={isLoading || !report}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-300 transition-colors cursor-pointer disabled:opacity-40"
              title="Copy full report as Markdown"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Copy</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleDownloadMarkdown}
              disabled={isLoading || !report}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-300 transition-colors cursor-pointer disabled:opacity-40"
              title="Download report as .md"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-300 transition-colors cursor-pointer disabled:opacity-40"
              title="Re-run intelligence analysis"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isLoading ? 'Analyzing...' : 'Regenerate'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Close report"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center flex-1 p-8 text-center">
            <div className="relative flex items-center justify-center w-12 h-12 mb-4">
              <div className="absolute inset-0 rounded-full border border-zinc-700 border-t-zinc-400 animate-spin" />
              <Sparkles className="w-5 h-5 text-zinc-400 animate-pulse" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">
              Analyzing Codebase & Synthesizing Report
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm">
              Scanning language distributions, parsing dependencies, and synthesizing architectural intelligence...
            </p>
          </div>
        )}

        {/* Error / Empty */}
        {!isLoading && !report && (
          <div className="flex flex-col items-center justify-center flex-1 p-8 text-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white mb-2">
              Unable to Load Repository Intelligence Report
            </h3>
            <p className="text-xs text-zinc-500 max-w-md mb-6 leading-relaxed">
              {errorMessage || 'The report could not be generated. Please make sure your repository is selected and indexed, then click Retry.'}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onRefresh}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Analysis</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-md border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Report Content */}
        {!isLoading && report && (
          <div className="flex-1 overflow-y-auto">
            <div className="px-6 py-6 space-y-8 text-zinc-300 text-[13px] leading-relaxed">
              {/* Title & Meta */}
              <section>
                <h1 className="text-lg font-bold text-white mb-1">
                  {report.repo_name}
                </h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500 font-code">
                  <span>Owner: {report.owner || '—'}</span>
                  <span>·</span>
                  <span>Branch: {report.branch}</span>
                  <span>·</span>
                  <span>Generated: {new Date(report.generated_at).toLocaleString()}</span>
                </div>
              </section>

              {/* Executive Summary */}
              <section className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Executive Summary</h2>
                <p className="text-zinc-200">{report.ai_analysis.executive_summary}</p>
                <p className="text-zinc-400">
                  <span className="text-zinc-500">Architecture:</span> {report.ai_analysis.architecture_style}
                </p>
              </section>

              {/* Tech Stack */}
              {report.ai_analysis.tech_stack_summary && (
                <section className="space-y-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Tech Stack</h2>
                  <p className="text-zinc-300 text-xs leading-relaxed">{report.ai_analysis.tech_stack_summary}</p>
                </section>
              )}

              {/* Top-Level Architecture */}
              {report.ai_analysis.top_level_architecture && (
                <section className="space-y-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Top-Level Architecture</h2>
                  <p className="text-zinc-300 text-xs leading-relaxed">{report.ai_analysis.top_level_architecture}</p>
                </section>
              )}

              {/* Repository Layout */}
              {report.ai_analysis.repository_layout && (
                <section className="space-y-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Repository Layout</h2>
                  <p className="text-zinc-300 text-xs leading-relaxed">{report.ai_analysis.repository_layout}</p>
                </section>
              )}

              {/* Quick Start */}
              {report.ai_analysis.quick_start && (
                <section className="space-y-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Quick Start</h2>
                  <p className="text-zinc-300 text-xs leading-relaxed whitespace-pre-line">{report.ai_analysis.quick_start}</p>
                </section>
              )}

              {/* Prerequisites */}
              {report.ai_analysis.prerequisites && report.ai_analysis.prerequisites.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Prerequisites</h2>
                  <ul className="list-disc list-inside text-xs text-zinc-300 space-y-1">
                    {report.ai_analysis.prerequisites.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Setup Instructions */}
              {report.ai_analysis.setup_instructions && report.ai_analysis.setup_instructions.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Setup</h2>
                  <ol className="list-decimal list-inside text-xs text-zinc-300 space-y-1">
                    {report.ai_analysis.setup_instructions.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ol>
                </section>
              )}

              {/* Configuration & Environment */}
              {report.ai_analysis.configuration_environment && report.ai_analysis.configuration_environment.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Configuration & Environment</h2>
                  <ul className="list-disc list-inside text-xs text-zinc-300 space-y-1">
                    {report.ai_analysis.configuration_environment.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Backend */}
              {report.ai_analysis.backend_description && (
                <section className="space-y-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Backend</h2>
                  <p className="text-zinc-300 text-xs leading-relaxed">{report.ai_analysis.backend_description}</p>
                </section>
              )}

              {/* Frontend APIs */}
              {report.ai_analysis.frontend_apis_description && (
                <section className="space-y-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Frontend APIs</h2>
                  <p className="text-zinc-300 text-xs leading-relaxed">{report.ai_analysis.frontend_apis_description}</p>
                </section>
              )}

              {/* Metrics Overview Table */}
              <section className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Repository Metrics</h2>
                <table className="w-full text-left border border-zinc-800 rounded-md overflow-hidden text-xs">
                  <tbody className="divide-y divide-zinc-800">
                    <tr>
                      <td className="px-3 py-2 text-zinc-500 w-40">Total Files</td>
                      <td className="px-3 py-2 text-zinc-200 font-medium">{report.metrics.total_files.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-zinc-500">Total Lines</td>
                      <td className="px-3 py-2 text-zinc-200 font-medium">{report.metrics.total_lines.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-zinc-500">Total Size</td>
                      <td className="px-3 py-2 text-zinc-200 font-medium">{(report.metrics.total_size_bytes / 1024).toFixed(1)} KB</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-zinc-500">Languages</td>
                      <td className="px-3 py-2 text-zinc-200 font-medium">{report.metrics.languages.length}</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-zinc-500">Dependencies</td>
                      <td className="px-3 py-2 text-zinc-200 font-medium">{report.dependencies.length}</td>
                    </tr>
                  </tbody>
                </table>
              </section>

              {/* Languages Table */}
              {report.metrics.languages.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Languages</h2>
                  <table className="w-full text-left border border-zinc-800 rounded-md overflow-hidden text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/60 text-zinc-400">
                        <th className="px-3 py-2 font-medium">Language</th>
                        <th className="px-3 py-2 font-medium text-right">Files</th>
                        <th className="px-3 py-2 font-medium text-right">Lines</th>
                        <th className="px-3 py-2 font-medium text-right">Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {report.metrics.languages.map((l, idx) => (
                        <tr key={idx} className="hover:bg-zinc-900/40">
                          <td className="px-3 py-2 text-zinc-200 font-medium">{l.language}</td>
                          <td className="px-3 py-2 text-zinc-400 text-right font-code">{l.file_count}</td>
                          <td className="px-3 py-2 text-zinc-400 text-right font-code">{l.line_count.toLocaleString()}</td>
                          <td className="px-3 py-2 text-zinc-400 text-right font-code w-24">{l.percentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}

              {/* Directories Table */}
              {report.key_directories.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Key Directories</h2>
                  <table className="w-full text-left border border-zinc-800 rounded-md overflow-hidden text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/60 text-zinc-400">
                        <th className="px-3 py-2 font-medium">Directory</th>
                        <th className="px-3 py-2 font-medium text-right">Files</th>
                        <th className="px-3 py-2 font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {report.key_directories.map((d, idx) => (
                        <tr key={idx} className="hover:bg-zinc-900/40">
                          <td className="px-3 py-2 text-zinc-200 font-medium font-code">{d.path}/</td>
                          <td className="px-3 py-2 text-zinc-400 text-right font-code">{d.file_count}</td>
                          <td className="px-3 py-2 text-zinc-400">{d.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}

              {/* Dependencies Table */}
              {report.dependencies.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Dependencies</h2>
                  <div className="border border-zinc-800 rounded-md overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-zinc-800 bg-zinc-900/60 text-zinc-400">
                          <th className="px-3 py-2 font-medium">Package</th>
                          <th className="px-3 py-2 font-medium">Version</th>
                          <th className="px-3 py-2 font-medium">Category</th>
                          <th className="px-3 py-2 font-medium">Type</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800">
                        {report.dependencies.map((dep, idx) => (
                          <tr key={idx} className="hover:bg-zinc-900/40">
                            <td className="px-3 py-2 text-zinc-200 font-medium font-code">{dep.name}</td>
                            <td className="px-3 py-2 text-zinc-400 font-code">{dep.version}</td>
                            <td className="px-3 py-2 text-zinc-400">{dep.category}</td>
                            <td className="px-3 py-2 text-zinc-500">{dep.type}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Entry Points */}
              {report.entry_points.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Entry Points</h2>
                  <ul className="space-y-1.5">
                    {report.entry_points.map((entry, idx) => (
                      <li key={idx} className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <span className="text-zinc-200 font-medium font-code text-xs">{entry.file_path}</span>
                          <span className="text-zinc-500 text-xs ml-2">{entry.description}</span>
                        </div>
                        {onInspectFile && (
                          <button
                            type="button"
                            onClick={() => {
                              onInspectFile(entry.file_path);
                              onClose();
                            }}
                            className="shrink-0 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                            title="Inspect in CodeViewer"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Detected APIs */}
              {report.detected_apis.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Detected API Endpoints</h2>
                  <table className="w-full text-left border border-zinc-800 rounded-md overflow-hidden text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/60 text-zinc-400">
                        <th className="px-3 py-2 font-medium w-16">Method</th>
                        <th className="px-3 py-2 font-medium">Path</th>
                        <th className="px-3 py-2 font-medium text-right">File</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {report.detected_apis.map((api, idx) => (
                        <tr key={idx} className="hover:bg-zinc-900/40">
                          <td className="px-3 py-2">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              api.method === 'GET' ? 'bg-emerald-500/15 text-emerald-400' :
                              api.method === 'POST' ? 'bg-blue-500/15 text-blue-400' :
                              api.method === 'DELETE' ? 'bg-red-500/15 text-red-400' :
                              'bg-amber-500/15 text-amber-400'
                            }`}>
                              {api.method}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-zinc-200 font-code">{api.path}</td>
                          <td className="px-3 py-2 text-zinc-500 text-right font-code truncate max-w-[200px]">{api.file}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}

              {/* Architecture Deep Dive */}
              <section className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Architecture Deep Dive</h2>
                <div className="text-zinc-300 prose prose-invert max-w-none text-xs leading-relaxed">
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
              </section>

              {/* Key Features */}
              {report.ai_analysis.key_features.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Key Features</h2>
                  <ul className="space-y-1.5 list-disc list-inside text-zinc-300">
                    {report.ai_analysis.key_features.map((feat, idx) => (
                      <li key={idx}>
                        <span className="text-zinc-200 font-medium">{feat.title}</span>
                        <span className="text-zinc-500"> — {feat.description}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Security & Performance */}
              {report.ai_analysis.security_and_performance.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Security, Performance & Quality</h2>
                  <ul className="space-y-1.5">
                    {report.ai_analysis.security_and_performance.map((sec, idx) => (
                      <li key={idx} className="text-zinc-300">
                        <span className="text-zinc-200 font-medium">{sec.aspect}</span>
                        <span className="text-zinc-500"> — {sec.observation}</span>
                        {sec.recommendation && (
                          <span className="text-zinc-600 italic"> (Tip: {sec.recommendation})</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Onboarding */}
              {report.ai_analysis.onboarding_guide.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Developer Quickstart</h2>
                  <ol className="space-y-1.5 list-decimal list-inside text-zinc-300">
                    {report.ai_analysis.onboarding_guide.map((step, idx) => (
                      <li key={idx}>
                        <span className="text-zinc-200 font-medium">{step.title}</span>
                        <span className="text-zinc-500"> — {step.detail}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {/* Suggested Questions */}
              {report.ai_analysis.recommended_questions.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Explore Further with AI</h2>
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
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-300 transition-colors cursor-pointer"
                      >
                        <span>{q}</span>
                        <ArrowRight className="w-3 h-3 text-zinc-500" />
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
