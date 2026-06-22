import type { QualityOption } from './types';

/** Static quality presets for bulk download — no metadata fetch required. */
export const BULK_QUALITY_PRESETS: QualityOption[] = [
  {
    label: 'Best quality',
    sublabel: 'Highest available · MP4',
    height: null,
    format_selector: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best',
    estimated_size: null,
    estimated_size_bytes: null,
    is_best: true,
    is_audio_only: false,
  },
  ...([2160, 1440, 1080, 720, 480, 360, 240] as const).map((h) => ({
    label: `${h}p`,
    sublabel: 'MP4 · max resolution',
    height: h,
    format_selector: `bestvideo[height<=${h}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${h}]+bestaudio/best[height<=${h}]`,
    estimated_size: null,
    estimated_size_bytes: null,
    is_best: false,
    is_audio_only: false,
  })),
  {
    label: 'Audio only',
    sublabel: 'MP3',
    height: null,
    format_selector: 'bestaudio[ext=m4a]/bestaudio',
    estimated_size: null,
    estimated_size_bytes: null,
    is_best: false,
    is_audio_only: true,
  },
];

export function presetFromDefaultQuality(defaultQuality: string): QualityOption {
  if (defaultQuality === 'best') {
    return BULK_QUALITY_PRESETS[0];
  }
  if (defaultQuality === 'audio') {
    return BULK_QUALITY_PRESETS[BULK_QUALITY_PRESETS.length - 1];
  }
  const target = parseInt(defaultQuality, 10);
  if (Number.isFinite(target)) {
    const match = BULK_QUALITY_PRESETS.filter(
      (p) => !p.is_audio_only && p.height != null && p.height <= target,
    ).sort((a, b) => (b.height ?? 0) - (a.height ?? 0))[0];
    if (match) return match;
  }
  return BULK_QUALITY_PRESETS[0];
}
