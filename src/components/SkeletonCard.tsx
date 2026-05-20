export default function SkeletonCard() {
  return (
    <div
      style={{
        background: 'var(--surface)',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid var(--border)',
        boxShadow: '0 2px 16px rgba(0,0,0,0.1)',
      }}
    >
      {/* Thumbnail */}
      <div className="shimmer" style={{ width: '100%', aspectRatio: '16/9' }} />
      {/* Body */}
      <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Title lines */}
        <div>
          <div className="shimmer" style={{ height: 15, borderRadius: 6, width: '88%', marginBottom: 7 }} />
          <div className="shimmer" style={{ height: 15, borderRadius: 6, width: '64%', marginBottom: 10 }} />
          <div className="shimmer" style={{ height: 12, borderRadius: 6, width: '44%' }} />
        </div>
        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border-subtle)', margin: '0 -14px' }} />
        {/* Mode toggle */}
        <div className="shimmer" style={{ height: 36, borderRadius: 10, width: '100%' }} />
        {/* Dropdown */}
        <div className="shimmer" style={{ height: 40, borderRadius: 10, width: '100%' }} />
        {/* Download button */}
        <div className="shimmer" style={{ height: 48, borderRadius: 13, width: '100%' }} />
      </div>
    </div>
  );
}
