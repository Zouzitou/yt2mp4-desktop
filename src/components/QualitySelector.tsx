import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { QualityOption } from '../lib/types';

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576)     return `${(bytes / 1_048_576).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

// Returns the codec/format part of a sublabel, dropping the size segment
function sublabelCodec(sublabel: string): string {
  return sublabel.split(' · ')[0];
}

function adjustedSize(opt: QualityOption, clipRatio: number): string | null {
  if (clipRatio >= 1) return opt.estimated_size ?? null;
  if (!opt.estimated_size_bytes) return opt.estimated_size ?? null;
  return `~${formatBytes(Math.round(opt.estimated_size_bytes * clipRatio))}`;
}

interface Props {
  options: QualityOption[];
  selected: QualityOption | null;
  onSelect: (q: QualityOption) => void;
  isAudioOnly: boolean;
  onModeChange: (audioOnly: boolean) => void;
  clipRatio?: number; // clip_duration / total_duration — 1 means no clip
}

export default function QualitySelector({
  options,
  selected,
  onSelect,
  isAudioOnly,
  onModeChange,
  clipRatio = 1,
}: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const videoOptions = options.filter((o) => !o.is_audio_only);
  const audioOption  = options.find((o) =>  o.is_audio_only);
  const current      = isAudioOnly
    ? audioOption
    : (selected ?? videoOptions[0]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', handle);
    return () => window.removeEventListener('mousedown', handle);
  }, [open]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {/* Mode toggle pill */}
      <div
        style={{
          display: 'flex',
          background: 'var(--surface-elevated)',
          borderRadius: 10,
          padding: 3,
          position: 'relative',
          gap: 2,
        }}
      >
        {(['video', 'audio'] as const).map((mode) => {
          const active = mode === 'audio' ? isAudioOnly : !isAudioOnly;
          return (
            <button
              key={mode}
              onClick={() => {
                const audio = mode === 'audio';
                onModeChange(audio);
                // Pick a sensible default for the new mode
                if (audio) {
                  const audioOpt = options.find((o) => o.is_audio_only);
                  if (audioOpt) onSelect(audioOpt);
                } else {
                  const best =
                    options.find((o) => o.is_best && !o.is_audio_only) ??
                    options.find((o) => !o.is_audio_only);
                  if (best) onSelect(best);
                }
                setOpen(false);
              }}
              style={{
                flex: 1,
                height: 30,
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.01em',
                transition: 'all 160ms ease',
                background: active
                  ? 'linear-gradient(135deg, #8b5cf6, #6366f1, #3b82f6)'
                  : 'transparent',
                color: active ? '#fff' : 'var(--text-tertiary)',
                boxShadow: active ? '0 2px 8px rgba(99,102,241,0.3)' : 'none',
                fontFamily: 'inherit',
              }}
            >
              {mode === 'video' ? 'Video' : 'Audio only'}
            </button>
          );
        })}
      </div>

      {/* Quality dropdown (video mode) */}
      {!isAudioOnly && (
        <div ref={containerRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setOpen((v) => !v)}
            style={{
              width: '100%',
              minHeight: 40,
              borderRadius: 10,
              border: `1px solid ${open ? 'rgba(99,102,241,0.35)' : 'var(--border)'}`,
              background: open ? 'var(--surface-hover)' : 'var(--surface)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 11px',
              transition: 'border-color 140ms ease, background 140ms ease',
              boxShadow: open ? '0 0 0 3px rgba(99,102,241,0.1)' : 'none',
            }}
          >
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                {current?.label ?? 'Select quality'}
              </div>
              {current && (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.3 }}>
                  {/* Show codec info (strip size from sublabel) then live-adjusted size */}
                  {sublabelCodec(current.sublabel)}
                  {adjustedSize(current, clipRatio) && (
                    <span style={{ color: clipRatio < 1 ? '#818cf8' : undefined }}>
                      {' · '}{adjustedSize(current, clipRatio)}
                    </span>
                  )}
                </div>
              )}
            </div>
            <motion.div
              animate={{ rotate: open ? 180 : 0 }}
              transition={{ duration: 0.18 }}
              style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: 8 }}
            >
              <ChevronDown size={14} strokeWidth={2.5} />
            </motion.div>
          </button>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -6, scaleY: 0.92 }}
                animate={{ opacity: 1, y: 0, scaleY: 1 }}
                exit={{ opacity: 0, y: -4, scaleY: 0.94 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 5px)',
                  left: 0,
                  right: 0,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  overflow: 'hidden',
                  zIndex: 30,
                  maxHeight: 240,
                  overflowY: 'auto',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.12)',
                  transformOrigin: 'top',
                }}
              >
                {videoOptions.map((opt, i) => {
                  const isSelected =
                    current?.format_selector === opt.format_selector;
                  return (
                    <motion.button
                      key={opt.label}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.025 }}
                      onClick={() => { onSelect(opt); setOpen(false); }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '9px 12px',
                        border: 'none',
                        cursor: 'pointer',
                        background: isSelected
                          ? 'rgba(99,102,241,0.1)'
                          : 'transparent',
                        borderBottom:
                          i < videoOptions.length - 1
                            ? '1px solid var(--border-subtle)'
                            : 'none',
                        textAlign: 'left',
                        fontFamily: 'inherit',
                        transition: 'background 120ms ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected)
                          (e.currentTarget as HTMLButtonElement).style.background =
                            'var(--surface-elevated)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected)
                          (e.currentTarget as HTMLButtonElement).style.background =
                            'transparent';
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 9,
                        }}
                      >
                        {/* Radio indicator */}
                        <div
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            border: isSelected
                              ? 'none'
                              : '1.5px solid var(--text-tertiary)',
                            background: isSelected
                              ? 'linear-gradient(135deg, #8b5cf6, #3b82f6)'
                              : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            transition: 'all 140ms ease',
                          }}
                        >
                          {isSelected && (
                            <Check size={9} color="#fff" strokeWidth={3} />
                          )}
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: isSelected ? 700 : 500,
                              color: 'var(--text-primary)',
                            }}
                          >
                            {opt.label}
                            {opt.is_best && (
                              <span
                                style={{
                                  marginLeft: 6,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  background:
                                    'linear-gradient(135deg, #8b5cf6, #3b82f6)',
                                  WebkitBackgroundClip: 'text',
                                  WebkitTextFillColor: 'transparent',
                                  backgroundClip: 'text',
                                  letterSpacing: '0.04em',
                                }}
                              >
                                BEST
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: 'var(--text-tertiary)',
                              marginTop: 1,
                            }}
                          >
                            {opt.sublabel.split(' · ')[0]}
                          </div>
                        </div>
                      </div>
                      {adjustedSize(opt, clipRatio) && (
                        <span
                          style={{
                            fontSize: 11,
                            color: clipRatio < 1 ? '#818cf8' : 'var(--text-tertiary)',
                            whiteSpace: 'nowrap',
                            marginLeft: 8,
                            fontWeight: clipRatio < 1 ? 600 : 400,
                          }}
                        >
                          {adjustedSize(opt, clipRatio)}
                        </span>
                      )}
                    </motion.button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Audio only info bar */}
      {isAudioOnly && audioOption && (
        <div
          style={{
            height: 40,
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px',
          }}
        >
          <span
            style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}
          >
            Best audio quality — MP3
          </span>
          {adjustedSize(audioOption, clipRatio) && (
            <span style={{ fontSize: 11, color: clipRatio < 1 ? '#818cf8' : 'var(--text-tertiary)', fontWeight: clipRatio < 1 ? 600 : 400 }}>
              {adjustedSize(audioOption, clipRatio)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
