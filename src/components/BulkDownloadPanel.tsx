import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ClipboardPaste,
  Download,
  FolderOpen,
  Layers,
  Loader2,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { pasteFromClipboard } from '../hooks/useClipboard';
import {
  cancelDownload,
  downloadVideo,
  getDownloadDir,
  openFolder,
} from '../lib/commands';
import { BULK_QUALITY_PRESETS, presetFromDefaultQuality } from '../lib/qualityPresets';
import type { DownloadProgress, QualityOption } from '../lib/types';
import { extractVideoId, parseBulkUrls, shortUrlLabel } from '../lib/urlUtils';
import { useSettingsStore } from '../stores/useSettingsStore';

type ItemStatus = 'pending' | 'downloading' | 'done' | 'error';

interface QueueItem {
  url: string;
  status: ItemStatus;
  error?: string;
  filePath?: string;
}

interface Props {
  disabled?: boolean;
  onDownloadingChange?: (downloading: boolean) => void;
  onComplete?: () => void;
  downloadProgress: DownloadProgress | null;
}

export default function BulkDownloadPanel({
  disabled,
  onDownloadingChange,
  onComplete,
  downloadProgress,
}: Props) {
  const { settings } = useSettingsStore();
  const [text, setText] = useState('');
  const [selectedQuality, setSelectedQuality] = useState<QualityOption>(() =>
    presetFromDefaultQuality(settings.default_quality),
  );
  const [isAudioOnly, setIsAudioOnly] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [phase, setPhase] = useState<'input' | 'downloading' | 'complete'>('input');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const abortRef = useRef(false);
  const qualityRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const parsed = parseBulkUrls(text);
  const urlCount = parsed.valid.length;

  useEffect(() => {
    if (!qualityOpen) return;
    const handle = (e: MouseEvent) => {
      if (!qualityRef.current?.contains(e.target as Node)) setQualityOpen(false);
    };
    window.addEventListener('mousedown', handle);
    return () => window.removeEventListener('mousedown', handle);
  }, [qualityOpen]);

  const videoOptions = BULK_QUALITY_PRESETS.filter((o) => !o.is_audio_only);
  const audioOption = BULK_QUALITY_PRESETS.find((o) => o.is_audio_only);
  const currentQuality = isAudioOnly ? audioOption : selectedQuality;

  const handlePaste = async () => {
    const clip = await pasteFromClipboard();
    if (!clip) return;
    setText((prev) => (prev.trim() ? `${prev.trim()}\n${clip.trim()}` : clip.trim()));
    setValidationError(null);
    textareaRef.current?.focus();
  };

  const handleDownloadAll = async () => {
    if (disabled || phase === 'downloading') return;

    const { valid, invalid } = parseBulkUrls(text);
    if (valid.length === 0) {
      setValidationError(
        invalid.length > 0
          ? `${invalid.length} invalid link${invalid.length > 1 ? 's' : ''}. Use one YouTube or TikTok URL per line.`
          : 'Paste at least one link — one per line.',
      );
      return;
    }

    const quality = isAudioOnly
      ? (audioOption ?? BULK_QUALITY_PRESETS[BULK_QUALITY_PRESETS.length - 1])
      : selectedQuality;

    abortRef.current = false;
    setValidationError(null);
    setPhase('downloading');
    onDownloadingChange?.(true);

    const items: QueueItem[] = valid.map((url) => ({ url, status: 'pending' }));
    setQueue(items);
    setCurrentIndex(0);

    const outputDir = settings.download_dir || (await getDownloadDir());

    for (let i = 0; i < valid.length; i++) {
      if (abortRef.current) break;

      const url = valid[i];
      setCurrentIndex(i);
      setQueue((prev) =>
        prev.map((item, idx) =>
          idx === i ? { ...item, status: 'downloading' } : item,
        ),
      );

      try {
        const filePath = await downloadVideo({
          url,
          formatSelector: quality.format_selector,
          outputDir,
          isAudioOnly: quality.is_audio_only,
          videoId: extractVideoId(url),
          title: shortUrlLabel(url),
          thumbnailUrl: '',
          channel: '',
          duration: 0,
          qualityLabel: quality.label,
          outputFormat: settings.default_format,
        });

        if (abortRef.current) break;

        setQueue((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: 'done', filePath } : item,
          ),
        );
      } catch (e: unknown) {
        if (abortRef.current) break;
        const msg = e instanceof Error ? e.message : String(e);
        if (msg === 'cancelled') break;
        setQueue((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: 'error', error: msg } : item,
          ),
        );
      }
    }

    onDownloadingChange?.(false);
    if (abortRef.current) {
      setPhase('input');
      return;
    }

    setPhase('complete');
    onComplete?.();
  };

  const handleCancel = () => {
    abortRef.current = true;
    cancelDownload().catch(() => {});
    onDownloadingChange?.(false);
    setPhase('input');
  };

  const handleReset = () => {
    setPhase('input');
    setQueue([]);
    setCurrentIndex(0);
  };

  const doneCount = queue.filter((q) => q.status === 'done').length;
  const errorCount = queue.filter((q) => q.status === 'error').length;
  const pct = Math.round(downloadProgress?.percent ?? 0);
  const overallPct =
    queue.length > 0
      ? Math.round(((currentIndex + (phase === 'downloading' ? pct / 100 : 0)) / queue.length) * 100)
      : 0;

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {phase === 'input' && (
        <>
          <div
            style={{
              position: 'relative',
              borderRadius: 14,
              background: 'var(--surface)',
              border: `1px solid ${
                validationError
                  ? 'rgba(248,113,113,0.5)'
                  : focused
                    ? 'rgba(99,102,241,0.4)'
                    : 'var(--border)'
              }`,
              transition: 'border-color 160ms ease, box-shadow 160ms ease',
              boxShadow:
                focused && !validationError
                  ? '0 0 0 3px rgba(99,102,241,0.12)'
                  : validationError
                    ? '0 0 0 3px rgba(248,113,113,0.12)'
                    : 'none',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px 0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#818cf8' }}>
                <Layers size={15} strokeWidth={2.2} />
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.02em' }}>
                  Bulk download
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {urlCount > 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--text-tertiary)',
                      background: 'var(--surface-elevated)',
                      borderRadius: 20,
                      padding: '2px 8px',
                    }}
                  >
                    {urlCount} link{urlCount !== 1 ? 's' : ''}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handlePaste}
                  title="Paste from clipboard"
                  style={iconBtnStyle}
                >
                  <ClipboardPaste size={14} />
                </button>
                {text && (
                  <button
                    type="button"
                    onClick={() => {
                      setText('');
                      setValidationError(null);
                      textareaRef.current?.focus();
                    }}
                    style={iconBtnStyle}
                  >
                    <X size={13} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            </div>

            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (validationError) setValidationError(null);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={'Paste links here — one per line\nhttps://youtube.com/watch?v=...\nhttps://youtu.be/...'}
              disabled={disabled}
              spellCheck={false}
              style={{
                width: '100%',
                minHeight: 120,
                maxHeight: 220,
                padding: '10px 14px 12px',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                resize: 'vertical',
                fontSize: 13,
                lineHeight: 1.55,
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
                caretColor: '#818cf8',
                opacity: disabled ? 0.55 : 1,
              }}
            />
          </div>

          {validationError && (
            <p style={{ fontSize: 12, color: 'var(--error)', paddingLeft: 4, lineHeight: 1.5 }}>
              {validationError}
            </p>
          )}

          {!validationError && parsed.invalid.length > 0 && urlCount > 0 && (
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', paddingLeft: 4, lineHeight: 1.5 }}>
              Skipping {parsed.invalid.length} invalid line{parsed.invalid.length > 1 ? 's' : ''}.
            </p>
          )}

          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', paddingLeft: 4, lineHeight: 1.5 }}>
            No preview — downloads start immediately. Videos get the selected max quality (or lower if unavailable).
          </p>

          {/* Quality picker */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div
              style={{
                display: 'flex',
                background: 'var(--surface-elevated)',
                borderRadius: 10,
                padding: 3,
                gap: 2,
              }}
            >
              {(['video', 'audio'] as const).map((mode) => {
                const active = mode === 'audio' ? isAudioOnly : !isAudioOnly;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      const audio = mode === 'audio';
                      setIsAudioOnly(audio);
                      if (audio && audioOption) setSelectedQuality(audioOption);
                      else setSelectedQuality(BULK_QUALITY_PRESETS[0]);
                      setQualityOpen(false);
                    }}
                    style={{
                      flex: 1,
                      height: 30,
                      borderRadius: 8,
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
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

            {!isAudioOnly && (
              <div ref={qualityRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setQualityOpen((v) => !v)}
                  style={{
                    width: '100%',
                    minHeight: 40,
                    borderRadius: 10,
                    border: `1px solid ${qualityOpen ? 'rgba(99,102,241,0.35)' : 'var(--border)'}`,
                    background: qualityOpen ? 'var(--surface-hover)' : 'var(--surface)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 11px',
                    fontFamily: 'inherit',
                  }}
                >
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {currentQuality?.label ?? 'Select quality'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {currentQuality?.sublabel}
                    </div>
                  </div>
                  <motion.div
                    animate={{ rotate: qualityOpen ? 180 : 0 }}
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <ChevronDown size={14} strokeWidth={2.5} />
                  </motion.div>
                </button>

                <AnimatePresence>
                  {qualityOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
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
                        maxHeight: 220,
                        overflowY: 'auto',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
                      }}
                    >
                      {videoOptions.map((opt, i) => {
                        const isSelected =
                          selectedQuality.format_selector === opt.format_selector;
                        return (
                          <button
                            key={opt.label}
                            type="button"
                            onClick={() => {
                              setSelectedQuality(opt);
                              setQualityOpen(false);
                            }}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 9,
                              padding: '9px 12px',
                              border: 'none',
                              cursor: 'pointer',
                              background: isSelected ? 'rgba(99,102,241,0.1)' : 'transparent',
                              borderBottom:
                                i < videoOptions.length - 1
                                  ? '1px solid var(--border-subtle)'
                                  : 'none',
                              textAlign: 'left',
                              fontFamily: 'inherit',
                            }}
                          >
                            <div
                              style={{
                                width: 16,
                                height: 16,
                                borderRadius: '50%',
                                border: isSelected ? 'none' : '1.5px solid var(--text-tertiary)',
                                background: isSelected
                                  ? 'linear-gradient(135deg, #8b5cf6, #3b82f6)'
                                  : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {isSelected && <Check size={9} color="#fff" strokeWidth={3} />}
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
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                                {opt.sublabel}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          <motion.button
            type="button"
            whileHover={{ scale: urlCount > 0 ? 1.012 : 1 }}
            whileTap={{ scale: urlCount > 0 ? 0.975 : 1 }}
            onClick={handleDownloadAll}
            disabled={disabled || urlCount === 0}
            style={{
              width: '100%',
              height: 48,
              borderRadius: 13,
              border: 'none',
              cursor: disabled || urlCount === 0 ? 'not-allowed' : 'pointer',
              background:
                urlCount > 0
                  ? 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 50%, #3b82f6 100%)'
                  : 'var(--surface-elevated)',
              color: urlCount > 0 ? '#fff' : 'var(--text-tertiary)',
              fontSize: 14,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow:
                urlCount > 0 ? '0 4px 18px rgba(99,102,241,0.3)' : 'none',
              fontFamily: 'inherit',
              opacity: disabled ? 0.55 : 1,
            }}
          >
            <Download size={16} strokeWidth={2.5} />
            Download {urlCount > 0 ? `all ${urlCount}` : 'all'}
          </motion.button>
        </>
      )}

      {phase === 'downloading' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 12,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                Downloading {currentIndex + 1} of {queue.length}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                {overallPct}%
              </span>
            </div>

            <div
              style={{
                height: 6,
                borderRadius: 99,
                background: 'var(--surface-elevated)',
                overflow: 'hidden',
                marginBottom: 10,
              }}
            >
              <motion.div
                animate={{ width: `${overallPct}%` }}
                style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, #8b5cf6, #3b82f6)',
                  borderRadius: 99,
                }}
              />
            </div>

            <p
              style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                marginBottom: 8,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {queue[currentIndex]?.url ? shortUrlLabel(queue[currentIndex].url) : '…'}
            </p>

            <div
              style={{
                height: 40,
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--surface-elevated)',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <motion.div
                animate={{ width: `${pct}%` }}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  background: 'linear-gradient(90deg, rgba(139,92,246,0.22), rgba(59,130,246,0.22))',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 12px',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <span>{pct}%</span>
                {downloadProgress?.speed && downloadProgress.speed !== '-- MB/s' && (
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>
                    {downloadProgress.speed}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div
            style={{
              maxHeight: 160,
              overflowY: 'auto',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
            }}
          >
            {queue.map((item, i) => (
              <div
                key={item.url}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderBottom:
                    i < queue.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  opacity: item.status === 'pending' ? 0.55 : 1,
                }}
              >
                <StatusIcon status={item.status} />
                <span
                  style={{
                    flex: 1,
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {shortUrlLabel(item.url)}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleCancel}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-tertiary)',
                fontSize: 12,
                fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {phase === 'complete' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            style={{
              padding: '14px',
              borderRadius: 12,
              background: 'rgba(34,197,94,0.08)',
              border: '1px solid rgba(34,197,94,0.2)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--success)',
                marginBottom: 4,
              }}
            >
              Bulk download finished
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {doneCount} succeeded
              {errorCount > 0 ? ` · ${errorCount} failed` : ''}
            </div>
          </div>

          <div
            style={{
              maxHeight: 200,
              overflowY: 'auto',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
            }}
          >
            {queue.map((item, i) => (
              <div
                key={item.url}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '8px 12px',
                  borderBottom:
                    i < queue.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}
              >
                <StatusIcon status={item.status} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {shortUrlLabel(item.url)}
                  </div>
                  {item.error && (
                    <div style={{ fontSize: 10, color: 'var(--error)', marginTop: 2, lineHeight: 1.4 }}>
                      {item.error}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {queue.find((q) => q.filePath) && (
              <button
                type="button"
                onClick={() => {
                  const last = [...queue].reverse().find((q) => q.filePath);
                  if (last?.filePath) openFolder(last.filePath).catch(() => {});
                }}
                style={actionBtnStyle}
              >
                <FolderOpen size={13} />
                Show folder
              </button>
            )}
            <button type="button" onClick={handleReset} style={{ ...actionBtnStyle, flex: 1 }}>
              Download more
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: ItemStatus }) {
  if (status === 'done') {
    return <Check size={13} color="var(--success)" strokeWidth={2.5} />;
  }
  if (status === 'error') {
    return <AlertCircle size={13} color="var(--error)" strokeWidth={2.2} />;
  }
  if (status === 'downloading') {
    return (
      <Loader2
        size={13}
        color="#818cf8"
        strokeWidth={2.2}
        style={{ animation: 'spin 0.9s linear infinite' }}
      />
    );
  }
  return (
    <div
      style={{
        width: 10,
        height: 10,
        borderRadius: '50%',
        border: '1.5px solid var(--text-tertiary)',
        flexShrink: 0,
      }}
    />
  );
}

const iconBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 7,
  border: 'none',
  background: 'var(--surface-elevated)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--text-secondary)',
  fontFamily: 'inherit',
};

const actionBtnStyle: React.CSSProperties = {
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
};
