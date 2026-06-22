mod commands;
mod deps;
mod formats;
mod history;
mod progress;
mod settings;
mod utils;
mod ytdlp;

use commands::{ActiveDownloadState, AppDataDir};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Resolve app data directory and store as managed state.
            // Fall back to a temp directory if the platform cannot provide one
            // or if creation fails (sandboxed environments, permissions, etc).
            let app_data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::env::temp_dir().join("yt2mp4-desktop"));
            if let Err(e) = std::fs::create_dir_all(&app_data_dir) {
                eprintln!("Warning: could not create app data dir at {:?}: {e}. Falling back to temp.", app_data_dir);
                let fallback = std::env::temp_dir().join("yt2mp4-desktop");
                let _ = std::fs::create_dir_all(&fallback);
                app.manage(AppDataDir(fallback));
            } else {
                app.manage(AppDataDir(app_data_dir));
            }
            app.manage(ActiveDownloadState::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::cmd_check_dependencies,
            commands::cmd_install_dependencies,
            commands::cmd_fetch_video_info,
            commands::cmd_download_video,
            commands::cmd_get_settings,
            commands::cmd_save_settings,
            commands::cmd_get_history,
            commands::cmd_clear_history,
            commands::cmd_get_download_dir,
            commands::cmd_open_file,
            commands::cmd_open_folder,
            commands::cmd_check_ytdlp_update,
            commands::cmd_update_ytdlp,
            commands::cmd_file_exists,
            commands::cmd_cancel_download,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
