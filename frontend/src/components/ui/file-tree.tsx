/**
 * FileTree component — Replit & 21st.dev/@justinlevinedotme/components/file-tree inspired.
 *
 * Provides an interactive, recursive folder tree hierarchy with:
 *   - Folder expanding / collapsing with smooth transitions
 *   - File search & filtering
 *   - Filetype-specific icon indicators (TS, JS, CSS, JSON, Python, etc.)
 *   - File size badges
 *   - Expand all / Collapse all controls
 *   - Selection handlers to view source code in CodeViewer
 */

import React, { useState, useMemo, createContext, useContext, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { RepositoryFile } from '../../types';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileJson,
  FileSpreadsheet,
  FileImage,
  ChevronRight,
  Search,
  ChevronsUpDown,
  X,
  FolderTree,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ── Tree Data Structures ────────────────────────────────────────────────────
export interface TreeNode {
  id: string;
  name: string;
  path: string;
  isFolder: boolean;
  children?: TreeNode[];
  fileData?: RepositoryFile;
}

interface TreeContextValue {
  expandedIds: Set<string>;
  toggleFolder: (id: string) => void;
  selectedPath: string | null;
  onSelectFile?: (file: RepositoryFile) => void;
}

const TreeContext = createContext<TreeContextValue | null>(null);

function useTree() {
  const ctx = useContext(TreeContext);
  if (!ctx) throw new Error('useTree must be used within a Tree provider');
  return ctx;
}

// ── Helper: Build Nested Tree from Flat File Paths ──────────────────────────
export function buildTreeFromFiles(files: RepositoryFile[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const cleanPath = file.file_path.replace(/^\//, '');
    const parts = cleanPath.split('/');
    let currentLevel = root;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFolder = i < parts.length - 1;

      let existing = currentLevel.find((node) => node.name === part && node.isFolder === isFolder);

      if (!existing) {
        existing = {
          id: currentPath,
          name: part,
          path: currentPath,
          isFolder,
          children: isFolder ? [] : undefined,
          fileData: isFolder ? undefined : file,
        };
        currentLevel.push(existing);
      }

      if (isFolder) {
        currentLevel = existing.children!;
      }
    }
  }

  // Sort: folders first (alphabetical), then files (alphabetical)
  const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
    nodes.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
    for (const node of nodes) {
      if (node.children) sortNodes(node.children);
    }
    return nodes;
  };

  return sortNodes(root);
}

// ── Helper: File Icon Resolver ──────────────────────────────────────────────
export function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  switch (ext) {
    case 'ts':
    case 'tsx':
      return <span className="text-blue-500 font-bold text-[10px] font-code">TS</span>;
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return <span className="text-amber-500 font-bold text-[10px] font-code">JS</span>;
    case 'json':
      return <FileJson className="w-3.5 h-3.5 text-amber-500/90" />;
    case 'css':
    case 'scss':
    case 'less':
      return <span className="text-sky-500 font-bold text-[10px] font-code">#</span>;
    case 'html':
      return <span className="text-orange-500 font-bold text-[10px] font-code">&lt;&gt;</span>;
    case 'md':
    case 'mdx':
    case 'txt':
    case 'doc':
      return <FileText className="w-3.5 h-3.5 text-zinc-400" />;
    case 'py':
      return <span className="text-emerald-500 font-bold text-[10px] font-code">PY</span>;
    case 'rs':
      return <span className="text-orange-600 font-bold text-[10px] font-code">RS</span>;
    case 'go':
      return <span className="text-cyan-500 font-bold text-[10px] font-code">GO</span>;
    case 'sql':
      return <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-400" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return <FileImage className="w-3.5 h-3.5 text-purple-400" />;
    default:
      return <FileCode className="w-3.5 h-3.5 text-zinc-400" />;
  }
}

// ── Tree Item (Folder / File Recursive Item) ────────────────────────────────
function TreeItem({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const { expandedIds, toggleFolder, selectedPath, onSelectFile } = useTree();
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedPath === node.path;

  if (node.isFolder) {
    return (
      <div className="select-none font-sans-ui text-xs">
        <button
          type="button"
          onClick={() => toggleFolder(node.id)}
          style={{ paddingLeft: `${Math.max(depth * 14 + 6, 6)}px` }}
          className={cn(
            'w-full flex items-center gap-1.5 py-1.5 pr-2 rounded-lg text-left transition-colors cursor-pointer group',
            'hover:bg-zinc-100 dark:hover:bg-white/[0.05] text-zinc-700 dark:text-zinc-300'
          )}
        >
          <ChevronRight
            className={cn(
              'w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 transition-transform duration-150 shrink-0',
              isExpanded && 'rotate-90 text-zinc-700 dark:text-zinc-300'
            )}
          />
          {isExpanded ? (
            <FolderOpen className="w-4 h-4 text-orange-500 shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-orange-500/80 shrink-0" />
          )}
          <span className="font-medium truncate text-zinc-800 dark:text-zinc-200">{node.name}</span>
        </button>

        <AnimatePresence initial={false}>
          {isExpanded && node.children && node.children.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="overflow-hidden border-l border-zinc-200/80 dark:border-white/[0.06] ml-4"
            >
              {node.children.map((child) => (
                <TreeItem key={child.id} node={child} depth={depth + 1} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // File item
  return (
    <div className="select-none font-sans-ui text-xs">
      <button
        type="button"
        onClick={() => node.fileData && onSelectFile?.(node.fileData)}
        style={{ paddingLeft: `${Math.max(depth * 14 + 6, 6)}px` }}
        className={cn(
          'w-full flex items-center justify-between py-1.5 pr-2 rounded-lg text-left transition-colors cursor-pointer group',
          isSelected
            ? 'bg-orange-500/10 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 font-semibold'
            : 'hover:bg-zinc-100 dark:hover:bg-white/[0.05] text-zinc-700 dark:text-zinc-300'
        )}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          <div className="w-4 h-4 flex items-center justify-center shrink-0">
            {getFileIcon(node.name)}
          </div>
          <span className="truncate font-code text-[12px]">{node.name}</span>
        </div>

        {node.fileData?.file_size ? (
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-code shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {node.fileData.file_size > 1024
              ? `${(node.fileData.file_size / 1024).toFixed(1)} KB`
              : `${node.fileData.file_size} B`}
          </span>
        ) : null}
      </button>
    </div>
  );
}

// ── Main FileTree Component ────────────────────────────────────────────────
export interface FileTreeProps {
  files: RepositoryFile[];
  isLoading?: boolean;
  selectedPath?: string | null;
  onSelectFile?: (file: RepositoryFile) => void;
  className?: string;
  repoName?: string;
}

export function FileTree({
  files,
  isLoading = false,
  selectedPath = null,
  onSelectFile,
  className,
  repoName,
}: FileTreeProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  // Convert flat files into tree
  const tree = useMemo(() => buildTreeFromFiles(files), [files]);

  // Initial expand: expand top level folders automatically
  React.useEffect(() => {
    if (tree.length > 0 && expandedIds.size === 0) {
      const initial = new Set<string>();
      for (const node of tree) {
        if (node.isFolder) initial.add(node.id);
      }
      setExpandedIds(initial);
    }
  }, [tree]);

  const toggleFolder = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    const all = new Set<string>();
    const collect = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.isFolder) {
          all.add(node.id);
          if (node.children) collect(node.children);
        }
      }
    };
    collect(tree);
    setExpandedIds(all);
  }, [tree]);

  const handleCollapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  // Filter tree based on search query
  const filteredTree = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tree;

    const filterNodes = (nodes: TreeNode[]): TreeNode[] => {
      const result: TreeNode[] = [];
      for (const node of nodes) {
        if (node.isFolder) {
          const matchingChildren = node.children ? filterNodes(node.children) : [];
          if (matchingChildren.length > 0 || node.name.toLowerCase().includes(q)) {
            result.push({ ...node, children: matchingChildren });
          }
        } else if (node.name.toLowerCase().includes(q) || node.path.toLowerCase().includes(q)) {
          result.push(node);
        }
      }
      return result;
    };

    return filterNodes(tree);
  }, [tree, searchQuery]);

  // Auto-expand all when searching
  React.useEffect(() => {
    if (searchQuery.trim()) {
      handleExpandAll();
    }
  }, [searchQuery, handleExpandAll]);

  const contextValue = useMemo(
    () => ({
      expandedIds,
      toggleFolder,
      selectedPath,
      onSelectFile,
    }),
    [expandedIds, toggleFolder, selectedPath, onSelectFile]
  );

  return (
    <TreeContext.Provider value={contextValue}>
      <div className={cn('flex flex-col h-full overflow-hidden font-sans-ui', className)}>
        {/* Header toolbar */}
        <div className="p-3 border-b border-zinc-200/80 dark:border-white/[0.06] space-y-2 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <FolderTree className="w-4 h-4 text-orange-500" />
              <span className="text-[13px] font-semibold text-zinc-900 dark:text-white">
                {repoName ? repoName : 'Repository Files'}
              </span>
              <span className="font-code text-[11px] rounded-md bg-zinc-100 dark:bg-white/[0.06] px-1.5 py-0.5 text-zinc-500 dark:text-zinc-400 font-medium">
                {files.length}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={expandedIds.size > 0 ? handleCollapseAll : handleExpandAll}
                title={expandedIds.size > 0 ? 'Collapse All' : 'Expand All'}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <ChevronsUpDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter files..."
              className="w-full rounded-lg border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-2.5 py-1.5 pl-7 text-xs text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-zinc-400 dark:focus:border-white/[0.15] focus:outline-none transition-colors font-sans-ui shadow-2xs"
            />
            <Search className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Tree List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {isLoading ? (
            <div className="p-3 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-6 rounded-md bg-zinc-100 dark:bg-white/[0.04] animate-pulse" />
              ))}
            </div>
          ) : filteredTree.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
              {searchQuery ? 'No files match your filter.' : 'No files found in this repository.'}
            </div>
          ) : (
            filteredTree.map((node) => <TreeItem key={node.id} node={node} />)
          )}
        </div>
      </div>
    </TreeContext.Provider>
  );
}

export default FileTree;
