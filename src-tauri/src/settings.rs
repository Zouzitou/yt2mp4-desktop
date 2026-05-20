use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::utils::get_downloads_dir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub download_dir: String,
    pub default_quality: String,
    pub default_format: String,
    pub auto_paste: bool,
    pub notification_on_complete: bool,
    pub theme: String,
    pub last_used_quality: Option<String>,
    pub window_width: u32,
    pub window_height: u32,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            download_dir: get_downloads_dir().to_string_lossy().to_string(),
            default_quality: "best".to_string(),
            default_format: "mp4".to_string(),
            auto_paste: true,
            notification_on_complete: true,
            theme: "system".to_string(),
            last_used_quality: None,
            window_width: 480,
            window_height: 680,
        }
    }
}

fn settings_path(app_data_dir: &PathBuf) -> PathBuf {
    app_data_dir.join("settings.json")
}

pub fn load_settings(app_data_dir: &PathBuf) -> Settings {
    let path = settings_path(app_data_dir);
    if let Ok(contents) = std::fs::read_to_string(&path) {
        if let Ok(settings) = serde_json::from_str::<Settings>(&contents) {
            return settings;
        }
    }
    // Create default settings file
    let defaults = Settings::default();
    let _ = save_settings(app_data_dir, &defaults);
    defaults
}

pub fn save_settings(app_data_dir: &PathBuf, settings: &Settings) -> Result<(), String> {
    std::fs::create_dir_all(app_data_dir).map_err(|e| e.to_string())?;
    let path = settings_path(app_data_dir);
    let tmp_path = path.with_extension("tmp");
    let contents = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    std::fs::write(&tmp_path, contents).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp_path, &path).map_err(|e| e.to_string())?;
    Ok(())
}
