import { invoke } from '@tauri-apps/api/core';
import type { DepsStatus, HistoryEntry, Settings, VideoInfo } from './types';

export const checkDependencies = (): Promise<DepsStatus> =>
  invoke('cmd_check_dependencies');

export const installDependencies = (): Promise<void> =>
  invoke('cmd_install_dependencies');

export const fetchVideoInfo = (url: string): Promise<VideoInfo> =>
  invoke('cmd_fetch_video_info', { url });

export const downloadVideo = (params: {
  url: string;
  formatSelector: string;
  outputDir: string;
  isAudioOnly: boolean;
  videoId: string;
  title: string;
  thumbnailUrl: string;
  channel: string;
  duration: number;
  qualityLabel: string;
  clipStart?: number | null;
  clipEnd?: number | null;
  outputFormat?: string | null;
}): Promise<string> =>
  invoke('cmd_download_video', {
    url: params.url,
    formatSelector: params.formatSelector,
    outputDir: params.outputDir,
    isAudioOnly: params.isAudioOnly,
    videoId: params.videoId,
    title: params.title,
    thumbnailUrl: params.thumbnailUrl,
    channel: params.channel,
    duration: params.duration,
    qualityLabel: params.qualityLabel,
    clipStart: params.clipStart ?? null,
    clipEnd: params.clipEnd ?? null,
    outputFormat: params.outputFormat ?? null,
  });

export const getSettings = (): Promise<Settings> =>
  invoke('cmd_get_settings');

export const saveSettings = (settings: Settings): Promise<void> =>
  invoke('cmd_save_settings', { settings });

export const getHistory = (): Promise<HistoryEntry[]> =>
  invoke('cmd_get_history');

export const clearHistory = (): Promise<void> =>
  invoke('cmd_clear_history');

export const getDownloadDir = (): Promise<string> =>
  invoke('cmd_get_download_dir');

export const openFile = (path: string): Promise<void> =>
  invoke('cmd_open_file', { path });

export const openFolder = (path: string): Promise<void> =>
  invoke('cmd_open_folder', { path });

export const checkYtdlpUpdate = (): Promise<string | null> =>
  invoke('cmd_check_ytdlp_update');

export const updateYtdlp = (): Promise<void> =>
  invoke('cmd_update_ytdlp');

export const fileExists = (path: string): Promise<boolean> =>
  invoke('cmd_file_exists', { path });

export const cancelDownload = (): Promise<void> =>
  invoke('cmd_cancel_download');
