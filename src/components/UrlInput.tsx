import { ClipboardPaste, Link2, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { pasteFromClipboard } from '../hooks/useClipboard';
import { useAppStore } from '../stores/useAppStore';

const VIDEO_REGEX =
  /^(https?:\/\/)?((www\.|m\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}|(www\.|vm\.)?tiktok\.com\/((@[^/?#]+\/video\/\d+)|(t\/[A-Za-z0-9]+)|([A-Za-z0-9_-]{5,})))/;

interface Props {
  onSubmit: (url: string) => void;
  compact?: boolean;
  disabled?: boolean;
}

export default function UrlInput({ onSubmit, compact, disabled }: Props) {
  const url = useAppStore((s) => s.url);
  const setUrl = useAppStore((s) => s.setUrl);
  const [shaking, setShaking] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = useCallback(
    (val: string) => VIDEO_REGEX.test(val.trim()),
    [],
  );

  const handleSubmit = useCallback(() => {
    if (disabled) return;
    const trimmed = url.trim();
    if (!trimmed) return;
    if (!validate(trimmed)) {
      setValidationError('Not a valid YouTube or TikTok URL');
      setShaking(true);
      setTimeout(() => setShaking(false), 450);
      return;
    }
    setValidationError(null);
    onSubmit(trimmed);
  }, [url, validate, onSubmit, disabled]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUrl(val);
    if (validationError && validate(val)) setValidationError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') { setUrl(''); setValidationError(null); }
  };

  const handlePaste = async () => {
    const text = await pasteFromClipboard();
    if (text) {
      setUrl(text);
      if (validate(text)) {
        setValidationError(null);
        setTimeout(() => onSubmit(text), 40);
      }
    }
    inputRef.current?.focus();
  };

  const hasError = !!validationError;
  const height   = compact ? 40 : 52;
  const iconSize = compact ? 15 : 17;
  const radius   = compact ? 11 : 14;
  const fontSize = compact ? 13 : 14;

  const borderColor = hasError
    ? 'rgba(248,113,113,0.5)'
    : focused
    ? 'rgba(99,102,241,0.4)'
    : 'var(--border)';

  return (
    <div style={{ width: '100%' }}>
      <div
        className={shaking ? 'shake' : ''}
        style={{
          position: 'relative',
          borderRadius: radius,
          background: 'var(--surface)',
          border: `1px solid ${borderColor}`,
          transition: 'border-color 160ms ease, box-shadow 160ms ease',
          boxShadow: focused && !hasError
            ? '0 0 0 3px rgba(99,102,241,0.12)'
            : hasError
            ? '0 0 0 3px rgba(248,113,113,0.12)'
            : 'none',
        }}
      >
        {/* Left icon */}
        <div
          style={{
            position: 'absolute',
            left: compact ? 11 : 15,
            top: '50%',
            transform: 'translateY(-50%)',
            color: focused ? '#818cf8' : 'var(--text-tertiary)',
            display: 'flex',
            pointerEvents: 'none',
            transition: 'color 160ms ease',
          }}
        >
          <Link2 size={iconSize} strokeWidth={2} />
        </div>

        <input
          ref={inputRef}
          type="url"
          value={url}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Paste a YouTube or TikTok link..."
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          style={{
            width: '100%',
            height,
            paddingLeft: compact ? 35 : 44,
            paddingRight: compact ? 38 : 48,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize,
            color: 'var(--text-primary)',
            fontFamily: 'inherit',
            caretColor: '#818cf8',
            opacity: disabled ? 0.55 : 1,
            cursor: disabled ? 'not-allowed' : 'text',
          }}
        />

        {/* Right button */}
        <div
          style={{
            position: 'absolute',
            right: compact ? 6 : 8,
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        >
          {url ? (
            <button
              onClick={() => { setUrl(''); setValidationError(null); inputRef.current?.focus(); }}
              style={iconBtnStyle}
            >
              <X size={13} strokeWidth={2.5} />
            </button>
          ) : (
            <button
              onClick={handlePaste}
              title="Paste from clipboard"
              style={{ ...iconBtnStyle, color: 'var(--text-tertiary)' }}
            >
              <ClipboardPaste size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Validation error */}
      {validationError && (
        <p style={{ marginTop: 6, fontSize: 12, color: 'var(--error)', paddingLeft: 4 }}>
          {validationError}
        </p>
      )}

      {/* Helper text — idle only */}
      {!compact && !url && !validationError && (
        <p
          style={{
            marginTop: 10,
            fontSize: 12,
            color: 'var(--text-tertiary)',
            textAlign: 'center',
            letterSpacing: '0.01em',
          }}
        >
          Supports YouTube and TikTok links
        </p>
      )}
    </div>
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
