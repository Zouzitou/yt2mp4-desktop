export interface QualityOption {
  label: string;
  sublabel: string;
  height: number | null;
  format_selector: string;
  estimated_size: string | null;
  estimated_size_bytes: number | null;
  is_best: boolean;
  is_audio_only: boolean;
}

export interface ClipRange {
  start: number; // seconds
  end: number;   // seconds
}

export interface VideoInfo {
  id: string;
  title: string;
  thumbnail: string;
  duration: number;
  channel: string;
  view_count: number | null;
  upload_date: string | null;
  webpage_url: string;
  quality_options: QualityOption[];
  is_live: boolean | null;
  availability: string | null;
}

export interface DownloadProgress {
  status: string;
  percent: number;
  speed: string;
  eta: string;
  downloaded: string;
  total: string;
  phase: string;
}

export interface SetupProgress {
  step: 'ytdlp' | 'ffmpeg';
  status: 'downloading' | 'extracting' | 'verifying' | 'done' | 'error';
  percent: number;
  message: string;
}

export interface DepsStatus {
  ytdlp: boolean;
  ffmpeg: boolean;
  ytdlp_version: string | null;
}

export interface HistoryEntry {
  id: string;
  video_id: string;
  title: string;
  thumbnail_url: string;
  channel: string;
  duration: number;
  quality: string;
  file_path: string;
  file_size: number;
  downloaded_at: string;
  status: string;
  file_exists: boolean | null;
}

export interface Settings {
  download_dir: string;
  default_quality: string;
  default_format: string;
  auto_paste: boolean;
  notification_on_complete: boolean;
  theme: string;
  last_used_quality: string | null;
  window_width: number;
  window_height: number;
}

export type AppState =
  | 'setup'
  | 'setup_error'
  | 'idle'
  | 'fetching'
  | 'fetch_error'
  | 'preview'
  | 'downloading'
  | 'download_error'
  | 'complete';
