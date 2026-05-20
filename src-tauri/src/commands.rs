use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, State};
use tokio::sync::Mutex as TokioMutex;

use crate::deps::{check_dependencies, check_ytdlp_update, install_dependencies, update_ytdlp, DepsStatus};
use crate::history::{add_history_entry, clear_history, load_history, HistoryEntry};
use crate::settings::{load_settings, save_settings, Settings};
use crate::ytdlp::{
    cancel_active_download, download_video, fetch_video_info, ActiveDownload, DownloadSession,
    VideoInfo,
};

pub struct AppDataDir(pub PathBuf);

/// Tauri-managed handle for the currently running download process.
pub struct ActiveDownloadState(pub ActiveDownload);

impl Default for ActiveDownloadState {
    fn default() -> Self {
        Self(Arc::new(TokioMutex::new(DownloadSession::default())))
    }
}

#[tauri::command]
pub async fn cmd_check_dependencies(
    _app: AppHandle,
    state: State<'_, AppDataDir>,
) -> Result<DepsStatus, String> {
    Ok(check_dependencies(&state.0).await)
}

#[tauri::command]
pub async fn cmd_install_dependencies(
    app: AppHandle,
    state: State<'_, AppDataDir>,
) -> Result<(), String> {
    let dir = state.0.clone();
    install_dependencies(app, dir).await
}

#[tauri::command]
pub async fn cmd_fetch_video_info(
    url: String,
    state: State<'_, AppDataDir>,
) -> Result<VideoInfo, String> {
    fetch_video_info(&url, &state.0).await
}

#[tauri::command]
pub async fn cmd_download_video(
    app: AppHandle,
    url: String,
    format_selector: String,
    output_dir: String,
    is_audio_only: bool,
    video_id: String,
    title: String,
    thumbnail_url: String,
    channel: String,
    duration: u64,
    quality_label: String,
    clip_start: Option<f64>,
    clip_end: Option<f64>,
    output_format: Option<String>,
    state: State<'_, AppDataDir>,
    active: State<'_, ActiveDownloadState>,
) -> Result<String, String> {
    let app_data_dir = state.0.clone();
    let active_arc = active.0.clone();
    let fmt = output_format.unwrap_or_else(|| "mp4".to_string());

    let result = download_video(
        app.clone(),
        url.clone(),
        format_selector,
        output_dir.clone(),
        is_audio_only,
        app_data_dir.clone(),
        clip_start,
        clip_end,
        fmt,
        active_arc,
    )
    .await;

    match &result {
        Ok(file_path) => {
            // Get file size
            let file_size = std::fs::metadata(file_path)
                .map(|m| m.len())
                .unwrap_or(0);

            // Add to history
            let entry = HistoryEntry {
                id: uuid::Uuid::new_v4().to_string(),
                video_id,
                title,
                thumbnail_url,
                channel,
                duration,
                quality: quality_label,
                file_path: file_path.clone(),
                file_size,
                downloaded_at: chrono::Utc::now().to_rfc3339(),
                status: "completed".to_string(),
                file_exists: Some(true),
            };
            let _ = add_history_entry(&app_data_dir, entry);
        }
        Err(e) if e != "cancelled" => {
            // Add failed entry to history
            let entry = HistoryEntry {
                id: uuid::Uuid::new_v4().to_string(),
                video_id,
                title,
                thumbnail_url,
                channel,
                duration,
                quality: quality_label,
                file_path: String::new(),
                file_size: 0,
                downloaded_at: chrono::Utc::now().to_rfc3339(),
                status: "failed".to_string(),
                file_exists: Some(false),
            };
            let _ = add_history_entry(&app_data_dir, entry);
        }
        _ => {}
    }

    result
}

#[tauri::command]
pub fn cmd_get_settings(state: State<'_, AppDataDir>) -> Settings {
    load_settings(&state.0)
}

#[tauri::command]
pub fn cmd_save_settings(
    settings: Settings,
    state: State<'_, AppDataDir>,
) -> Result<(), String> {
    save_settings(&state.0, &settings)
}

#[tauri::command]
pub fn cmd_get_history(state: State<'_, AppDataDir>) -> Vec<HistoryEntry> {
    load_history(&state.0)
}

#[tauri::command]
pub fn cmd_clear_history(state: State<'_, AppDataDir>) -> Result<(), String> {
    clear_history(&state.0)
}

#[tauri::command]
pub fn cmd_get_download_dir() -> String {
    crate::utils::get_downloads_dir().to_string_lossy().to_string()
}

#[tauri::command]
pub async fn cmd_open_file(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        tokio::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        tokio::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        tokio::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn cmd_open_folder(path: String) -> Result<(), String> {
    #[allow(unused_variables)]
    let folder = std::path::Path::new(&path)
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or(path.clone());

    #[cfg(target_os = "macos")]
    {
        tokio::process::Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        tokio::process::Command::new("explorer")
            .arg(format!("/select,{}", path))
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        tokio::process::Command::new("xdg-open")
            .arg(&folder)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn cmd_check_ytdlp_update(state: State<'_, AppDataDir>) -> Result<Option<String>, String> {
    Ok(check_ytdlp_update(&state.0).await)
}

#[tauri::command]
pub async fn cmd_update_ytdlp(
    app: AppHandle,
    state: State<'_, AppDataDir>,
) -> Result<(), String> {
    update_ytdlp(app, state.0.clone()).await
}

#[tauri::command]
pub fn cmd_file_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

#[tauri::command]
pub async fn cmd_cancel_download(active: State<'_, ActiveDownloadState>) -> Result<(), String> {
    cancel_active_download(&active.0).await
}

