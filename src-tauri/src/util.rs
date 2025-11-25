use anyhow::Result;
use std::path::Path;

pub mod downloader {
    use anyhow::{anyhow, Result};
    use tauri::Url;
    use tauri_plugin_http::reqwest;

    pub async fn download(url: &str) -> Result<Vec<u8>> {
        let parsed_url = Url::parse(url)?;

        match parsed_url.scheme() {
            "http" | "https" => get_file_from_http(url).await,
            "file" => get_file_from_local(&parsed_url).await,
            "asset" => {
                let asset_path = parsed_url.path().to_string();
                if let Ok(asset_path) = percent_encoding::percent_decode(asset_path.as_bytes()).decode_utf8() {
                    get_file_from_local(&Url::parse(&format!("file://{}", asset_path))?).await
                } else {
                    Err(anyhow!("failed to decode asset path: {}", asset_path))
                }
            }
            scheme => Err(anyhow!("not supported url scheme: {}", scheme)),
        }
    }

    // get image from http/https url
    pub async fn get_file_from_http(url: &str) -> Result<Vec<u8>> {
        let client = reqwest::Client::new();

        let response = client.get(url).send().await?;

        if !response.status().is_success() {
            return Err(anyhow!("HTTP request failed: {}", response.status()));
        }

        // if let Some(content_type) = response.headers().get("content-type") {
        //     let content_type = content_type.to_str().unwrap_or("");
        //     if !content_type.starts_with("image/") {
        //         return Err(anyhow!("response is not image type: {}", content_type));
        //     }
        // }

        let bytes = response.bytes().await?;
        Ok(bytes.to_vec())
    }

    // get image from file:// url
    pub async fn get_file_from_local(url: &Url) -> Result<Vec<u8>> {
        let file_path = url
            .to_file_path()
            .map_err(|_| anyhow!("cannot convert url to file path: {}", url))?;

        if !file_path.exists() {
            return Err(anyhow!("file not exists: {}", file_path.display()));
        }

        if !file_path.is_file() {
            return Err(anyhow!("path is not file: {}", file_path.display()));
        }

        // if let Some(extension) = file_path.extension() {
        //     let ext = extension.to_string_lossy().to_lowercase();
        //     if !matches!(
        //         ext.as_str(),
        //         "jpg" | "jpeg" | "png" | "gif" | "bmp" | "webp" | "tiff" | "svg"
        //     ) {
        //         return Err(anyhow!("not supported image format: {}", ext));
        //     }
        // } else {
        //     return Err(anyhow!("cannot determine file type"));
        // }

        let bytes = tokio::fs::read(&file_path).await?;
        Ok(bytes)
    }
}

#[inline]
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub async fn get_system_path() -> String {
    std::env::var("PATH").unwrap_or_default()
}

#[cfg(target_os = "windows")]
pub async fn get_system_path() -> String {
    let bin_dir = crate::shared::PROJECT_DIRS.bin.clone();
    format!(
        "{};{};{}",
        std::env::var("PATH").unwrap_or_default(),
        dunce::simplified(&bin_dir.join("nodejs"))
            .to_string_lossy()
            .replace('\\', "\\\\"),
        dunce::simplified(&bin_dir.join("uv"))
            .to_string_lossy()
            .replace('\\', "\\\\"),
    )
}

#[cfg(target_os = "macos")]
pub async fn get_system_path() -> String {
    let path = std::env::var("PATH").unwrap_or_default();
    if !path.is_empty() {
        return path;
    }

    const DEF_PATH: &str = "/opt/homebrew/bin:/usr/local/bin:/usr/bin";
    tokio::process::Command::new("sh")
        .arg("-c")
        .arg("echo $PATH")
        .output()
        .await
        .map(|output| output.stdout)
        .map(|stdout| String::from_utf8(stdout).ok())
        .ok()
        .flatten()
        .unwrap_or(DEF_PATH.to_string())
}

pub async fn copy_dir(src: &Path, dst: &Path) -> Result<()> {
    use tokio::fs;

    let mut entries = fs::read_dir(src).await?;
    while let Some(entry) = entries.next_entry().await? {
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if !src_path.is_dir() {
            fs::copy(&src_path, &dst_path).await?;
        }
    }

    Ok(())
}
