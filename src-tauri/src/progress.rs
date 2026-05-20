use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::utils::{format_bytes, format_eta, format_speed};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub status: String,
    /// Cumulative overall percent (0-100). Never goes backward.
    pub percent: f64,
    pub speed: String,
    pub eta: String,
    pub downloaded: String,
    pub total: String,
    /// "video" | "audio" | "merging"
    pub phase: String,
}

impl Default for DownloadProgress {
    fn default() -> Self {
        Self {
            status: "downloading".to_string(),
            percent: 0.0,
            speed: "-- MB/s".to_string(),
            eta: "--:--".to_string(),
            downloaded: "0 B".to_string(),
            total: "?".to_string(),
            phase: "video".to_string(),
        }
    }
}

/// Maps per-phase progress (0-100) to an overall cumulative percent.
/// Robust scheme that works for both single-file and dual-stream downloads:
/// - First phase (video, or only file):       0–90%
/// - Any subsequent phase / post-process:    90–100%
///
/// `dual_stream` is kept for compatibility but no longer changes the mapping.
fn overall_percent(phase: u32, phase_percent: f64, _dual_stream: bool) -> f64 {
    match phase {
        0 => (phase_percent * 0.90).min(90.0),
        _ => (90.0 + phase_percent * 0.10).min(100.0),
    }
}

/// Parse a line of yt-dlp stdout.
/// `phase` is mutated when a phase transition is detected.
/// `dual_stream` controls the progress mapping (must match the actual download).
/// Returns None if the line is not a progress line we care about.
pub fn parse_progress_line(line: &str, phase: &mut u32, dual_stream: bool) -> Option<DownloadProgress> {
    let trimmed = line.trim();

    // Detect merger/ffmpeg phase from stderr-routed lines
    if trimmed.contains("[Merger]") || trimmed.contains("[ffmpeg]") {
        return Some(DownloadProgress {
            status: "merging".to_string(),
            percent: 93.0,
            speed: "--".to_string(),
            eta: "--".to_string(),
            downloaded: "?".to_string(),
            total: "?".to_string(),
            phase: "merging".to_string(),
        });
    }

    // yt-dlp --progress-template "download:%(progress)j" prefixes each line with
    // "download:" — strip it before parsing the JSON payload.
    let json_str = trimmed
        .strip_prefix("download:")
        .map(|s| s.trim())
        .unwrap_or(trimmed);

    if let Ok(v) = serde_json::from_str::<Value>(json_str) {
        let status = v["status"].as_str().unwrap_or("").to_string();

        if status == "finished" {
            // Snap to end-of-phase mark BEFORE advancing — so the user sees the
            // phase fill to its target, then a brief pause before next phase.
            let end_pct = overall_percent(*phase, 100.0, dual_stream);
            *phase += 1;
            return Some(DownloadProgress {
                status: "downloading".to_string(),
                percent: end_pct,
                speed: "--".to_string(),
                eta: "--".to_string(),
                downloaded: "?".to_string(),
                total: "?".to_string(),
                phase: phase_name(*phase, dual_stream),
            });
        }

        if status == "downloading" {
            let downloaded_bytes = v["downloaded_bytes"].as_u64().unwrap_or(0);
            let total_bytes = v["total_bytes"]
                .as_u64()
                .or_else(|| v["total_bytes_estimate"].as_u64())
                .unwrap_or(0);
            let speed = v["speed"].as_f64().unwrap_or(0.0);
            let eta = v["eta"].as_u64().unwrap_or(0);

            let phase_pct = if total_bytes > 0 {
                (downloaded_bytes as f64 / total_bytes as f64) * 100.0
            } else {
                0.0
            };

            return Some(DownloadProgress {
                status: "downloading".to_string(),
                percent: overall_percent(*phase, phase_pct, dual_stream),
                speed: format_speed(speed),
                eta: format_eta(eta),
                downloaded: format_bytes(downloaded_bytes),
                total: if total_bytes > 0 {
                    format_bytes(total_bytes)
                } else {
                    "?".to_string()
                },
                phase: phase_name(*phase, dual_stream),
            });
        }
    }

    None
}

fn phase_name(phase: u32, dual_stream: bool) -> String {
    match phase {
        0 => "video".to_string(),
        1 if dual_stream => "audio".to_string(),
        _ => "processing".to_string(),
    }
}
