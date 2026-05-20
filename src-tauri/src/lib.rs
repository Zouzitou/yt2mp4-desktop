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
            // Resolve app data directory and store as managed state
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data directory");
            std::fs::create_dir_all(&app_data_dir)
                .expect("Failed to create app data directory");
            app.manage(AppDataDir(app_data_dir));
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
