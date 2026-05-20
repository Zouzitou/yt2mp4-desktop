use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawFormat {
    pub format_id: String,
    pub format_note: Option<String>,
    pub ext: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub fps: Option<f64>,
    pub vcodec: Option<String>,
    pub acodec: Option<String>,
    pub filesize: Option<u64>,
    pub filesize_approx: Option<u64>,
    pub tbr: Option<f64>,
    pub vbr: Option<f64>,
    pub abr: Option<f64>,
    pub dynamic_range: Option<String>,
    pub protocol: Option<String>,
}

impl RawFormat {
    pub fn has_video(&self) -> bool {
        self.vcodec.as_deref().map(|v| v != "none").unwrap_or(false)
            && self.width.is_some()
    }

    pub fn has_audio(&self) -> bool {
        self.acodec.as_deref().map(|a| a != "none").unwrap_or(false)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityOption {
    pub label: String,
    pub sublabel: String,
    pub height: Option<u32>,
    pub format_selector: String,
    pub estimated_size: Option<String>,
    pub estimated_size_bytes: Option<u64>,
    pub is_best: bool,
    pub is_audio_only: bool,
}

/// Process raw yt-dlp formats into user-friendly quality options.
pub fn process_formats(formats: &[RawFormat], duration: u64) -> Vec<QualityOption> {
    // Filter out storyboards and broken formats
    let usable: Vec<&RawFormat> = formats
        .iter()
        .filter(|f| {
            f.protocol.as_deref() != Some("mhtml")
                && !(f.vcodec.as_deref() == Some("none") && f.acodec.as_deref() == Some("none"))
        })
        .collect();

    // Collect unique heights from video-capable formats
    let mut heights: Vec<u32> = usable
        .iter()
        .filter(|f| f.has_video())
        .filter_map(|f| f.height)
        .collect();
    heights.sort_unstable();
    heights.dedup();
    heights.reverse(); // Highest first

    let mut options: Vec<QualityOption> = Vec::new();

    // Best option (always first)
    let (best_size, best_bytes) = estimate_size_for_height(&usable, None, duration);
    options.push(QualityOption {
        label: "Best quality".to_string(),
        sublabel: format!("Highest available{}", best_size.as_deref().map(|s| format!(" · {}", s)).unwrap_or_default()),
        height: None,
        format_selector: "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best".to_string(),
        estimated_size: best_size,
        estimated_size_bytes: best_bytes,
        is_best: true,
        is_audio_only: false,
    });

    // Specific resolution options — only heights that actually exist
    for &h in &heights {
        let label = format!("{}p", h);
        let (size, bytes) = estimate_size_for_height(&usable, Some(h), duration);
        let sublabel = format!(
            "MP4{}",
            size.as_deref().map(|s| format!(" · {}", s)).unwrap_or_default()
        );
        let selector = format!(
            "bestvideo[height<={}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<={}]+bestaudio/best[height<={}]",
            h, h, h
        );
        options.push(QualityOption {
            label,
            sublabel,
            height: Some(h),
            format_selector: selector,
            estimated_size: size,
            estimated_size_bytes: bytes,
            is_best: false,
            is_audio_only: false,
        });
    }

    // Audio only option (always last)
    let (audio_size, audio_bytes) = estimate_audio_size(&usable, duration);
    options.push(QualityOption {
        label: "Audio only".to_string(),
        sublabel: format!(
            "MP3{}",
            audio_size.as_deref().map(|s| format!(" · {}", s)).unwrap_or_default()
        ),
        height: None,
        format_selector: "bestaudio[ext=m4a]/bestaudio".to_string(),
        estimated_size: audio_size,
        estimated_size_bytes: audio_bytes,
        is_best: false,
        is_audio_only: true,
    });

    options
}

fn estimate_size_for_height(
    formats: &[&RawFormat],
    max_height: Option<u32>,
    duration: u64,
) -> (Option<String>, Option<u64>) {
    let video = formats
        .iter()
        .filter(|f| f.has_video())
        .filter(|f| max_height.map_or(true, |h| f.height.map_or(false, |fh| fh <= h)))
        .max_by_key(|f| f.height.unwrap_or(0));

    let audio = formats
        .iter()
        .filter(|f| f.has_audio() && !f.has_video())
        .max_by(|a, b| {
            a.abr.unwrap_or(0.0).partial_cmp(&b.abr.unwrap_or(0.0)).unwrap_or(std::cmp::Ordering::Equal)
        });

    let video_bytes = video.and_then(|v| {
        v.filesize
            .or(v.filesize_approx)
            .or_else(|| v.vbr.map(|vbr| (vbr * 1000.0 / 8.0 * duration as f64) as u64))
    });

    let audio_bytes = audio.and_then(|a| {
        a.filesize
            .or(a.filesize_approx)
            .or_else(|| a.abr.map(|abr| (abr * 1000.0 / 8.0 * duration as f64) as u64))
    });

    let total_bytes = match (video_bytes, audio_bytes) {
        (Some(v), Some(a)) => Some(v + a),
        (Some(v), None)    => Some(v),
        (None, Some(a))    => Some(a),
        (None, None)       => None,
    };

    let label = total_bytes.map(|b| format!("~{}", crate::utils::format_bytes(b)));
    (label, total_bytes)
}

fn estimate_audio_size(formats: &[&RawFormat], duration: u64) -> (Option<String>, Option<u64>) {
    let audio = formats
        .iter()
        .filter(|f| f.has_audio())
        .max_by(|a, b| {
            a.abr.unwrap_or(0.0).partial_cmp(&b.abr.unwrap_or(0.0)).unwrap_or(std::cmp::Ordering::Equal)
        });

    let bytes = audio.and_then(|a| {
        a.filesize
            .or(a.filesize_approx)
            .or_else(|| a.abr.map(|abr| (abr * 1000.0 / 8.0 * duration as f64) as u64))
    });

    let label = bytes.map(|b| format!("~{}", crate::utils::format_bytes(b)));
    (label, bytes)
}
