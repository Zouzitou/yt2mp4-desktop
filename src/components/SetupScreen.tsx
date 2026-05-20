import { motion } from 'framer-motion';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import type { SetupProgress } from '../lib/types';

interface Props {
  ytdlpProgress: SetupProgress | null;
  ffmpegProgress: SetupProgress | null;
  error: string | null;
  onRetry: () => void;
}

export default function SetupScreen({ ytdlpProgress, ffmpegProgress, error, onRetry }: Props) {
  return (
    <div
      style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '32px 28px', gap: 32,
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <motion.div
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            width: 52, height: 52, borderRadius: 16,
            background: 'linear-gradient(145deg, #8b5cf6, #4f46e5, #3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 10px 32px rgba(99,102,241,0.4)',
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v13" />
            <path d="M5 11l7 7 7-7" />
            <path d="M3 21h18" />
          </svg>
        </motion.div>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{
            fontSize: 21, fontWeight: 800, letterSpacing: '-0.03em',
            background: 'linear-gradient(135deg, #c4b5fd, #818cf8, #60a5fa)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text', lineHeight: 1.2, marginBottom: 5,
          }}>
            Yt2Mp4
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
            {error ? 'Setup failed' : 'Setting up tools…'}
          </p>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div style={{
          background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.18)',
          borderRadius: 12, padding: '12px 16px',
          display: 'flex', flexDirection: 'column', gap: 12, width: '100%',
        }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <AlertCircle size={15} style={{ color: 'var(--error)', flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 13, color: 'var(--error)', lineHeight: 1.55 }}>{error}</p>
          </div>
          <button
            onClick={onRetry}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '9px', borderRadius: 9,
              border: '1px solid rgba(248,113,113,0.25)',
              background: 'rgba(248,113,113,0.07)',
              cursor: 'pointer', fontFamily: 'inherit',
              color: 'var(--error)', fontSize: 13, fontWeight: 600,
            }}
          >
            <RefreshCcw size={13} /> Retry
          </button>
        </div>
      )}

      {/* Progress items */}
      {!error && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <ProgressItem label="yt-dlp" progress={ytdlpProgress} />
          <ProgressItem label="ffmpeg" progress={ffmpegProgress} />
        </div>
      )}

      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.6 }}>
        yt-dlp and ffmpeg are required to download videos.
        <br />This only happens once.
      </p>
    </div>
  );
}

function ProgressItem({ label, progress }: { label: string; progress: SetupProgress | null }) {
  const percent = progress?.percent ?? 0;
  const done    = progress?.status === 'done';
  const started = progress !== null;

  const statusText = done
    ? 'Done'
    : !started
    ? 'Waiting…'
    : progress?.status ?? 'Downloading…';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: done ? 'var(--success)' : 'var(--text-primary)' }}>
          {label}
        </span>
        <span style={{ fontSize: 12, color: done ? 'var(--success)' : 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
          {statusText}
        </span>
      </div>
      <div
        style={{
          height: 5, background: 'var(--surface-elevated)',
          borderRadius: 99, overflow: 'hidden',
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: done ? '100%' : started ? `${percent}%` : '0%' }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{
            height: '100%', borderRadius: 99,
            background: done
              ? 'var(--success)'
              : 'linear-gradient(90deg, #8b5cf6, #3b82f6)',
          }}
        />
      </div>
    </div>
  );
}
