import { useState, useCallback } from 'react';
import type { RepositoryFile } from '../types';
import { useApiClient } from '../services/useApiClient';

interface UseFileExplorerOptions {
  selectedRepoId: number | null;
  onCodeViewerClose?: () => void;
}

export function useFileExplorer({
  selectedRepoId,
  onCodeViewerClose,
}: UseFileExplorerOptions) {
  const api = useApiClient();

  const [repoFiles, setRepoFiles] = useState<RepositoryFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [selectedFile, setSelectedFile] = useState<RepositoryFile | null>(null);
  const [isLoadingFileContent, setIsLoadingFileContent] = useState(false);
  const [isFileTreeOpen, setIsFileTreeOpen] = useState(false);

  const fetchRepoFiles = useCallback(
    async (repoId: number) => {
      setIsLoadingFiles(true);
      try {
        const files = await api.getRepositoryFiles(repoId);
        setRepoFiles(files);
      } catch (err: any) {
        console.error('Failed to load repo files:', err);
      } finally {
        setIsLoadingFiles(false);
      }
    },
    [api]
  );

  const handleSelectFile = useCallback(
    async (file: RepositoryFile) => {
      if (file.content) {
        setSelectedFile(file);
        return;
      }
      if (!selectedRepoId) return;

      setIsLoadingFileContent(true);
      setSelectedFile(file); // show file metadata immediately for responsiveness

      try {
        const fullFile = await api.getFileContent(selectedRepoId, file.id);
        setSelectedFile(fullFile);
        setRepoFiles((prev) =>
          prev.map((f) => (f.id === file.id ? { ...f, content: fullFile.content } : f))
        );
      } catch (err: any) {
        console.error('Failed to load file content:', err);
      } finally {
        setIsLoadingFileContent(false);
      }
    },
    [api, selectedRepoId]
  );

  const handleToggleFileTree = useCallback(() => {
    setIsFileTreeOpen((prev) => {
      const next = !prev;
      if (next && selectedRepoId) {
        fetchRepoFiles(selectedRepoId);
      }
      return next;
    });
    onCodeViewerClose?.();
  }, [selectedRepoId, fetchRepoFiles, onCodeViewerClose]);

  const resetFiles = useCallback(() => {
    setIsFileTreeOpen(false);
    setRepoFiles([]);
    setSelectedFile(null);
  }, []);

  return {
    repoFiles,
    setRepoFiles,
    isLoadingFiles,
    selectedFile,
    setSelectedFile,
    isLoadingFileContent,
    isFileTreeOpen,
    setIsFileTreeOpen,
    fetchRepoFiles,
    handleSelectFile,
    handleToggleFileTree,
    resetFiles,
  };
}
