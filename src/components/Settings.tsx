import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { openUrl } from '@tauri-apps/plugin-opener';
import { ExternalLink, Loader2, Monitor, Moon, RefreshCcw, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { checkYtdlpUpdate, getDownloadDir, saveSettings, updateYtdlp } from '../lib/commands';
import { useSettingsStore } from '../stores/useSettingsStore';
import SlidePanel from './SlidePanel';
import Toggle from './Toggle';

interface Props { open: boolean; onClose: () => void; }

export default function SettingsPanel({ open, onClose }: Props) {
  const { settings, setSettings, ytdlpUpdateAvailable, setYtdlpUpdateAvailable } = useSettingsStore();
  const [updating, setUpdating] = useState(false);
  const [updateDone, setUpdateDone] = useState(false);
  const [checking, setChecking] = useState(false);
  const [upToDate, setUpToDate] = useState(false);

  useEffect(() => {
    if (open) {
      setUpToDate(false);
      setUpdateDone(false);
      checkYtdlpUpdate().then(setYtdlpUpdateAvailable).catch(() => {});
    }
  }, [open, setYtdlpUpdateAvailable]);

  const handleCheck = async () => {
    setChecking(true);
    setUpToDate(false);
    try {
      const result = await checkYtdlpUpdate();
      setYtdlpUpdateAvailable(result);
      if (!result) {
        setUpToDate(true);
        setTimeout(() => setUpToDate(false), 2500);
      }
    } catch { /* silent */ }
    setChecking(false);
  };

  const handleSetting = <K extends keyof typeof settings>(k: K, v: (typeof settings)[K]) => {
    const next = { ...settings, [k]: v };
    setSettings(next);
    saveSettings(next).catch(() => {});
  };

  const handlePickFolder = async () => {
    const sel = await openDialog({ directory: true, multiple: false }).catch(() => null);
    if (sel && typeof sel === 'string') handleSetting('download_dir', sel);
  };

  const handleResetFolder = async () => {
    const dir = await getDownloadDir();
    handleSetting('download_dir', dir);
  };

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      await updateYtdlp();
      setUpdateDone(true);
      setYtdlpUpdateAvailable(null);
    } catch {
      setUpdateDone(false);
    }
    setUpdating(false);
  };

  const themes = [
    { value: 'light',  icon: <Sun size={13} />,     label: 'Light' },
    { value: 'system', icon: <Monitor size={13} />,  label: 'System' },
    { value: 'dark',   icon: <Moon size={13} />,     label: 'Dark' },
  ] as const;

  const qualities = ['best', '2160', '1440', '1080', '720', '480', '360'];
  const formats   = ['mp4', 'mkv', 'webm'];

  return (
    <SlidePanel open={open} onClose={onClose} title="Settings">
      {/* ── Downloads ─────────────────────────── */}
      <Section label="Downloads" />

      <Row label="Save to" description={truncatePath(settings.download_dir)}>
        <div style={{ display: 'flex', gap: 5 }}>
          <Btn onClick={handlePickFolder}>Change</Btn>
          <Btn onClick={handleResetFolder} muted>Reset</Btn>
        </div>
      </Row>

      <Row label="Default quality">
        <select
          value={settings.default_quality}
          onChange={(e) => handleSetting('default_quality', e.target.value)}
          style={selectStyle}
        >
          {qualities.map((q) => (
            <option key={q} value={q}>{q === 'best' ? 'Best available' : `${q}p`}</option>
          ))}
        </select>
      </Row>

      <Row label="Format">
        <SegControl
          options={formats.map((f) => ({ value: f, label: f.toUpperCase() }))}
          value={settings.default_format}
          onChange={(v) => handleSetting('default_format', v)}
        />
      </Row>

      {/* ── Behavior ──────────────────────────── */}
      <Section label="Behavior" />

      <Row label="Auto-paste links" description="Fill URL when a YouTube link is copied">
        <Toggle checked={settings.auto_paste} onChange={(v) => handleSetting('auto_paste', v)} />
      </Row>

      <Row label="Notify when done" description="Desktop notification on completion">
        <Toggle
          checked={settings.notification_on_complete}
          onChange={(v) => handleSetting('notification_on_complete', v)}
        />
      </Row>

      {/* ── Appearance ────────────────────────── */}
      <Section label="Appearance" />

      <Row label="Theme">
        <div style={{ display: 'flex', background: 'var(--surface-elevated)', borderRadius: 8, padding: 2, gap: 2 }}>
          {themes.map(({ value, icon, label }) => (
            <button
              key={value}
              onClick={() => handleSetting('theme', value)}
              title={label}
              style={{
                width: 33,
                height: 27,
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: settings.theme === value
                  ? 'linear-gradient(135deg, #8b5cf6, #3b82f6)'
                  : 'transparent',
                color: settings.theme === value ? '#fff' : 'var(--text-tertiary)',
                transition: 'all 150ms ease',
                fontFamily: 'inherit',
              }}
            >{icon}</button>
          ))}
        </div>
      </Row>

      {/* ── About ─────────────────────────────── */}
      <Section label="About" />

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* App version */}
        <InfoRow label="Yt2Mp4 Desktop" value="v1.0.0" />

        {/* yt-dlp version */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>yt-dlp</div>
            {ytdlpUpdateAvailable && (
              <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 2 }}>
                Update available: {ytdlpUpdateAvailable}
              </div>
            )}
            {updateDone && (
              <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 2 }}>Updated!</div>
            )}
            {upToDate && !ytdlpUpdateAvailable && !updateDone && (
              <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 2 }}>Up to date</div>
            )}
          </div>
          {ytdlpUpdateAvailable ? (
            <Btn onClick={handleUpdate} disabled={updating}>
              {updating
                ? <><Loader2 size={11} style={{ animation: 'spin 0.8s linear infinite' }} /> Updating...</>
                : <><RefreshCcw size={11} /> Update</>}
            </Btn>
          ) : (
            <Btn onClick={handleCheck} muted disabled={checking}>
              {checking
                ? <><Loader2 size={11} style={{ animation: 'spin 0.8s linear infinite' }} /> Checking...</>
                : 'Check'}
            </Btn>
          )}
        </div>

        {/* Source link */}
        <button
          onClick={() => openUrl('https://github.com').catch(() => {})}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: '#818cf8', fontSize: 13, fontFamily: 'inherit', padding: 0,
          }}
        >
          <ExternalLink size={13} /> Source code
        </button>

        {/* Footer */}
        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', paddingBottom: 4 }}>
          Made with Tauri 2 + Rust + React
        </p>
      </div>
    </SlidePanel>
  );
}

/* ── Sub-components ───────────────────────────────────── */

function Section({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 800, letterSpacing: '0.09em',
      textTransform: 'uppercase', color: 'var(--text-tertiary)',
      padding: '20px 16px 8px',
    }}>
      {label}
    </div>
  );
}

function Row({ label, description, children }: {
  label: string; description?: string; children: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '9px 16px', gap: 12, minHeight: 44,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
        {description && (
          <div style={{
            fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {description}
          </div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{value}</span>
    </div>
  );
}

function Btn({
  children, onClick, muted, disabled,
}: {
  children: React.ReactNode; onClick?: () => void; muted?: boolean; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        padding: '5px 10px', borderRadius: 7,
        border: '1px solid var(--border)',
        background: muted ? 'transparent' : 'var(--surface-elevated)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 12, fontWeight: 500,
        color: muted ? 'var(--text-tertiary)' : 'var(--text-primary)',
        fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
        opacity: disabled ? 0.5 : 1, transition: 'background 140ms ease',
      }}
    >{children}</button>
  );
}

function SegControl({
  options, value, onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', background: 'var(--surface-elevated)', borderRadius: 8, padding: 2, gap: 2 }}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            padding: '4px 10px', borderRadius: 6, border: 'none',
            cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
            background: value === o.value ? 'linear-gradient(135deg, #8b5cf6, #3b82f6)' : 'transparent',
            color: value === o.value ? '#fff' : 'var(--text-secondary)',
            transition: 'all 150ms ease',
          }}
        >{o.label}</button>
      ))}
    </div>
  );
}

function truncatePath(path: string): string {
  if (!path) return 'Not set';
  if (path.length <= 34) return path;
  const parts = path.split(/[/\\]/);
  return `…/${parts.slice(-2).join('/')}`;
}

const selectStyle: React.CSSProperties = {
  background: 'var(--surface-elevated)', border: '1px solid var(--border)',
  borderRadius: 7, padding: '4px 8px', fontSize: 12,
  color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
};
