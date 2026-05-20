import { create } from 'zustand';
import type { AppState, ClipRange, DownloadProgress, QualityOption, VideoInfo } from '../lib/types';

interface AppStore {
  appState: AppState;
  url: string;
  videoInfo: VideoInfo | null;
  selectedQuality: QualityOption | null;
  isAudioOnly: boolean;
  clip: ClipRange | null;
  downloadProgress: DownloadProgress | null;
  downloadedFilePath: string | null;
  error: string | null;

  setAppState: (state: AppState) => void;
  setUrl: (url: string) => void;
  setVideoInfo: (info: VideoInfo | null) => void;
  setSelectedQuality: (q: QualityOption | null) => void;
  setIsAudioOnly: (v: boolean) => void;
  setClip: (clip: ClipRange | null) => void;
  setDownloadProgress: (p: DownloadProgress | null) => void;
  setDownloadedFilePath: (path: string | null) => void;
  setError: (err: string | null) => void;
  reset: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  appState: 'idle',
  url: '',
  videoInfo: null,
  selectedQuality: null,
  isAudioOnly: false,
  clip: null,
  downloadProgress: null,
  downloadedFilePath: null,
  error: null,

  setAppState: (appState) => set({ appState }),
  setUrl: (url) => set({ url }),
  setVideoInfo: (videoInfo) => set({ videoInfo }),
  setSelectedQuality: (selectedQuality) => set({ selectedQuality }),
  setIsAudioOnly: (isAudioOnly) => set({ isAudioOnly }),
  setClip: (clip) => set({ clip }),
  setDownloadProgress: (downloadProgress) => set({ downloadProgress }),
  setDownloadedFilePath: (downloadedFilePath) => set({ downloadedFilePath }),
  setError: (error) => set({ error }),
  reset: () =>
    set({
      appState: 'idle',
      url: '',
      videoInfo: null,
      selectedQuality: null,
      isAudioOnly: false,
      clip: null,
      downloadProgress: null,
      downloadedFilePath: null,
      error: null,
    }),
}));
