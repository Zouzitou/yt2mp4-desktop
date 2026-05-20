export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatViewCount(count: number): string {
  if (count >= 1_000_000_000) return `${(count / 1_000_000_000).toFixed(1)}B views`;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M views`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(0)}K views`;
  return `${count} views`;
}

export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffHours < 1) return `${diffMins}m ago`;
  if (diffDays < 1) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function formatUploadDate(yyyymmdd: string): string {
  if (!yyyymmdd || yyyymmdd.length !== 8) return '';
  const year = yyyymmdd.slice(0, 4);
  const month = yyyymmdd.slice(4, 6);
  const day = yyyymmdd.slice(6, 8);
  const date = new Date(`${year}-${month}-${day}`);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function isToday(isoString: string): boolean {
  const date = new Date(isoString);
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

export function isYesterday(isoString: string): boolean {
  const date = new Date(isoString);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return date.toDateString() === yesterday.toDateString();
}

export function isThisWeek(isoString: string): boolean {
  const date = new Date(isoString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays < 7;
}
