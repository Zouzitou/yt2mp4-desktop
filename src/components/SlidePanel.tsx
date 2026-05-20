import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
}

export default function SlidePanel({ open, onClose, title, children }: Props) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="bd"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.38)',
              zIndex: 40,
            }}
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 380, mass: 0.85 }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: 316,
              background: 'var(--surface)',
              borderLeft: '1px solid var(--border)',
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderBottom: '1px solid var(--border)',
                flexShrink: 0,
              }}
            >
              <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                {typeof title === 'string' ? (
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                    {title}
                  </span>
                ) : title}
              </div>
              <button
                onClick={onClose}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  border: '1px solid var(--border)',
                  background: 'var(--surface-elevated)',
                  cursor: 'pointer',
                  color: 'var(--text-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  lineHeight: 1,
                  fontFamily: 'inherit',
                  transition: 'background 140ms ease',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-hover)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-elevated)'; }}
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 20px' }}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
