use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct PathEntry {
    pub name: String,
    pub path: String,
    #[serde(rename = "isDir")]
    pub is_dir: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PathSearchResult {
    pub entries: Vec<PathEntry>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn path_search(path: String) -> PathSearchResult {
    match search_path_impl(&path) {
        Ok(entries) => PathSearchResult {
            entries,
            error: None,
        },
        Err(e) => PathSearchResult {
            entries: vec![],
            error: Some(e.to_string()),
        },
    }
}

fn search_path_impl(search_path: &str) -> Result<Vec<PathEntry>, Box<dyn std::error::Error>> {
    // Expand ~ to home directory
    let normalized_path = if search_path.starts_with('~') {
        let home = dirs::home_dir().ok_or("Could not find home directory")?;
        home.join(&search_path[1..])
    } else {
        PathBuf::from(search_path)
    };

    // Determine directory to search and filter prefix
    let (dir_to_search, filter_prefix): (PathBuf, String) =
        if search_path.ends_with('/') || search_path.ends_with('\\') {
            (normalized_path.clone(), String::new())
        } else {
            let parent = normalized_path
                .parent()
                .ok_or("Invalid path")?
                .to_path_buf();
            let prefix = normalized_path
                .file_name()
                .map(|s| s.to_string_lossy().to_lowercase())
                .unwrap_or_default();
            (parent, prefix)
        };

    // Check if directory exists
    if !dir_to_search.exists() || !dir_to_search.is_dir() {
        return Ok(vec![]);
    }

    // Read directory contents
    let mut entries: Vec<PathEntry> = std::fs::read_dir(&dir_to_search)?
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            let name = entry.file_name().to_string_lossy().to_string();
            let name_lower = name.to_lowercase();

            // Hide dotfiles unless user is searching for them (filter starts with .)
            if name.starts_with('.') && !filter_prefix.starts_with('.') {
                return false;
            }

            if filter_prefix.is_empty() {
                return true;
            }
            name_lower.starts_with(&filter_prefix)
        })
        .map(|entry| {
            let metadata = entry.metadata().ok();
            PathEntry {
                name: entry.file_name().to_string_lossy().to_string(),
                path: entry.path().to_string_lossy().to_string(),
                is_dir: metadata.map(|m| m.is_dir()).unwrap_or(false),
            }
        })
        .collect();

    // Sort: directories first, then by name
    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    // Limit to 20 entries
    entries.truncate(20);

    Ok(entries)
}
