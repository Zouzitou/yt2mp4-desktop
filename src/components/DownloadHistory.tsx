import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Clock, FileVideo, Folder, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { clearHistory, getHistory, openFile, openFolder } from '../lib/commands';
import type { HistoryEntry } from '../lib/types';
import { formatRelativeTime } from '../lib/time-utils';
import SlidePanel from './SlidePanel';

interface Props { open: boolean; onClose: () => void; }

export default function DownloadHistory({ open, onClose }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    // Backend already returns newest-first; do NOT reverse.
    getHistory()
      .then((h) => setEntries(h))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [open]);

  const handleClear = async () => {
    await clearHistory().catch(() => {});
    setEntries([]);
  };

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            History
          </span>
          {entries.length > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '1px 7px',
              borderRadius: 20, background: 'var(--surface-elevated)',
              color: 'var(--text-tertiary)', border: '1px solid var(--border)',
            }}>
              {entries.length}
            </span>
          )}
        </div>
      }
    >
      {/* Clear button */}
      {entries.length > 0 && (
        <div style={{ padding: '12px 16px 0' }}>
          <button
            onClick={handleClear}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-tertiary)', fontSize: 12, fontFamily: 'inherit',
              padding: 0,
            }}
          >
            <Trash2 size={12} /> Clear all
          </button>
        </div>
      )}

      {/* Content */}
      <div style={{ padding: '10px 12px 0' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="shimmer" style={{ height: 68, borderRadius: 12 }} />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '52px 0', gap: 10, color: 'var(--text-tertiary)',
            }}
          >
            <Clock size={28} strokeWidth={1.5} />
            <p style={{ fontSize: 13, textAlign: 'center' }}>No downloads yet</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {entries.map((entry, i) => {
                const missing = entry.file_exists === false || entry.status === 'failed';
                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 8) * 0.03, duration: 0.2 }}
                  >
                    <HistoryCard
                      entry={entry}
                      missing={missing}
                      onOpenFile={() => openFile(entry.file_path).catch(() => {})}
                      onOpenFolder={() => openFolder(entry.file_path).catch(() => {})}
                    />
                  </motion.div>
                );
              })}
            </div>
          </AnimatePresence>
        )}
      </div>
    </SlidePanel>
  );
}

function HistoryCard({
  entry,
  missing,
  onOpenFile,
  onOpenFolder,
}: {
  entry: HistoryEntry;
  missing: boolean;
  onOpenFile: () => void;
  onOpenFolder: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 12, border: '1px solid var(--border)',
        background: hovered ? 'var(--surface-elevated)' : 'var(--surface)',
        overflow: 'hidden', transition: 'background 140ms ease',
        opacity: missing ? 0.72 : 1,
      }}
    >
      <div style={{ display: 'flex', gap: 10, padding: '10px 12px' }}>
        {/* Thumbnail */}
        <div
          style={{
            width: 60, height: 40, borderRadius: 7,
            flexShrink: 0, overflow: 'hidden',
            background: 'var(--surface-elevated)',
            position: 'relative',
          }}
        >
          {entry.thumbnail_url ? (
            <img
              src={entry.thumbnail_url}
              alt=""
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                filter: missing ? 'grayscale(0.6)' : 'none',
              }}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <FileVideo size={16} color="var(--text-tertiary)" />
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            lineHeight: 1.4,
          }}>
            {entry.title}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 3, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              {formatRelativeTime(entry.downloaded_at)}
            </span>
            {entry.quality && (
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                · {entry.quality}
              </span>
            )}
            {missing && (
              <span
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  fontSize: 10, color: 'var(--warning)', fontWeight: 600,
                  padding: '1px 6px', borderRadius: 20,
                  background: 'rgba(245,158,11,0.1)',
                  border: '1px solid rgba(245,158,11,0.25)',
                }}
              >
                <AlertTriangle size={9} strokeWidth={2.5} />
                {entry.status === 'failed' ? 'Failed' : 'Missing'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action row — disabled if file is gone */}
      <AnimatePresence>
        {hovered && !missing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 34, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              overflow: 'hidden', borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
            }}
          >
            <HovBtn icon={<FileVideo size={12} />} onClick={onOpenFile}>Open</HovBtn>
            <div style={{ width: 1, background: 'var(--border-subtle)' }} />
            <HovBtn icon={<Folder size={12} />} onClick={onOpenFolder}>Show</HovBtn>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function HovBtn({ children, icon, onClick }: {
  children: React.ReactNode; icon: React.ReactNode; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, height: '100%', border: 'none', cursor: 'pointer',
        background: 'transparent', fontSize: 11, fontWeight: 600,
        color: 'var(--text-secondary)', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        transition: 'background 120ms ease',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-hover)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
    >
      {icon}{children}
    </button>
  );
}
