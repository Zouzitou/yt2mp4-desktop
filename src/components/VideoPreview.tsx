import { User } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ClipRange, DownloadProgress, QualityOption, VideoInfo } from '../lib/types';
import { formatDuration, formatViewCount } from '../lib/time-utils';
import ClipSelector from './ClipSelector';
import DownloadButton from './DownloadButton';
import QualitySelector from './QualitySelector';

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576)     return `${(bytes / 1_048_576).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

interface Props {
  videoInfo: VideoInfo;
  selectedQuality: QualityOption | null;
  isAudioOnly: boolean;
  clip: ClipRange | null;
  onSelectQuality: (q: QualityOption) => void;
  onModeChange: (audioOnly: boolean) => void;
  onClipChange: (clip: ClipRange | null) => void;
  onDownload: () => void;
  onCancel: () => void;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onDownloadAnother: () => void;
  onRetry: () => void;
  downloadState: 'ready' | 'downloading' | 'complete' | 'error';
  downloadProgress: DownloadProgress | null;
  downloadError: string | null;
}

export default function VideoPreview({
  videoInfo,
  selectedQuality,
  isAudioOnly,
  clip,
  onSelectQuality,
  onModeChange,
  onClipChange,
  onDownload,
  onCancel,
  onOpenFile,
  onOpenFolder,
  onDownloadAnother,
  onRetry,
  downloadState,
  downloadProgress,
  downloadError,
}: Props) {
  const [thumbnailError, setThumbnailError] = useState(false);

  const ytFallback =
    videoInfo.id.length === 11
      ? `https://i.ytimg.com/vi/${videoInfo.id}/hqdefault.jpg`
      : null;
  const thumbnailSrc = thumbnailError && ytFallback
    ? ytFallback
    : videoInfo.thumbnail || ytFallback || '';

  const currentQuality = isAudioOnly
    ? videoInfo.quality_options.find((o) => o.is_audio_only) ?? null
    : selectedQuality ?? videoInfo.quality_options.find((o) => o.is_best) ?? null;

  // Recalculate estimated size based on clip duration
  const estimatedSize = useMemo(() => {
    const base = currentQuality?.estimated_size_bytes;
    if (!base || !clip || videoInfo.duration === 0) return currentQuality?.estimated_size ?? null;
    const clipDuration = Math.max(0, clip.end - clip.start);
    const ratio = clipDuration / videoInfo.duration;
    return `~${formatBytes(Math.round(base * ratio))}`;
  }, [currentQuality, clip, videoInfo.duration]);

  return (
    <div
      style={{
        background: 'var(--surface)',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid var(--border)',
        boxShadow: '0 2px 16px rgba(0,0,0,0.12)',
      }}
    >
      {/* Thumbnail */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16/9',
          background: 'var(--surface-elevated)',
          overflow: 'hidden',
        }}
      >
        {thumbnailSrc && (
          <img
            src={thumbnailSrc}
            alt=""
            loading="lazy"
            onError={() => !thumbnailError && setThumbnailError(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        )}
        {/* Gradient overlay at bottom */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 48,
            background: 'linear-gradient(transparent, rgba(0,0,0,0.55))',
            pointerEvents: 'none',
          }}
        />
        {/* Duration badge */}
        <div
          style={{
            position: 'absolute',
            bottom: 7,
            right: 8,
            background: 'rgba(0,0,0,0.72)',
            backdropFilter: 'blur(4px)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 600,
            padding: '2px 7px',
            borderRadius: 5,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '0.02em',
          }}
        >
          {formatDuration(videoInfo.duration)}
        </div>
      </div>

      {/* Info + controls */}
      <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Title */}
        <div>
          <h2
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--text-primary)',
              lineHeight: 1.45,
              marginBottom: 5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              letterSpacing: '-0.01em',
            }}
          >
            {videoInfo.title}
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                color: 'var(--text-secondary)',
              }}
            >
              <User size={11} strokeWidth={2} />
              {videoInfo.channel}
            </span>
            {videoInfo.view_count != null && videoInfo.view_count > 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                {formatViewCount(videoInfo.view_count)}
              </span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border-subtle)', margin: '0 -14px' }} />

        {/* Quality selector */}
        <QualitySelector
          options={videoInfo.quality_options}
          selected={selectedQuality}
          onSelect={onSelectQuality}
          isAudioOnly={isAudioOnly}
          onModeChange={onModeChange}
          clipRatio={clip && videoInfo.duration > 0
            ? Math.max(0, clip.end - clip.start) / videoInfo.duration
            : 1}
        />

        {/* Clip selector */}
        <ClipSelector
          totalDuration={videoInfo.duration}
          clip={clip}
          onChange={onClipChange}
          disabled={downloadState !== 'ready' && downloadState !== 'error'}
        />

        {/* Download button */}
        <DownloadButton
          state={downloadState}
          onDownload={onDownload}
          onCancel={onCancel}
          onOpenFile={onOpenFile}
          onOpenFolder={onOpenFolder}
          onDownloadAnother={onDownloadAnother}
          onRetry={onRetry}
          progress={downloadProgress}
          estimatedSize={estimatedSize}
          error={downloadError}
        />
      </div>
    </div>
  );
}
