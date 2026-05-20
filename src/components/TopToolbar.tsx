import { Clock, Settings } from 'lucide-react';

interface Props {
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  settingsOpen: boolean;
  historyOpen: boolean;
  hasNewDownloads: boolean;
}

export default function TopToolbar({
  onOpenSettings,
  onOpenHistory,
  settingsOpen,
  historyOpen,
  hasNewDownloads,
}: Props) {
  return (
    <div
      style={{
        height: 38,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingRight: 10,
        paddingLeft: 10,
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0,
        gap: 2,
      }}
    >
      <IconBtn onClick={onOpenHistory} active={historyOpen} label="History (H)">
        <div style={{ position: 'relative', display: 'flex' }}>
          <Clock size={15} strokeWidth={2} />
          {hasNewDownloads && (
            <span
              style={{
                position: 'absolute',
                top: -3,
                right: -3,
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
                boxShadow: '0 0 0 1.5px var(--surface)',
              }}
            />
          )}
        </div>
      </IconBtn>

      <IconBtn onClick={onOpenSettings} active={settingsOpen} label="Settings (⌘,)">
        <Settings size={15} strokeWidth={2} />
      </IconBtn>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  active,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        width: 30,
        height: 28,
        borderRadius: 7,
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: active ? 'rgba(99,102,241,0.14)' : 'transparent',
        color: active ? '#818cf8' : 'var(--text-tertiary)',
        transition: 'background 140ms ease, color 140ms ease',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        if (!active) {
          el.style.background = 'var(--surface-elevated)';
          el.style.color = 'var(--text-secondary)';
        }
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        if (!active) {
          el.style.background = 'transparent';
          el.style.color = 'var(--text-tertiary)';
        }
      }}
    >
      {children}
    </button>
  );
}
