use fuzzy_matcher::skim::SkimMatcherV2;
use fuzzy_matcher::FuzzyMatcher;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use walkdir::WalkDir;

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

#[tauri::command]
pub async fn path_fuzzy_search(base_path: String, query: String) -> PathSearchResult {
    match fuzzy_search_impl(&base_path, &query) {
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

fn fuzzy_search_impl(
    base_path: &str,
    query: &str,
) -> Result<Vec<PathEntry>, Box<dyn std::error::Error>> {
    // Expand ~ to home directory
    let normalized_path = if base_path.starts_with('~') {
        let home = dirs::home_dir().ok_or("Could not find home directory")?;
        home.join(&base_path[1..])
    } else {
        PathBuf::from(base_path)
    };

    // Check if directory exists
    if !normalized_path.exists() || !normalized_path.is_dir() {
        return Ok(vec![]);
    }

    // Collect all files recursively (limit depth to avoid too deep traversal)
    let mut all_paths: Vec<(String, String, bool)> = Vec::new();
    for entry in WalkDir::new(&normalized_path)
        .max_depth(5)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files unless query starts with .
        if name.starts_with('.') && !query.starts_with('.') {
            continue;
        }

        // Skip the base directory itself
        if path == normalized_path {
            continue;
        }

        // Get relative path from base for matching
        let relative_path = path
            .strip_prefix(&normalized_path)
            .unwrap_or(path)
            .to_string_lossy()
            .to_string();

        let is_dir = entry.file_type().is_dir();
        all_paths.push((relative_path, path.to_string_lossy().to_string(), is_dir));
    }

    // Create skim fuzzy matcher
    let matcher = SkimMatcherV2::default();

    // Score and filter paths
    let mut scored_entries: Vec<(i64, PathEntry)> = all_paths
        .iter()
        .filter_map(|(relative_path, full_path, is_dir)| {
            if query.is_empty() {
                return Some((
                    0,
                    PathEntry {
                        name: relative_path.clone(),
                        path: full_path.clone(),
                        is_dir: *is_dir,
                    },
                ));
            }

            matcher.fuzzy_match(relative_path, query).map(|score| {
                (
                    score,
                    PathEntry {
                        name: relative_path.clone(),
                        path: full_path.clone(),
                        is_dir: *is_dir,
                    },
                )
            })
        })
        .collect();

    // Sort by score (highest first), then directories first, then by name
    scored_entries.sort_by(|a, b| {
        b.0.cmp(&a.0)
            .then_with(|| match (a.1.is_dir, b.1.is_dir) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.1.name.to_lowercase().cmp(&b.1.name.to_lowercase()),
            })
    });

    // Take top 20 results
    let entries: Vec<PathEntry> = scored_entries.into_iter().take(20).map(|(_, e)| e).collect();

    Ok(entries)
}
