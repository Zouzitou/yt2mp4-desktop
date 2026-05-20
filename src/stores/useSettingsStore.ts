import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Settings } from '../lib/types';

interface SettingsStore {
  settings: Settings;
  ytdlpUpdateAvailable: string | null;
  setSettings: (s: Settings) => void;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  setYtdlpUpdateAvailable: (v: string | null) => void;
}

const defaultSettings: Settings = {
  download_dir: '',
  default_quality: 'best',
  default_format: 'mp4',
  auto_paste: true,
  notification_on_complete: true,
  theme: 'system',
  last_used_quality: null,
  window_width: 480,
  window_height: 680,
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      ytdlpUpdateAvailable: null,
      setSettings: (settings) => set({ settings }),
      updateSetting: (key, value) =>
        set((state) => ({
          settings: { ...state.settings, [key]: value },
        })),
      setYtdlpUpdateAvailable: (ytdlpUpdateAvailable) => set({ ytdlpUpdateAvailable }),
    }),
    {
      name: 'yt2mp4-settings',
    }
  )
);
