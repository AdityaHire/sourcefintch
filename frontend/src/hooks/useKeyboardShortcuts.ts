import { useEffect } from 'react';

interface KeyboardShortcutsOptions {
  onNewChat?: () => void;
  onToggleFileTree?: () => void;
  onToggleHistory?: () => void;
  onEscape?: () => void;
  enabled?: boolean;
}

export function useKeyboardShortcuts({
  onNewChat,
  onToggleFileTree,
  onToggleHistory,
  onEscape,
  enabled = true,
}: KeyboardShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (e.key === 'Escape') {
        onEscape?.();
        return;
      }

      if (isInputFocused) {
        return;
      }

      // Modifier-based shortcuts
      if (modKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        onNewChat?.();
      } else if (modKey && e.key === '/') {
        e.preventDefault();
        onToggleFileTree?.();
      } else if (modKey && (e.key === 'h' || e.key === 'H')) {
        // Prevent default browser history shortcut
        e.preventDefault();
        onToggleHistory?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onNewChat, onToggleFileTree, onToggleHistory, onEscape]);
}
