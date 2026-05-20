# Yt2Mp4 Desktop

A free, simple, cross-platform desktop app to download **YouTube** and **TikTok** videos locally. No ads, no accounts — paste a link, pick quality, download.

![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue)
![Version](https://img.shields.io/github/v/release/Zouzitou/yt2mp4-desktop?label=version)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- **YouTube & TikTok** — paste a link and get a preview (thumbnail, title, channel)
- **Quality picker** — automatically selects best quality; switch to any available resolution or audio-only MP3
- **Optional clip** — download only part of a video (start/end time) with updated size estimates
- **Downloads folder** — saves to your OS Downloads directory (customizable in Settings)
- **Fully local** — uses bundled `yt-dlp` and `ffmpeg` (installed on first launch)
- **Download history** — revisit past downloads, open files or folders
- **Themes** — light, dark, or system

## Download

Get the latest release from [GitHub Releases](https://github.com/Zouzitou/yt2mp4-desktop/releases):

| Platform | File |
|----------|------|
| **macOS** (Apple Silicon) | `Yt2Mp4_*.dmg` |
| **Windows** (64-bit) | `Yt2Mp4 Setup *.exe` — installer only (WebView2 bootstrapper if needed) |

### v1.1 highlights

- TikTok download support (same flow as YouTube)
- Optional clip / trim before download
- Bug fixes and UX improvements (progress bar, cancel, history, and more)

## Quick start

1. Install and open the app.
2. On first launch, wait for **yt-dlp** and **ffmpeg** to download (one-time setup).
3. Paste a YouTube or TikTok URL.
4. Choose quality (and optionally enable **Clip video**).
5. Click **Download**.

Files appear in your Downloads folder (or the path set in Settings).

## Development

**Requirements:** Node.js 20+, Rust (stable), and platform tools for [Tauri 2](https://v2.tauri.app/start/prerequisites/).

```bash
npm install
npm run tauri dev
```

**Production build (macOS):**

```bash
npm run tauri build
```

**Windows cross-compile from macOS** (optional): `rustup target add x86_64-pc-windows-msvc`, `cargo install cargo-xwin`, NSIS (`brew install nsis`).

```bash
npm run tauri build -- --target x86_64-pc-windows-msvc
```

Artifacts are under `src-tauri/target/release/bundle/` (and the Windows target folder for cross-builds).

## Tech stack

- [Tauri 2](https://tauri.app/) + Rust
- React 19, TypeScript, Vite
- Tailwind CSS v4, Framer Motion, Zustand
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) + ffmpeg

## Privacy

All processing happens on your machine. The app does not send video URLs or downloads to any third-party server except what yt-dlp needs to fetch from the video platforms.

## License

MIT — see [LICENSE](LICENSE) if present, or use at your own discretion for personal use.

## Author

[Zouzitou](https://github.com/Zouzitou)
