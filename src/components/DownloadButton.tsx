import { AnimatePresence, motion } from 'framer-motion';
import { Download, FolderOpen, Loader2, Play, RefreshCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { DownloadProgress } from '../lib/types';

interface Props {
  state: 'ready' | 'downloading' | 'complete' | 'error';
  onDownload: () => void;
  onCancel: () => void;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onDownloadAnother: () => void;
  onRetry: () => void;
  progress: DownloadProgress | null;
  estimatedSize?: string | null;
  error?: string | null;
}

export default function DownloadButton({
  state,
  onDownload,
  onCancel,
  onOpenFile,
  onOpenFolder,
  onDownloadAnother,
  onRetry,
  progress,
  estimatedSize,
  error,
}: Props) {
  const [showCheck, setShowCheck] = useState(false);
  const [slowWarning, setSlowWarning] = useState(false);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (state === 'complete') {
      const t = setTimeout(() => setShowCheck(true), 50);
      return () => clearTimeout(t);
    } else {
      setShowCheck(false);
    }
  }, [state]);

  // Show a "taking longer than usual" hint if stuck on Preparing for >15s
  useEffect(() => {
    if (state === 'downloading' && !progress) {
      slowTimerRef.current = setTimeout(() => setSlowWarning(true), 15000);
    } else {
      setSlowWarning(false);
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    }
    return () => { if (slowTimerRef.current) clearTimeout(slowTimerRef.current); };
  }, [state, progress]);

  const isMerging =
    progress?.status === 'merging' ||
    progress?.phase === 'merging' ||
    progress?.phase === 'processing';
  const isComplete = progress?.phase === 'complete' || progress?.status === 'finished';

  const phaseLabel = () => {
    if (!progress) return 'Preparing...';
    if (isComplete) return 'Finishing up...';
    if (progress.phase === 'merging') return 'Merging tracks...';
    if (progress.phase === 'processing') return 'Processing...';
    if (progress.status === 'merging') return 'Processing...';
    if (progress.phase === 'audio') return 'Downloading audio...';
    return 'Downloading video...';
  };

  const pct = Math.round(progress?.percent ?? 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <AnimatePresence mode="wait">
        {/* ── Ready ── */}
        {state === 'ready' && (
          <motion.button
            key="ready"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            whileHover={{ scale: 1.012, filter: 'brightness(1.08)' }}
            whileTap={{ scale: 0.975 }}
            onClick={onDownload}
            style={{
              width: '100%',
              height: 48,
              borderRadius: 13,
              border: 'none',
              cursor: 'pointer',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 50%, #3b82f6 100%)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              letterSpacing: '0.01em',
              boxShadow: '0 4px 18px rgba(99,102,241,0.3), 0 1px 3px rgba(0,0,0,0.2)',
              fontFamily: 'inherit',
            }}
          >
            <Download size={16} strokeWidth={2.5} />
            Download
            {estimatedSize && (
              <span
                style={{
                  background: 'rgba(255,255,255,0.18)',
                  borderRadius: 20,
                  padding: '2px 9px',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                }}
              >
                {estimatedSize}
              </span>
            )}
          </motion.button>
        )}

        {/* ── Downloading ── */}
        {state === 'downloading' && (
          <motion.div
            key="downloading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              width: '100%',
              height: 48,
              borderRadius: 13,
              border: '1px solid var(--border)',
              background: 'var(--surface-elevated)',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Animated progress fill */}
            <motion.div
              animate={{ width: `${isComplete ? 100 : isMerging ? Math.max(96, pct) : pct}%` }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                background:
                  'linear-gradient(90deg, rgba(139,92,246,0.22), rgba(59,130,246,0.22))',
                borderRight: '2px solid rgba(139,92,246,0.45)',
              }}
            />
            {/* Subtle shimmer overlay */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(90deg, transparent 40%, rgba(255,255,255,0.03) 50%, transparent 60%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 2s ease-in-out infinite',
              }}
            />
            {/* Text */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 14px',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                {isComplete ? '100%' : isMerging ? 'Processing…' : `${pct}%`}
              </span>
              {!isMerging && progress?.speed && progress.speed !== '-- MB/s' && (
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {progress.speed}
                  {progress.eta && progress.eta !== '--:--' ? ` · ${progress.eta}` : ''}
                </span>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Complete ── */}
        {state === 'complete' && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 22 }}
          >
            {/* Success banner */}
            <div
              style={{
                width: '100%',
                height: 44,
                borderRadius: 13,
                background: 'rgba(34,197,94,0.1)',
                border: '1px solid rgba(34,197,94,0.22)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                color: 'var(--success)',
                fontSize: 14,
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              {showCheck && (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path
                    className="check-path"
                    d="M3.5 9L7.5 13L14.5 5"
                    stroke="currentColor"
                    strokeWidth="2.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              Downloaded!
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <ActionBtn icon={<Play size={13} strokeWidth={2.5} />} onClick={onOpenFile}>
                Open File
              </ActionBtn>
              <ActionBtn icon={<FolderOpen size={13} strokeWidth={2} />} onClick={onOpenFolder}>
                Show Folder
              </ActionBtn>
            </div>

            <button
              onClick={onDownloadAnother}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-tertiary)',
                fontSize: 12,
                padding: '8px 0 0',
                fontFamily: 'inherit',
                display: 'block',
                width: '100%',
                textAlign: 'center',
                letterSpacing: '0.01em',
              }}
            >
              Download another video
            </button>
          </motion.div>
        )}

        {/* ── Error ── */}
        {state === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div
              style={{
                padding: '10px 13px',
                borderRadius: 11,
                background: 'rgba(248,113,113,0.08)',
                border: '1px solid rgba(248,113,113,0.18)',
                fontSize: 13,
                color: 'var(--error)',
                lineHeight: 1.5,
                marginBottom: 8,
              }}
            >
              {error ?? 'Download failed.'}
            </div>
            <button
              onClick={onRetry}
              style={{
                width: '100%',
                height: 42,
                borderRadius: 11,
                border: '1px solid rgba(248,113,113,0.25)',
                background: 'rgba(248,113,113,0.06)',
                cursor: 'pointer',
                color: 'var(--error)',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontFamily: 'inherit',
              }}
            >
              <RefreshCcw size={13} />
              Try again
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase label + cancel */}
      {state === 'downloading' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-tertiary)', letterSpacing: '0.01em' }}>
              {!progress && (
                <Loader2 size={11} style={{ animation: 'spin 0.9s linear infinite', flexShrink: 0 }} />
              )}
              {phaseLabel()}
            </span>
            <button
              onClick={onCancel}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-tertiary)',
                fontSize: 11,
                padding: 0,
                fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
          </div>
          {slowWarning && (
            <p style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
              Taking longer than usual — yt-dlp is fetching the video. Hang tight.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ActionBtn({
  children,
  icon,
  onClick,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        height: 38,
        borderRadius: 10,
        border: '1px solid var(--border)',
        background: 'var(--surface-elevated)',
        cursor: 'pointer',
        color: 'var(--text-primary)',
        fontSize: 12,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        fontFamily: 'inherit',
        transition: 'background 140ms ease',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-hover)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-elevated)'; }}
    >
      {icon}
      {children}
    </button>
  );
}
