use serde::{Deserialize, Serialize};
use std::path::PathBuf;

const MAX_HISTORY: usize = 50;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: String,
    pub video_id: String,
    pub title: String,
    pub thumbnail_url: String,
    pub channel: String,
    pub duration: u64,
    pub quality: String,
    pub file_path: String,
    pub file_size: u64,
    pub downloaded_at: String,
    pub status: String,
    pub file_exists: Option<bool>,
}

fn history_path(app_data_dir: &PathBuf) -> PathBuf {
    app_data_dir.join("history.json")
}

pub fn load_history(app_data_dir: &PathBuf) -> Vec<HistoryEntry> {
    let path = history_path(app_data_dir);
    if let Ok(contents) = std::fs::read_to_string(&path) {
        if let Ok(mut entries) = serde_json::from_str::<Vec<HistoryEntry>>(&contents) {
            // Check file existence for each entry
            for entry in &mut entries {
                entry.file_exists = Some(std::path::Path::new(&entry.file_path).exists());
            }
            return entries;
        }
    }
    vec![]
}

pub fn add_history_entry(app_data_dir: &PathBuf, entry: HistoryEntry) -> Result<(), String> {
    let mut entries = load_history(app_data_dir);
    // Remove any entry with the same file_path to avoid duplicates
    entries.retain(|e| e.file_path != entry.file_path);
    // Prepend new entry (newest first)
    entries.insert(0, entry);
    // Cap at MAX_HISTORY
    entries.truncate(MAX_HISTORY);
    save_history(app_data_dir, &entries)
}

pub fn clear_history(app_data_dir: &PathBuf) -> Result<(), String> {
    save_history(app_data_dir, &[])
}

fn save_history(app_data_dir: &PathBuf, entries: &[HistoryEntry]) -> Result<(), String> {
    std::fs::create_dir_all(app_data_dir).map_err(|e| e.to_string())?;
    let path = history_path(app_data_dir);
    let tmp_path = path.with_extension("tmp");
    let contents = serde_json::to_string_pretty(entries).map_err(|e| e.to_string())?;
    std::fs::write(&tmp_path, contents).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp_path, &path).map_err(|e| e.to_string())?;
    Ok(())
}
