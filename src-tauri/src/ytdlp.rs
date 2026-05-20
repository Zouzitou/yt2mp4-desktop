use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::Mutex as TokioMutex;

use crate::formats::{process_formats, QualityOption, RawFormat};
use crate::progress::{parse_progress_line, DownloadProgress};
use crate::utils::{ffmpeg_binary_name, ytdlp_binary_name};

/// Tracks the active download subprocess and whether the user requested cancel.
pub struct DownloadSession {
    pub pid: Option<u32>,
    pub user_cancelled: bool,
}

impl Default for DownloadSession {
    fn default() -> Self {
        Self {
            pid: None,
            user_cancelled: false,
        }
    }
}

/// Shared via Tauri-managed state so the frontend can cancel downloads.
pub type ActiveDownload = Arc<TokioMutex<DownloadSession>>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoInfo {
    pub id: String,
    pub title: String,
    pub thumbnail: String,
    pub duration: u64,
    pub channel: String,
    pub view_count: Option<u64>,
    pub upload_date: Option<String>,
    pub webpage_url: String,
    pub quality_options: Vec<QualityOption>,
    pub is_live: Option<bool>,
    pub availability: Option<String>,
}

fn ytdlp_path(app_data_dir: &PathBuf) -> PathBuf {
    app_data_dir
        .join("bin")
        .join(ytdlp_binary_name())
}

fn ffmpeg_path(app_data_dir: &PathBuf) -> PathBuf {
    app_data_dir
        .join("bin")
        .join(ffmpeg_binary_name())
}

/// Fetch video metadata using yt-dlp --dump-json.
pub async fn fetch_video_info(
    url: &str,
    app_data_dir: &PathBuf,
) -> Result<VideoInfo, String> {
    let ytdlp = ytdlp_path(app_data_dir);
    if !ytdlp.exists() {
        return Err("yt-dlp is not installed. Restart the app to run setup.".to_string());
    }

    let output = tokio::time::timeout(
        std::time::Duration::from_secs(30),
        Command::new(&ytdlp)
            .args([
                "--dump-json",
                "--no-playlist",
                "--no-warnings",
                "--color",
                "never",
                url,
            ])
            .output(),
    )
    .await
    .map_err(|_| "Connection timed out. Check your internet.".to_string())?
    .map_err(|e| format!("Failed to run yt-dlp: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(classify_fetch_error(&stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    // yt-dlp may emit warnings or other lines before the JSON; find the
    // first line that looks like a JSON object (starts with '{').
    let json_line = stdout
        .lines()
        .find(|l| l.trim_start().starts_with('{'))
        .ok_or_else(|| "yt-dlp did not return any video metadata.".to_string())?;

    let json: Value = serde_json::from_str(json_line.trim())
        .map_err(|e| format!("Failed to parse video info: {}", e))?;

    parse_video_info(&json)
}

fn classify_fetch_error(stderr: &str) -> String {
    let stderr_lower = stderr.to_lowercase();
    if stderr_lower.contains("video unavailable") || stderr_lower.contains("this video is not available") {
        "This video is private or has been deleted.".to_string()
    } else if stderr_lower.contains("sign in to confirm your age") || stderr_lower.contains("age-restricted") {
        "This video is age-restricted and cannot be downloaded.".to_string()
    } else if stderr_lower.contains("this live event will begin") {
        "This is an upcoming live stream. It's not available yet.".to_string()
    } else if stderr_lower.contains("premieres in") {
        "This video hasn't premiered yet.".to_string()
    } else if stderr_lower.contains("private video") {
        "This video is private.".to_string()
    } else if stderr_lower.contains("members-only") || stderr_lower.contains("subscriber") {
        "This video is for channel members only.".to_string()
    } else if stderr_lower.contains("no video formats found") {
        "No downloadable formats found for this video.".to_string()
    } else if stderr_lower.contains("unable to download") && stderr_lower.contains("404") {
        "Video not found (404). It may have been deleted.".to_string()
    } else {
        format!("Could not fetch video info. {}", stderr.lines().last().unwrap_or(""))
    }
}

fn parse_video_info(json: &Value) -> Result<VideoInfo, String> {
    let id = json["id"].as_str().unwrap_or("").to_string();
    if id.is_empty() {
        return Err("Could not identify this video. The link may be invalid.".to_string());
    }
    let title = json["title"].as_str().unwrap_or("Unknown Title").to_string();
    let duration = json["duration"].as_f64().unwrap_or(0.0) as u64;
    let channel = json["channel"]
        .as_str()
        .or_else(|| json["uploader"].as_str())
        .unwrap_or("Unknown")
        .to_string();
    let view_count = json["view_count"].as_u64();
    let upload_date = json["upload_date"].as_str().map(|s| s.to_string());
    let webpage_url = json["webpage_url"]
        .as_str()
        .unwrap_or("")
        .to_string();
    let is_live = json["is_live"].as_bool();
    let availability = json["availability"].as_str().map(|s| s.to_string());

    // Pick best thumbnail
    let thumbnail = pick_thumbnail(json, &id);

    // Parse formats
    let raw_formats: Vec<RawFormat> = if let Some(arr) = json["formats"].as_array() {
        arr.iter()
            .filter_map(|f| serde_json::from_value(f.clone()).ok())
            .collect()
    } else {
        vec![]
    };

    let quality_options = process_formats(&raw_formats, duration);

    Ok(VideoInfo {
        id,
        title,
        thumbnail,
        duration,
        channel,
        view_count,
        upload_date,
        webpage_url,
        quality_options,
        is_live,
        availability,
    })
}

fn pick_thumbnail(json: &Value, video_id: &str) -> String {
    // Prefer highest-res from thumbnails array
    if let Some(thumbs) = json["thumbnails"].as_array() {
        let best = thumbs.iter().max_by_key(|t| t["width"].as_u64().unwrap_or(0));
        if let Some(t) = best {
            if let Some(url) = t["url"].as_str() {
                if !url.is_empty() {
                    return url.to_string();
                }
            }
        }
    }
    // Single thumbnail field (common on TikTok and some extractors)
    if let Some(url) = json["thumbnail"].as_str() {
        if !url.is_empty() {
            return url.to_string();
        }
    }
    // YouTube-only fallback
    if !video_id.is_empty() && video_id.len() == 11 {
        return format!("https://i.ytimg.com/vi/{}/hqdefault.jpg", video_id);
    }
    String::new()
}

/// Start downloading a video. Streams progress events back via Tauri events.
pub async fn download_video(
    app: AppHandle,
    url: String,
    format_selector: String,
    output_dir: String,
    is_audio_only: bool,
    app_data_dir: PathBuf,
    clip_start: Option<f64>,
    clip_end: Option<f64>,
    output_format: String,
    active: ActiveDownload,
) -> Result<String, String> {
    let ytdlp = ytdlp_path(&app_data_dir);
    let ffmpeg = ffmpeg_path(&app_data_dir);

    // Reset session state for this download
    {
        let mut guard = active.lock().await;
        guard.pid = None;
        guard.user_cancelled = false;
    }

    // Build platform-neutral output template (forward slashes work on Windows too in yt-dlp)
    let out_dir = PathBuf::from(&output_dir);
    std::fs::create_dir_all(&out_dir)
        .map_err(|e| format!("Cannot create download folder: {}", e))?;
    let output_template = format!(
        "{}/%(title)s [%(id)s].%(ext)s",
        out_dir.to_string_lossy().trim_end_matches(['/', '\\'])
    );

    // Detect dual-stream downloads (video+audio merged) so the progress bar
    // splits the bar across phases. Single-stream → one phase covers 0–95%.
    let dual_stream = !is_audio_only && format_selector.contains('+');

    let mut args: Vec<String> = vec![
        "--newline".to_string(),
        "--progress-template".to_string(),
        "download:%(progress)j".to_string(),
        "--no-warnings".to_string(),
        "--no-playlist".to_string(),
        "--color".to_string(),
        "never".to_string(),
        "--concurrent-fragments".to_string(),
        "4".to_string(),
        "--retries".to_string(),
        "3".to_string(),
        "--file-access-retries".to_string(),
        "3".to_string(),
        "--ffmpeg-location".to_string(),
        ffmpeg.to_string_lossy().to_string(),
        "-f".to_string(),
        format_selector.clone(),
    ];

    if is_audio_only {
        args.push("--extract-audio".to_string());
        args.push("--audio-format".to_string());
        args.push("mp3".to_string());
    } else {
        // Validate output format — fall back to mp4 if unknown
        let fmt = match output_format.to_lowercase().as_str() {
            "mkv" | "webm" | "mp4" => output_format.to_lowercase(),
            _ => "mp4".to_string(),
        };
        args.push("--merge-output-format".to_string());
        args.push(fmt);
    }

    args.push("-o".to_string());
    args.push(output_template.clone());
    args.push(url.clone());

    let mut child = Command::new(&ytdlp)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true) // safety net — if download_video is dropped, child dies
        .spawn()
        .map_err(|e| format!("Failed to start download: {}", e))?;

    // Register PID for cancellation
    let pid = child.id();
    {
        let mut guard = active.lock().await;
        guard.pid = pid;
    }

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    // Stderr reader: detect muxing/recoding phase
    let app_err = app.clone();
    let stderr_task = tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            if line.contains("[Merger]")
                || line.contains("[ffmpeg]")
                || line.contains("[VideoConvertor]")
                || line.contains("[ExtractAudio]")
            {
                let _ = app_err.emit("download-progress", DownloadProgress {
                    status: "merging".to_string(),
                    percent: 95.0,
                    speed: "--".to_string(),
                    eta: "0:00".to_string(),
                    downloaded: "?".to_string(),
                    total: "?".to_string(),
                    phase: "merging".to_string(),
                });
            }
        }
    });

    let mut last_emit = std::time::Instant::now();
    let emit_interval = std::time::Duration::from_millis(100);
    let mut phase: u32 = 0;
    let mut last_filename = String::new();

    let mut reader = BufReader::new(stdout).lines();
    while let Ok(Some(line)) = reader.next_line().await {
        if line.contains("[download] Destination:") {
            if let Some(path) = line.strip_prefix("[download] Destination: ") {
                last_filename = path.trim().to_string();
            }
        } else if line.contains("[Merger] Merging formats into") {
            // Extract the merged output path: [Merger] Merging formats into "..."
            if let Some(start) = line.find('"') {
                if let Some(end) = line.rfind('"') {
                    if end > start {
                        last_filename = line[start + 1..end].to_string();
                    }
                }
            }
        } else if line.contains("[ExtractAudio] Destination:") {
            if let Some(path) = line.split("[ExtractAudio] Destination:").nth(1) {
                last_filename = path.trim().to_string();
            }
        }

        if let Some(progress) = parse_progress_line(&line, &mut phase, dual_stream) {
            let now = std::time::Instant::now();
            if now.duration_since(last_emit) >= emit_interval || progress.status == "phase_complete" {
                let _ = app.emit("download-progress", progress);
                last_emit = now;
            }
        }
    }

    let status = child.wait().await
        .map_err(|e| format!("Process error: {}", e))?;

    // Drain stderr task
    let _ = stderr_task.await;

    let user_cancelled = {
        let mut guard = active.lock().await;
        guard.pid = None;
        guard.user_cancelled
    };

    if user_cancelled {
        return Err("cancelled".to_string());
    }

    if !status.success() {
        #[cfg(unix)]
        {
            use std::os::unix::process::ExitStatusExt;
            if status.signal().is_some() {
                return Err("cancelled".to_string());
            }
        }
        let stderr_hint = classify_download_error(&output_dir);
        return Err(stderr_hint);
    }

    // Find the downloaded file
    let downloaded = find_downloaded_file(&output_dir, &last_filename)
        .unwrap_or_else(|| last_filename.clone());

    if downloaded.is_empty() {
        return Err("Download finished but the output file could not be located.".to_string());
    }

    // If a clip range was requested, cut the file with ffmpeg now
    if let (Some(start), Some(end)) = (clip_start, clip_end) {
        let _ = app.emit("download-progress", DownloadProgress {
            status: "merging".to_string(),
            percent: 95.0,
            speed: "--".to_string(),
            eta: "0:00".to_string(),
            downloaded: "?".to_string(),
            total: "?".to_string(),
            phase: "merging".to_string(),
        });

        let clipped = ffmpeg_cut(&ffmpeg, &downloaded, start, end, is_audio_only, &active).await?;
        // Final 100% emit
        emit_complete(&app);
        return Ok(clipped);
    }

    // Final 100% emit so the bar always reaches the end
    emit_complete(&app);
    Ok(downloaded)
}

fn emit_complete(app: &AppHandle) {
    let _ = app.emit("download-progress", DownloadProgress {
        status: "finished".to_string(),
        percent: 100.0,
        speed: "--".to_string(),
        eta: "0:00".to_string(),
        downloaded: "?".to_string(),
        total: "?".to_string(),
        phase: "complete".to_string(),
    });
}

fn classify_download_error(_output_dir: &str) -> String {
    "Download failed. The video may be unavailable or there was a network error.".to_string()
}

/// Cancel the currently active download (kill the underlying process).
pub async fn cancel_active_download(active: &ActiveDownload) -> Result<(), String> {
    let pid = {
        let mut guard = active.lock().await;
        guard.user_cancelled = true;
        guard.pid
    };

    let Some(pid) = pid else { return Ok(()); };

    #[cfg(unix)]
    {
        // SIGTERM allows the process to flush; fall back to SIGKILL if needed.
        let _ = tokio::process::Command::new("kill")
            .arg("-TERM")
            .arg(pid.to_string())
            .output()
            .await;
    }
    #[cfg(windows)]
    {
        let _ = tokio::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .output()
            .await;
    }

    Ok(())
}

/// Cut a file to [start, end] seconds using ffmpeg stream-copy (fast, keyframe-aligned).
async fn ffmpeg_cut(
    ffmpeg: &PathBuf,
    input: &str,
    start: f64,
    end: f64,
    is_audio_only: bool,
    active: &ActiveDownload,
) -> Result<String, String> {
    let input_path = std::path::Path::new(input);
    let ext = input_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or(if is_audio_only { "mp3" } else { "mp4" });
    let stem = input_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("clip");
    let parent = input_path
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."));

    // Avoid stacking "[clip]" if the user clips again
    let base_stem = stem.trim_end_matches(" [clip]");
    let output_pathbuf = parent.join(format!("{} [clip].{}", base_stem, ext));
    let output = output_pathbuf.to_string_lossy().to_string();

    let duration = (end - start).max(0.1);

    // For stream-copy, -ss BEFORE -i seeks fast but at keyframe boundaries.
    // For audio re-encode, -ss before -i is fine too.
    let mut args = vec![
        "-y".to_string(),
        "-ss".to_string(),
        format!("{:.3}", start),
        "-i".to_string(),
        input.to_string(),
        "-t".to_string(),
        format!("{:.3}", duration),
    ];

    if is_audio_only {
        args.extend([
            "-acodec".to_string(), "libmp3lame".to_string(),
            "-q:a".to_string(), "2".to_string(),
        ]);
    } else {
        // Stream copy: no re-encode, cuts at nearest keyframe (fast & lossless)
        args.extend([
            "-c".to_string(), "copy".to_string(),
            "-avoid_negative_ts".to_string(), "make_zero".to_string(),
        ]);
    }

    args.push(output.clone());

    let mut child = Command::new(ffmpeg)
        .args(&args)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("ffmpeg cut failed to start: {}", e))?;

    // Register PID so the user can cancel during the cut step too
    {
        let mut guard = active.lock().await;
        guard.pid = child.id();
    }

    let status = child
        .wait()
        .await
        .map_err(|e| format!("ffmpeg cut failed: {}", e))?;

    let user_cancelled = {
        let mut guard = active.lock().await;
        guard.pid = None;
        guard.user_cancelled
    };

    if user_cancelled {
        let _ = std::fs::remove_file(&output);
        return Err("cancelled".to_string());
    }

    if !status.success() {
        // Clean up partial output file
        let _ = std::fs::remove_file(&output);
        return Err("Failed to cut video with ffmpeg.".to_string());
    }

    // Remove the full-length original now that the clip is saved
    let _ = std::fs::remove_file(input);

    Ok(output)
}

fn find_downloaded_file(output_dir: &str, last_filename: &str) -> Option<String> {
    if !last_filename.is_empty() && std::path::Path::new(last_filename).exists() {
        return Some(last_filename.to_string());
    }

    // Try to find the most recently created mp4/mp3 in output_dir
    let dir = std::path::Path::new(output_dir);
    if let Ok(entries) = std::fs::read_dir(dir) {
        let mut files: Vec<(std::time::SystemTime, String)> = entries
            .filter_map(|e| e.ok())
            .filter(|e| {
                let name = e.file_name().to_string_lossy().to_string();
                name.ends_with(".mp4") || name.ends_with(".mp3") || name.ends_with(".mkv") || name.ends_with(".webm")
            })
            .filter_map(|e| {
                let meta = e.metadata().ok()?;
                let modified = meta.modified().ok()?;
                Some((modified, e.path().to_string_lossy().to_string()))
            })
            .collect();
        files.sort_by(|a, b| b.0.cmp(&a.0));
        if let Some((_, path)) = files.first() {
            return Some(path.clone());
        }
    }
    None
}

