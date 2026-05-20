import { readText } from '@tauri-apps/plugin-clipboard-manager';
import { useEffect, useRef } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { useSettingsStore } from '../stores/useSettingsStore';

const VIDEO_REGEX = /^(https?:\/\/)?((www\.|m\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}|(www\.|vm\.)?tiktok\.com\/((@[^/?#]+\/video\/\d+)|(t\/[A-Za-z0-9]+)|([A-Za-z0-9_-]{5,})))/;

export function useClipboardAutoPaste() {
  const autoPaste = useSettingsStore((s) => s.settings.auto_paste);
  const url = useAppStore((s) => s.url);
  const setUrl = useAppStore((s) => s.setUrl);
  const appState = useAppStore((s) => s.appState);
  const lastPasted = useRef<string>('');

  useEffect(() => {
    if (!autoPaste) return;

    const handleFocus = async () => {
      // Only auto-paste in idle state
      if (appState !== 'idle') return;
      // Don't clobber what the user has already typed
      if (url.trim().length > 0) return;

      try {
        const text = await readText();
        if (!text) return;
        const trimmed = text.trim();
        if (
          VIDEO_REGEX.test(trimmed) &&
          trimmed !== url &&
          trimmed !== lastPasted.current
        ) {
          lastPasted.current = trimmed;
          setUrl(trimmed);
        }
      } catch {
        // Clipboard read failed (e.g., permission denied) — silently ignore
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [autoPaste, url, appState, setUrl]);
}

export function isVideoUrl(url: string): boolean {
  return VIDEO_REGEX.test(url.trim());
}

export async function pasteFromClipboard(): Promise<string> {
  try {
    const text = await readText();
    return text?.trim() ?? '';
  } catch {
    return '';
  }
}
