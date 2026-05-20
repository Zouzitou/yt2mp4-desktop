import { listen } from '@tauri-apps/api/event';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import DownloadHistory from './components/DownloadHistory';
import SetupScreen from './components/SetupScreen';
import Settings from './components/Settings';
import SkeletonCard from './components/SkeletonCard';
import TopToolbar from './components/TopToolbar';
import UrlInput from './components/UrlInput';
import VideoPreview from './components/VideoPreview';
import { useClipboardAutoPaste } from './hooks/useClipboard';
import { useTheme } from './hooks/useTheme';
import {
  cancelDownload,
  checkDependencies,
  downloadVideo,
  fetchVideoInfo,
  getDownloadDir,
  getSettings,
  installDependencies,
  openFile,
  openFolder,
  saveSettings,
} from './lib/commands';
import type { DownloadProgress, QualityOption, SetupProgress } from './lib/types';
import { useAppStore } from './stores/useAppStore';
import { useSettingsStore } from './stores/useSettingsStore';

export default function App() {
  useTheme();
  useClipboardAutoPaste();

  const {
    appState,
    setAppState,
    url,
    videoInfo,
    setVideoInfo,
    selectedQuality,
    setSelectedQuality,
    isAudioOnly,
    setIsAudioOnly,
    clip,
    setClip,
    downloadProgress,
    setDownloadProgress,
    downloadedFilePath,
    setDownloadedFilePath,
    error,
    setError,
    reset,
  } = useAppStore();

  const { settings, setSettings } = useSettingsStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [hasNewDownloads, setHasNewDownloads] = useState(false);
  const [setupProgress, setSetupProgress] = useState<{
    ytdlp: SetupProgress | null;
    ffmpeg: SetupProgress | null;
  }>({ ytdlp: null, ffmpeg: null });
  const [setupError, setSetupError] = useState<string | null>(null);
  const downloadAbortRef = useRef(false);
  // Increments on every URL submit. Stale responses are ignored.
  const fetchIdRef = useRef(0);
  // Avoid re-asking for notification permission once denied
  const notificationAskedRef = useRef(false);
  const installingRef = useRef(false);

  // Load settings on mount
  useEffect(() => {
    getSettings()
      .then(async (s) => {
        let updated = s;
        if (!s.download_dir) {
          const dir = await getDownloadDir();
          updated = { ...s, download_dir: dir };
          saveSettings(updated).catch(() => {});
        }
        setSettings(updated);
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Check deps on mount
  useEffect(() => {
    checkDependencies()
      .then((status) => {
        if (!status.ytdlp || !status.ffmpeg) {
          setAppState('setup');
          runInstall();
        }
        // Already have binaries — stay idle
      })
      .catch(() => {
        setAppState('setup');
        runInstall();
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Setup progress events
  useEffect(() => {
    const u1 = listen<SetupProgress>('setup-progress', (e) => {
      const p = e.payload;
      setSetupProgress((prev) => ({ ...prev, [p.step]: p }));
    });
    const u2 = listen('setup-complete', () => {
      setTimeout(() => setAppState('idle'), 700);
    });
    return () => {
      u1.then((f) => f());
      u2.then((f) => f());
    };
  }, [setAppState]);

  // Download progress events
  useEffect(() => {
    const u = listen<DownloadProgress>('download-progress', (e) => {
      setDownloadProgress(e.payload);
    });
    return () => { u.then((f) => f()); };
  }, [setDownloadProgress]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setSettingsOpen((v) => !v);
      }
      if (e.key === 'h' || e.key === 'H') {
        if (!settingsOpen && !historyOpen && appState !== 'setup' && appState !== 'setup_error') {
          setHistoryOpen(true);
          setHasNewDownloads(false);
        }
      }
      if (e.key === 'Escape') {
        if (settingsOpen) { setSettingsOpen(false); return; }
        if (historyOpen)  { setHistoryOpen(false);  return; }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [settingsOpen, historyOpen, appState]);

  const runInstall = async () => {
    if (installingRef.current) return;
    installingRef.current = true;
    setSetupError(null);
    try {
      await installDependencies();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setSetupError(msg);
      setAppState('setup_error');
    } finally {
      installingRef.current = false;
    }
  };

  const handleUrlSubmit = async (submittedUrl: string) => {
    if (appState === 'downloading') return;
    const myFetchId = ++fetchIdRef.current;
    setAppState('fetching');
    setError(null);
    setVideoInfo(null);
    setSelectedQuality(null);
    setClip(null);

    try {
      const info = await fetchVideoInfo(submittedUrl);

      // Ignore stale responses (user submitted another URL meanwhile)
      if (myFetchId !== fetchIdRef.current) return;

      if (info.is_live) {
        setError("Live streams can't be downloaded while broadcasting. Wait for it to end.");
        setAppState('fetch_error');
        return;
      }

      setVideoInfo(info);

      // Auto-select quality based on user's default preference
      const defaultQ = settings.default_quality;
      let autoSelect: QualityOption | null = null;

      if (defaultQ === 'best') {
        autoSelect = info.quality_options.find((q) => q.is_best) ?? null;
      } else {
        const targetHeight = parseInt(defaultQ, 10);
        if (Number.isFinite(targetHeight)) {
          autoSelect =
            info.quality_options
              .filter((q) => !q.is_audio_only && q.height != null && q.height <= targetHeight)
              .sort((a, b) => (b.height ?? 0) - (a.height ?? 0))[0] ??
            info.quality_options.find((q) => q.is_best) ??
            null;
        } else {
          autoSelect = info.quality_options.find((q) => q.is_best) ?? null;
        }
      }

      if (info.quality_options.length === 0) {
        setError('No downloadable formats found for this video.');
        setAppState('fetch_error');
        return;
      }

      setSelectedQuality(autoSelect);

      // If only audio formats exist, switch to audio mode
      const hasVideoFormats = info.quality_options.some((q) => !q.is_audio_only);
      setIsAudioOnly(!hasVideoFormats);

      setAppState('preview');
    } catch (e: unknown) {
      if (myFetchId !== fetchIdRef.current) return;
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setAppState('fetch_error');
    }
  };

  const handleDownload = async () => {
    if (!videoInfo || appState === 'downloading') return;
    downloadAbortRef.current = false;
    setAppState('downloading');
    setDownloadProgress(null);
    setError(null);

    let qualityOption = isAudioOnly
      ? videoInfo.quality_options.find((q) => q.is_audio_only)
      : selectedQuality ?? videoInfo.quality_options.find((q) => q.is_best);

    // Final fallback — if nothing matched (rare), try any non-audio option, then any option
    if (!qualityOption) {
      qualityOption =
        videoInfo.quality_options.find((q) => !q.is_audio_only) ??
        videoInfo.quality_options[0];
    }

    if (!qualityOption) {
      setError('No downloadable formats found for this video.');
      setAppState('download_error');
      return;
    }

    const outputDir = settings.download_dir || (await getDownloadDir());
    const downloadUrl = videoInfo.webpage_url?.trim() || url.trim();
    if (!downloadUrl) {
      setError('Missing video URL. Paste the link again.');
      setAppState('download_error');
      return;
    }

    try {
      const filePath = await downloadVideo({
        url: downloadUrl,
        formatSelector: qualityOption.format_selector,
        outputDir,
        isAudioOnly,
        videoId: videoInfo.id,
        title: videoInfo.title,
        thumbnailUrl: videoInfo.thumbnail,
        channel: videoInfo.channel,
        duration: videoInfo.duration,
        qualityLabel: qualityOption.label,
        clipStart: clip?.start ?? null,
        clipEnd: clip?.end ?? null,
        outputFormat: settings.default_format,
      });

      if (downloadAbortRef.current) { setAppState('preview'); return; }

      setDownloadedFilePath(filePath);
      setAppState('complete');
      setHasNewDownloads(true);

      // Send OS notification
      if (settings.notification_on_complete) {
        try {
          let granted = await isPermissionGranted();
          // Only ask once per session — if denied, don't keep nagging
          if (!granted && !notificationAskedRef.current) {
            notificationAskedRef.current = true;
            granted = (await requestPermission()) === 'granted';
          }
          if (granted) sendNotification({ title: 'Download Complete', body: videoInfo.title });
        } catch { /* notification errors are non-fatal */ }
      }
    } catch (e: unknown) {
      if (downloadAbortRef.current) { setAppState('preview'); return; }
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'cancelled') { setAppState('preview'); return; }
      setError(msg);
      setAppState('download_error');
    }
  };

  const handleCancel = () => {
    downloadAbortRef.current = true;
    // Actually kill the underlying yt-dlp / ffmpeg process
    cancelDownload().catch(() => {});
    setDownloadProgress(null);
    setAppState('preview');
  };

  const handleOpenFile = () => {
    if (downloadedFilePath) openFile(downloadedFilePath).catch(() => {});
  };
  const handleOpenFolder = () => {
    if (downloadedFilePath) openFolder(downloadedFilePath).catch(() => {});
  };
  const handleDownloadAnother = () => { reset(); setClip(null); };
  const handleRetryDownload = () => { setAppState('preview'); setError(null); };

  const downloadButtonState = (): 'ready' | 'downloading' | 'complete' | 'error' => {
    if (appState === 'downloading')    return 'downloading';
    if (appState === 'complete')       return 'complete';
    if (appState === 'download_error') return 'error';
    return 'ready';
  };

  const isSetup   = appState === 'setup' || appState === 'setup_error';
  const isIdle    = appState === 'idle';
  const showPreview = ['preview', 'downloading', 'complete', 'download_error'].includes(appState);
  const urlInputDisabled = appState === 'fetching' || appState === 'downloading';

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
        overflow: 'hidden',
      }}
    >
      {/* Top toolbar — hidden during setup */}
      <AnimatePresence>
        {!isSetup && (
          <motion.div
            key="toolbar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <TopToolbar
              onOpenSettings={() => setSettingsOpen(true)}
              onOpenHistory={() => {
                setHistoryOpen(true);
                setHasNewDownloads(false);
              }}
              settingsOpen={settingsOpen}
              historyOpen={historyOpen}
              hasNewDownloads={hasNewDownloads}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main scrollable area */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
        <AnimatePresence mode="wait">
          {/* ── Setup Screen ── */}
          {isSetup && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              style={{ height: '100%' }}
            >
              <SetupScreen
                ytdlpProgress={setupProgress.ytdlp}
                ffmpegProgress={setupProgress.ffmpeg}
                error={setupError}
                onRetry={() => {
                  setSetupError(null);
                  setSetupProgress({ ytdlp: null, ffmpeg: null });
                  setAppState('setup');
                  runInstall();
                }}
              />
            </motion.div>
          )}

          {/* ── Main App ── */}
          {!isSetup && (
            <motion.div
              key="main"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                padding: '8px 16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                minHeight: '100%',
              }}
            >
              {/* URL input — centered in idle, compact at top otherwise */}
              <AnimatePresence mode="wait">
                {isIdle ? (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96, y: -10 }}
                    transition={{ type: 'spring', damping: 26, stiffness: 320 }}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingBottom: 32,
                      gap: 28,
                    }}
                  >
                    {/* Hero mark */}
                    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 14,
                          background: 'linear-gradient(145deg, #8b5cf6, #4f46e5, #3b82f6)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 8px 28px rgba(99,102,241,0.35)',
                        }}
                      >
                        <DownloadIcon />
                      </div>
                      <div>
                        <h1
                          style={{
                            fontSize: 22,
                            fontWeight: 800,
                            letterSpacing: '-0.03em',
                            background: 'linear-gradient(135deg, #c4b5fd, #818cf8, #60a5fa)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                            lineHeight: 1.15,
                            marginBottom: 4,
                          }}
                        >
                          Yt2Mp4
                        </h1>
                        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', letterSpacing: '0.01em' }}>
                          Paste · Pick quality · Download
                        </p>
                      </div>
                    </div>

                    <div style={{ width: '100%' }}>
                      <UrlInput onSubmit={handleUrlSubmit} disabled={urlInputDisabled} />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="compact"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <UrlInput onSubmit={handleUrlSubmit} compact disabled={urlInputDisabled} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Fetch error */}
              <AnimatePresence>
                {appState === 'fetch_error' && error && (
                  <motion.div
                    key="fetch-err"
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 12,
                      background: 'rgba(248, 113, 113, 0.08)',
                      border: '1px solid rgba(248, 113, 113, 0.18)',
                      fontSize: 13,
                      color: 'var(--error)',
                      lineHeight: 1.55,
                    }}
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Loading skeleton */}
              <AnimatePresence>
                {appState === 'fetching' && (
                  <motion.div
                    key="skeleton"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.22 }}
                  >
                    <SkeletonCard />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Video preview card */}
              <AnimatePresence>
                {showPreview && videoInfo && (
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0, y: 14, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                  >
                    <VideoPreview
                      videoInfo={videoInfo}
                      selectedQuality={selectedQuality}
                      isAudioOnly={isAudioOnly}
                      clip={clip}
                      onSelectQuality={setSelectedQuality}
                      onModeChange={setIsAudioOnly}
                      onClipChange={setClip}
                      onDownload={handleDownload}
                      onCancel={handleCancel}
                      onOpenFile={handleOpenFile}
                      onOpenFolder={handleOpenFolder}
                      onDownloadAnother={handleDownloadAnother}
                      onRetry={handleRetryDownload}
                      downloadState={downloadButtonState()}
                      downloadProgress={downloadProgress}
                      downloadError={error}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Side panels */}
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <DownloadHistory open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v13" />
      <path d="M5 11l7 7 7-7" />
      <path d="M3 21h18" />
    </svg>
  );
}
