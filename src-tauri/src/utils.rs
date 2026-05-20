use std::path::PathBuf;

/// Get the app's dedicated bin directory inside the app data folder.
pub fn get_bin_dir(app_data_dir: &PathBuf) -> PathBuf {
    app_data_dir.join("bin")
}

/// Get the platform-specific yt-dlp binary name.
pub fn ytdlp_binary_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "yt-dlp.exe"
    } else {
        "yt-dlp"
    }
}

/// Get the platform-specific ffmpeg binary name.
pub fn ffmpeg_binary_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "ffmpeg.exe"
    } else {
        "ffmpeg"
    }
}

/// Format bytes as human-readable string.
pub fn format_bytes(bytes: u64) -> String {
    if bytes == 0 {
        return "0 B".to_string();
    }
    let units = ["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut unit_idx = 0;
    while size >= 1024.0 && unit_idx < units.len() - 1 {
        size /= 1024.0;
        unit_idx += 1;
    }
    if size < 10.0 {
        format!("{:.1} {}", size, units[unit_idx])
    } else {
        format!("{:.0} {}", size, units[unit_idx])
    }
}

/// Format speed in bytes/sec as human-readable.
pub fn format_speed(bytes_per_sec: f64) -> String {
    if bytes_per_sec <= 0.0 {
        return "-- MB/s".to_string();
    }
    let mbs = bytes_per_sec / (1024.0 * 1024.0);
    if mbs >= 1.0 {
        format!("{:.1} MB/s", mbs)
    } else {
        let kbs = bytes_per_sec / 1024.0;
        format!("{:.0} KB/s", kbs)
    }
}

/// Format ETA seconds as mm:ss or h:mm:ss.
pub fn format_eta(seconds: u64) -> String {
    if seconds >= 3600 {
        let h = seconds / 3600;
        let m = (seconds % 3600) / 60;
        let s = seconds % 60;
        format!("{}:{:02}:{:02}", h, m, s)
    } else {
        let m = seconds / 60;
        let s = seconds % 60;
        format!("{}:{:02}", m, s)
    }
}

/// Format duration (seconds) as mm:ss or h:mm:ss.
#[allow(dead_code)]
pub fn format_duration(seconds: u64) -> String {
    format_eta(seconds)
}

/// Get the OS Downloads directory.
pub fn get_downloads_dir() -> PathBuf {
    dirs::download_dir()
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_else(|| PathBuf::from(".")))
}

/// Make a file executable on Unix systems.
#[cfg(unix)]
pub fn make_executable(path: &PathBuf) -> std::io::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    let mut perms = std::fs::metadata(path)?.permissions();
    perms.set_mode(0o755);
    std::fs::set_permissions(path, perms)?;
    Ok(())
}

#[cfg(not(unix))]
pub fn make_executable(_path: &PathBuf) -> std::io::Result<()> {
    Ok(())
}
