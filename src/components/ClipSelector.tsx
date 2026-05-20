import { AnimatePresence, motion } from 'framer-motion';
import { Scissors } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ClipRange } from '../lib/types';

interface Props {
  totalDuration: number; // seconds
  clip: ClipRange | null;
  onChange: (clip: ClipRange | null) => void;
  disabled?: boolean;
}

// Format seconds → MM:SS or H:MM:SS
export function formatSeconds(s: number): string {
  const total = Math.round(s);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// Parse "MM:SS", "H:MM:SS", or plain seconds string → seconds
function parseTime(raw: string, max: number): number | null {
  const str = raw.trim();
  if (!str) return null;

  // Pure number (e.g. "90")
  if (/^\d+$/.test(str)) {
    const n = parseInt(str, 10);
    return n <= max ? n : null;
  }

  const parts = str.split(':').map((p) => parseInt(p, 10));
  if (parts.some(isNaN) || parts.length < 2 || parts.length > 3) return null;

  let seconds = 0;
  if (parts.length === 3) {
    seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else {
    seconds = parts[0] * 60 + parts[1];
  }
  return seconds >= 0 && seconds <= max ? seconds : null;
}

export default function ClipSelector({ totalDuration, clip, onChange, disabled }: Props) {
  const [enabled, setEnabled] = useState(false);

  // Keep the toggle in sync with the clip state in both directions
  useEffect(() => {
    setEnabled(clip !== null);
  }, [clip]);

  const toggle = () => {
    if (disabled) return;
    if (enabled) {
      setEnabled(false);
      onChange(null);
    } else {
      setEnabled(true);
      // Smart default: select the first third (capped at 60s) — a useful,
      // visibly-different starting selection so the user sees the file size drop.
      const defaultEnd = Math.max(
        5,
        Math.min(Math.round(totalDuration / 3), 60),
      );
      onChange({ start: 0, end: Math.min(defaultEnd, totalDuration) });
    }
  };

  const handleChange = (field: 'start' | 'end', seconds: number) => {
    if (!clip) return;
    // Clamp the incoming value to the total duration before doing anything else
    const clamped = Math.max(0, Math.min(seconds, totalDuration));
    const next = { ...clip, [field]: clamped };
    // Maintain start < end with a minimum 1-second window
    if (field === 'start' && next.start >= clip.end) {
      next.start = Math.max(0, clip.end - 1);
    }
    if (field === 'end' && next.end <= clip.start) {
      next.end = Math.min(totalDuration, clip.start + 1);
    }
    onChange(next);
  };

  const clipDuration = clip ? clip.end - clip.start : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Toggle row */}
      <button
        onClick={toggle}
        disabled={disabled}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          height: 36,
          paddingLeft: 11,
          paddingRight: 11,
          borderRadius: 10,
          border: `1px solid ${enabled ? 'rgba(99,102,241,0.35)' : 'var(--border)'}`,
          background: enabled ? 'rgba(99,102,241,0.08)' : 'transparent',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          opacity: disabled ? 0.5 : 1,
          transition: 'border-color 140ms ease, background 140ms ease',
          width: '100%',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Scissors size={13} color={enabled ? '#818cf8' : 'var(--text-tertiary)'} strokeWidth={2} />
          <span style={{ fontSize: 13, fontWeight: 500, color: enabled ? '#c4b5fd' : 'var(--text-secondary)' }}>
            Clip video
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>— optional</span>
        </div>

        {/* Pill toggle indicator */}
        <div
          style={{
            width: 34,
            height: 18,
            borderRadius: 99,
            background: enabled
              ? 'linear-gradient(135deg, #8b5cf6, #3b82f6)'
              : 'var(--surface-elevated)',
            position: 'relative',
            transition: 'background 180ms ease',
            flexShrink: 0,
            border: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 2,
              left: enabled ? 16 : 2,
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: enabled ? '#fff' : 'var(--text-tertiary)',
              transition: 'left 180ms cubic-bezier(0.34,1.56,0.64,1)',
            }}
          />
        </div>
      </button>

      {/* Time range inputs */}
      <AnimatePresence>
        {enabled && clip && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <TimeInput
                  label="From"
                  value={clip.start}
                  max={totalDuration}
                  onChange={(s) => handleChange('start', s)}
                />
                <TimeInput
                  label="To"
                  value={clip.end}
                  max={totalDuration}
                  onChange={(s) => handleChange('end', s)}
                />
              </div>

              {/* Duration summary */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 11px',
                  borderRadius: 9,
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--border)',
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Clip duration
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatSeconds(clipDuration)}
                  <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 6 }}>
                    of {formatSeconds(totalDuration)}
                  </span>
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Time input ─────────────────────────────────────── */
function TimeInput({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (s: number) => void;
}) {
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const display = editing ? draft : formatSeconds(value);

  const commit = () => {
    const parsed = parseTime(draft, max);
    if (parsed !== null) {
      onChange(parsed);
      setInvalid(false);
    } else {
      // Reset to current value if invalid
      setInvalid(true);
      setTimeout(() => setInvalid(false), 800);
    }
    setEditing(false);
  };

  const handleFocus = () => {
    setDraft(formatSeconds(value));
    setEditing(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { inputRef.current?.blur(); }
    if (e.key === 'Escape') { setEditing(false); setDraft(''); inputRef.current?.blur(); }
  };

  // Slider value as 0–100%
  const pct = max > 0 ? value / max : 0;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label}
      </span>

      {/* Text input */}
      <div
        className={invalid ? 'shake' : ''}
        style={{
          borderRadius: 9,
          border: `1px solid ${invalid ? 'rgba(248,113,113,0.5)' : editing ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
          background: 'var(--surface)',
          transition: 'border-color 140ms ease',
          boxShadow: editing ? '0 0 0 3px rgba(99,102,241,0.1)' : 'none',
          overflow: 'hidden',
        }}
      >
        <input
          ref={inputRef}
          value={display}
          onFocus={handleFocus}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          style={{
            width: '100%',
            height: 34,
            padding: '0 10px',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary)',
            fontFamily: 'monospace',
            fontVariantNumeric: 'tabular-nums',
            textAlign: 'center',
            caretColor: '#818cf8',
          }}
          placeholder="0:00"
        />
      </div>

      {/* Range slider */}
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: '100%',
          height: 4,
          cursor: 'pointer',
          accentColor: '#8b5cf6',
          background: `linear-gradient(to right, #8b5cf6 ${pct * 100}%, var(--surface-elevated) ${pct * 100}%)`,
          borderRadius: 99,
          outline: 'none',
          border: 'none',
        }}
      />
    </div>
  );
}
