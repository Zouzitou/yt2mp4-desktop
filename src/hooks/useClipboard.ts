import { readText } from '@tauri-apps/plugin-clipboard-manager';
import { useEffect, useRef } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { isVideoUrl } from '../lib/urlUtils';

export function useClipboardAutoPaste() {
  const autoPaste = useSettingsStore((s) => s.settings.auto_paste);
  const setUrl = useAppStore((s) => s.setUrl);
  const appState = useAppStore((s) => s.appState);
  const lastPasted = useRef<string>('');
  const urlRef = useRef(useAppStore.getState().url);
  // Keep ref in sync without re-registering the listener on every keystroke
  useEffect(() => {
    const unsub = useAppStore.subscribe((s) => { urlRef.current = s.url; });
    return unsub;
  }, []);

  useEffect(() => {
    if (!autoPaste) return;

    const handleFocus = async () => {
      if (appState !== 'idle') return;
      if (urlRef.current.trim().length > 0) return;

      try {
        const text = await readText();
        if (!text) return;
        const trimmed = text.trim();
        if (
          isVideoUrl(trimmed) &&
          trimmed !== urlRef.current
        ) {
          lastPasted.current = trimmed;
          setUrl(trimmed);
          // Reset after 2s so the same URL can be pasted again
          setTimeout(() => { lastPasted.current = ''; }, 2000);
        }
      } catch {
        // Clipboard read failed — silently ignore
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [autoPaste, appState, setUrl]);
}

export async function pasteFromClipboard(): Promise<string> {
  try {
    const text = await readText();
    return text?.trim() ?? '';
  } catch {
    return '';
  }
}
