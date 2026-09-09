import { useState, useCallback } from 'react';
import type { SourceCitation, ChatMessage, RepositoryFile } from '../types';

interface UseCitationViewerOptions {
  onSendMessage?: (prompt: string) => void;
  onSetPromptText?: (text: string) => void;
  onCloseFileTree?: () => void;
}

export function useCitationViewer({
  onSendMessage,
  onSetPromptText,
  onCloseFileTree,
}: UseCitationViewerOptions = {}) {
  const [selectedCitation, setSelectedCitation] = useState<SourceCitation | null>(null);
  const [isCodeViewerOpen, setIsCodeViewerOpen] = useState(false);

  const handleCitationClick = useCallback((citation: SourceCitation) => {
    setSelectedCitation(citation);
    setIsCodeViewerOpen(true);
  }, []);

  const handleOpenCode = useCallback(
    (
      filePath: string,
      startLine?: number,
      endLine?: number,
      messages: ChatMessage[] = [],
      repoFiles: RepositoryFile[] = []
    ) => {
      const sLine = startLine || 1;
      const eLine = endLine || sLine;

      // 1. Check if matching citation exists in recent message sources
      let foundCitation: SourceCitation | null = null;
      for (let i = messages.length - 1; i >= 0; i--) {
        const s = messages[i].sources?.find(
          (src) => src.file_path.endsWith(filePath) || filePath.endsWith(src.file_path)
        );
        if (s) {
          foundCitation = s;
          break;
        }
      }

      if (foundCitation) {
        setSelectedCitation(foundCitation);
      } else {
        // 2. Check if file is loaded in repoFiles to display real code lines
        const cleanPath = filePath.replace(/^\/+/, '');
        const matchFile = repoFiles.find(
          (f) =>
            f.file_path === cleanPath ||
            f.file_path.endsWith(cleanPath) ||
            cleanPath.endsWith(f.file_path)
        );

        let content = `// Source code snippet for ${filePath}:${sLine}-${eLine}`;
        if (matchFile?.content) {
          const fileLines = matchFile.content.split('\n');
          const startIdx = Math.max(0, sLine - 1);
          const endIdx = Math.min(fileLines.length, eLine);
          content = fileLines.slice(startIdx, endIdx).join('\n') || matchFile.content;
        }

        setSelectedCitation({
          file_path: matchFile ? matchFile.file_path : filePath,
          start_line: sLine,
          end_line: eLine,
          content,
          score: 1.0,
        });
      }

      setIsCodeViewerOpen(true);
    },
    []
  );

  const handleAskAIFromCode = useCallback(
    (prompt: string, autoSend: boolean = true) => {
      setIsCodeViewerOpen(false);
      onCloseFileTree?.();

      if (autoSend) {
        onSendMessage?.(prompt);
      } else {
        onSetPromptText?.(prompt);
      }
    },
    [onSendMessage, onSetPromptText, onCloseFileTree]
  );

  const closeCodeViewer = useCallback(() => {
    setIsCodeViewerOpen(false);
  }, []);

  return {
    selectedCitation,
    setSelectedCitation,
    isCodeViewerOpen,
    setIsCodeViewerOpen,
    handleCitationClick,
    handleOpenCode,
    handleAskAIFromCode,
    closeCodeViewer,
  };
}
