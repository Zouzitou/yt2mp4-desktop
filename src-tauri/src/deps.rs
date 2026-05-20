use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};
use tokio::process::Command;

use crate::utils::{ffmpeg_binary_name, get_bin_dir, make_executable, ytdlp_binary_name};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetupProgress {
    pub step: String,
    pub status: String,
    pub percent: f64,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DepsStatus {
    pub ytdlp: bool,
    pub ffmpeg: bool,
    pub ytdlp_version: Option<String>,
}

/// Check if yt-dlp and ffmpeg are present and executable.
pub async fn check_dependencies(app_data_dir: &PathBuf) -> DepsStatus {
    let bin_dir = get_bin_dir(app_data_dir);
    let ytdlp_path = bin_dir.join(ytdlp_binary_name());
    let ffmpeg_path = bin_dir.join(ffmpeg_binary_name());

    let ytdlp_ok = check_binary(&ytdlp_path, &["--version"]).await;
    let ffmpeg_ok = check_binary(&ffmpeg_path, &["-version"]).await;

    let ytdlp_version = if ytdlp_ok {
        get_binary_version(&ytdlp_path, &["--version"]).await
    } else {
        None
    };

    DepsStatus {
        ytdlp: ytdlp_ok,
        ffmpeg: ffmpeg_ok,
        ytdlp_version,
    }
}

async fn check_binary(path: &PathBuf, args: &[&str]) -> bool {
    if !path.exists() {
        return false;
    }
    Command::new(path)
        .args(args)
        .output()
        .await
        .map(|o| o.status.success())
        .unwrap_or(false)
}

async fn get_binary_version(path: &PathBuf, args: &[&str]) -> Option<String> {
    let output = Command::new(path).args(args).output().await.ok()?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    Some(stdout.lines().next()?.trim().to_string())
}

/// Install yt-dlp and ffmpeg, emitting progress events.
pub async fn install_dependencies(
    app: AppHandle,
    app_data_dir: PathBuf,
) -> Result<(), String> {
    let bin_dir = get_bin_dir(&app_data_dir);
    std::fs::create_dir_all(&bin_dir).map_err(|e| e.to_string())?;

    let client = Client::builder()
        .user_agent("yt2mp4-desktop/1.0")
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| e.to_string())?;

    // Step 1: Download yt-dlp
    emit_progress(&app, "ytdlp", "downloading", 0.0, "Downloading yt-dlp...");
    download_ytdlp(&app, &client, &bin_dir).await?;
    emit_progress(&app, "ytdlp", "verifying", 95.0, "Verifying yt-dlp...");
    verify_ytdlp(&bin_dir).await?;
    emit_progress(&app, "ytdlp", "done", 100.0, "yt-dlp ready");

    // Step 2: Download ffmpeg
    emit_progress(&app, "ffmpeg", "downloading", 0.0, "Downloading ffmpeg...");
    download_ffmpeg(&app, &client, &bin_dir).await?;
    emit_progress(&app, "ffmpeg", "verifying", 95.0, "Verifying ffmpeg...");
    verify_ffmpeg(&bin_dir).await?;
    emit_progress(&app, "ffmpeg", "done", 100.0, "ffmpeg ready");

    app.emit("setup-complete", ()).unwrap_or(());
    Ok(())
}

fn emit_progress(app: &AppHandle, step: &str, status: &str, percent: f64, message: &str) {
    let _ = app.emit("setup-progress", SetupProgress {
        step: step.to_string(),
        status: status.to_string(),
        percent,
        message: message.to_string(),
    });
}

async fn download_ytdlp(app: &AppHandle, client: &Client, bin_dir: &PathBuf) -> Result<(), String> {
    let url = get_ytdlp_url().await?;

    // Ensure bin_dir exists
    std::fs::create_dir_all(bin_dir).map_err(|e| format!("Cannot create bin dir: {}", e))?;

    let dest = bin_dir.join(ytdlp_binary_name());
    let tmp = bin_dir.join("yt-dlp.tmp");

    download_file_with_progress(app, client, &url, &tmp, "ytdlp").await?;

    // Use copy+delete instead of rename to handle cross-filesystem edge cases
    std::fs::copy(&tmp, &dest)
        .map_err(|e| format!("Failed to install yt-dlp (copy): {}", e))?;
    let _ = std::fs::remove_file(&tmp);

    make_executable(&dest).map_err(|e| format!("Failed to set yt-dlp permissions: {}", e))?;
    Ok(())
}

async fn get_ytdlp_url() -> Result<String, String> {
    // Use direct stable URLs for the platform binary
    #[cfg(target_os = "windows")]
    return Ok("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe".to_string());

    #[cfg(target_os = "macos")]
    return Ok("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos".to_string());

    #[cfg(target_os = "linux")]
    return Ok("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux".to_string());

    #[allow(unreachable_code)]
    Err("Unsupported platform".to_string())
}

async fn download_ffmpeg(app: &AppHandle, client: &Client, bin_dir: &PathBuf) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        download_ffmpeg_macos(app, client, bin_dir).await
    }
    #[cfg(target_os = "windows")]
    {
        download_ffmpeg_windows(app, client, bin_dir).await
    }
    #[cfg(target_os = "linux")]
    {
        download_ffmpeg_linux(app, client, bin_dir).await
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        Err("Unsupported platform for ffmpeg download".to_string())
    }
}

#[cfg(target_os = "macos")]
async fn download_ffmpeg_macos(app: &AppHandle, client: &Client, bin_dir: &PathBuf) -> Result<(), String> {
    // Use evermeet.cx static ffmpeg builds for macOS (single zip file, ~90MB)
    let url = "https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip";

    // Ensure bin_dir exists
    std::fs::create_dir_all(bin_dir).map_err(|e| format!("Cannot create bin dir: {}", e))?;

    let zip_path = bin_dir.join("ffmpeg.zip");
    download_file_with_progress(app, client, url, &zip_path, "ffmpeg").await?;

    emit_progress_direct(app, "ffmpeg", "extracting", 96.0, "Extracting ffmpeg...");
    extract_ffmpeg_zip(&zip_path, bin_dir)?;
    let _ = std::fs::remove_file(&zip_path);
    make_executable(&bin_dir.join(ffmpeg_binary_name())).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(target_os = "windows")]
async fn download_ffmpeg_windows(app: &AppHandle, client: &Client, bin_dir: &PathBuf) -> Result<(), String> {
    let url = "https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip";
    std::fs::create_dir_all(bin_dir).map_err(|e| format!("Cannot create bin dir: {}", e))?;
    let zip_path = bin_dir.join("ffmpeg.zip");
    download_file_with_progress(app, client, url, &zip_path, "ffmpeg").await?;

    emit_progress_direct(app, "ffmpeg", "extracting", 96.0, "Extracting ffmpeg...");
    extract_ffmpeg_from_zip_win(&zip_path, bin_dir)?;
    let _ = std::fs::remove_file(&zip_path);
    Ok(())
}

#[cfg(target_os = "linux")]
async fn download_ffmpeg_linux(app: &AppHandle, client: &Client, bin_dir: &PathBuf) -> Result<(), String> {
    let url = "https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz";
    std::fs::create_dir_all(bin_dir).map_err(|e| format!("Cannot create bin dir: {}", e))?;
    let tar_path = bin_dir.join("ffmpeg.tar.xz");
    download_file_with_progress(app, client, url, &tar_path, "ffmpeg").await?;

    emit_progress_direct(app, "ffmpeg", "extracting", 96.0, "Extracting ffmpeg...");
    extract_ffmpeg_from_tar(&tar_path, bin_dir)?;
    let _ = std::fs::remove_file(&tar_path);
    make_executable(&bin_dir.join(ffmpeg_binary_name())).map_err(|e| e.to_string())?;
    Ok(())
}

fn emit_progress_direct(app: &AppHandle, step: &str, status: &str, percent: f64, message: &str) {
    let _ = app.emit("setup-progress", SetupProgress {
        step: step.to_string(),
        status: status.to_string(),
        percent,
        message: message.to_string(),
    });
}

async fn download_file_with_progress(
    app: &AppHandle,
    client: &Client,
    url: &str,
    dest: &PathBuf,
    step: &str,
) -> Result<(), String> {
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        if status.as_u16() == 429 || status.as_u16() == 403 {
            return Err("Rate limited by GitHub. Please try again in a few minutes.".to_string());
        }
        return Err(format!("Download failed with status {}", status));
    }

    let total = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut file = std::io::BufWriter::new(
        std::fs::File::create(dest)
            .map_err(|e| format!("Cannot create download file at {}: {}", dest.display(), e))?
    );
    let mut stream = response.bytes_stream();
    let mut last_emit = std::time::Instant::now();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download error: {}", e))?;
        downloaded += chunk.len() as u64;
        file.write_all(&chunk).map_err(|e| format!("Write error: {}", e))?;

        let now = std::time::Instant::now();
        if now.duration_since(last_emit).as_millis() >= 200 {
            let percent = if total > 0 {
                (downloaded as f64 / total as f64) * 90.0
            } else {
                0.0
            };
            let msg = if total > 0 {
                format!(
                    "Downloading... {}/{}",
                    crate::utils::format_bytes(downloaded),
                    crate::utils::format_bytes(total)
                )
            } else {
                format!("Downloading... {}", crate::utils::format_bytes(downloaded))
            };
            emit_progress_direct(app, step, "downloading", percent, &msg);
            last_emit = now;
        }
    }

    // Explicitly flush to ensure all bytes are written to disk
    file.flush().map_err(|e| format!("Flush error: {}", e))?;
    drop(file); // Close the file before we rename it

    Ok(())
}

fn extract_ffmpeg_zip(zip_path: &PathBuf, bin_dir: &PathBuf) -> Result<(), String> {
    let file = std::fs::File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = entry.name().to_string();
        // Look for the ffmpeg binary (no extension on macOS/Linux)
        let filename = std::path::Path::new(&name)
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_default();

        if filename == "ffmpeg" || filename == "ffmpeg.exe" {
            let dest = bin_dir.join(ffmpeg_binary_name());
            let mut out = std::fs::File::create(&dest).map_err(|e| e.to_string())?;
            std::io::copy(&mut entry, &mut out).map_err(|e| e.to_string())?;
            return Ok(());
        }
    }
    Err("ffmpeg binary not found in archive".to_string())
}

#[cfg(target_os = "windows")]
fn extract_ffmpeg_from_zip_win(zip_path: &PathBuf, bin_dir: &PathBuf) -> Result<(), String> {
    extract_ffmpeg_zip(zip_path, bin_dir)
}

#[cfg(target_os = "linux")]
fn extract_ffmpeg_from_tar(tar_path: &PathBuf, bin_dir: &PathBuf) -> Result<(), String> {
    // Use system tar command (most reliable for .tar.xz)
    let output = std::process::Command::new("tar")
        .args(["-xJf", &tar_path.to_string_lossy(), "--wildcards", "*/bin/ffmpeg", "--strip-components=2", "-C", &bin_dir.to_string_lossy()])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        return Ok(());
    }

    // Second try: extract to stdout
    let output2 = std::process::Command::new("sh")
        .arg("-c")
        .arg(format!(
            "tar -xJf '{}' --wildcards '*/ffmpeg' -O > '{}/{}'",
            tar_path.to_string_lossy(),
            bin_dir.to_string_lossy(),
            ffmpeg_binary_name()
        ))
        .output()
        .map_err(|e| e.to_string())?;

    if output2.status.success() {
        return Ok(());
    }

    Err("Failed to extract ffmpeg from archive. tar command failed.".to_string())
}

async fn verify_ytdlp(bin_dir: &PathBuf) -> Result<(), String> {
    let path = bin_dir.join(ytdlp_binary_name());
    let output = Command::new(&path)
        .arg("--version")
        .output()
        .await
        .map_err(|e| format!("Failed to verify yt-dlp: {}", e))?;
    if output.status.success() {
        Ok(())
    } else {
        // Delete corrupt binary
        let _ = std::fs::remove_file(&path);
        Err("yt-dlp binary appears corrupted. Please retry.".to_string())
    }
}

async fn verify_ffmpeg(bin_dir: &PathBuf) -> Result<(), String> {
    let path = bin_dir.join(ffmpeg_binary_name());
    let output = Command::new(&path)
        .arg("-version")
        .output()
        .await
        .map_err(|e| format!("Failed to verify ffmpeg: {}", e))?;
    if output.status.success() {
        Ok(())
    } else {
        let _ = std::fs::remove_file(&path);
        Err("ffmpeg binary appears corrupted. Please retry.".to_string())
    }
}

/// Check for yt-dlp updates (compare installed version with GitHub latest).
pub async fn check_ytdlp_update(app_data_dir: &PathBuf) -> Option<String> {
    let client = Client::builder()
        .user_agent("yt2mp4-desktop/1.0")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .ok()?;

    let response: serde_json::Value = client
        .get("https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest")
        .send()
        .await
        .ok()?
        .json()
        .await
        .ok()?;

    let latest = response["tag_name"].as_str()?.to_string();
    let installed_path = get_bin_dir(app_data_dir).join(ytdlp_binary_name());
    let installed = get_binary_version(&installed_path, &["--version"]).await?;

    // Normalize: GitHub tag is "2024.08.06", yt-dlp --version may include extras
    let latest_norm = latest.trim_start_matches('v');
    let installed_norm = installed
        .split_whitespace()
        .next()
        .unwrap_or(&installed)
        .trim_start_matches('v');

    if latest_norm != installed_norm && !installed_norm.starts_with(latest_norm) {
        Some(latest)
    } else {
        None
    }
}

/// Update yt-dlp to the latest version.
pub async fn update_ytdlp(app: AppHandle, app_data_dir: PathBuf) -> Result<(), String> {
    let bin_dir = get_bin_dir(&app_data_dir);
    let client = Client::builder()
        .user_agent("yt2mp4-desktop/1.0")
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| e.to_string())?;

    emit_progress(&app, "ytdlp", "downloading", 0.0, "Updating yt-dlp...");
    download_ytdlp(&app, &client, &bin_dir).await?;
    emit_progress(&app, "ytdlp", "verifying", 95.0, "Verifying...");
    verify_ytdlp(&bin_dir).await?;
    emit_progress(&app, "ytdlp", "done", 100.0, "yt-dlp updated!");
    Ok(())
}
