const VIDEO_REGEX =
  /^(https?:\/\/)?((www\.|m\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}|(www\.|vm\.)?tiktok\.com\/((@[^/?#]+\/video\/\d+)|(t\/[A-Za-z0-9]+)|([A-Za-z0-9_-]{5,})))/;

export function isVideoUrl(url: string): boolean {
  return VIDEO_REGEX.test(url.trim());
}

export function parseBulkUrls(text: string): { valid: string[]; invalid: string[] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    if (!isVideoUrl(line)) {
      invalid.push(line);
      continue;
    }
    const key = line.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    valid.push(line);
  }

  return { valid, invalid };
}

export function extractVideoId(url: string): string {
  const trimmed = url.trim();
  const ytMatch =
    trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/) ??
    trimmed.match(/youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return ytMatch[1];

  // TikTok: @user/video/12345, /t/XXXXX, or short-code
  const tiktokVideo = trimmed.match(/tiktok\.com\/@([^/]+)\/video\/(\d+)/);
  if (tiktokVideo) return tiktokVideo[2];
  const tiktokShort = trimmed.match(/tiktok\.com\/t\/([A-Za-z0-9]+)/);
  if (tiktokShort) return tiktokShort[1];
  // Short-code URLs — TikTok IDs are 6-11 chars, not reserved paths
  const RESERVED = new Set(['about','discover','following','legal','live','login','trending','upload','privacy','terms','community','explore']);
  const tiktokCode = trimmed.match(/tiktok\.com\/([A-Za-z0-9_-]{6,15})/);
  if (tiktokCode && !RESERVED.has(tiktokCode[1].toLowerCase())) return tiktokCode[1];

  return '';
}

export function shortUrlLabel(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    const path = u.pathname.length > 36 ? `${u.pathname.slice(0, 36)}…` : u.pathname;
    return `${u.hostname}${path}`;
  } catch {
    return url.length > 48 ? `${url.slice(0, 48)}…` : url;
  }
}
