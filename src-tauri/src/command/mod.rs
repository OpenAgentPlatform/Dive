use std::{borrow::Cow, io::Cursor};

use image::{DynamicImage, ImageBuffer, ImageReader};
use tauri::Emitter;
use tauri_plugin_clipboard_manager::ClipboardExt;

use crate::{
    state::{DownloadDependencyEvent, DownloadDependencyState},
    util::get_image_bytes,
};

pub mod host;
pub mod llm;
pub mod oap;
pub mod system;

#[tauri::command]
pub fn start_recv_download_dependency_log(
    state: tauri::State<'_, DownloadDependencyState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let Ok(mut rx) = state.rx.lock() else {
        return Ok(());
    };

    if rx.is_none() {
        return Ok(());
    }

    let mut rx = rx.take().unwrap();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            let is_finished = event == DownloadDependencyEvent::Finished;
            if let Err(e) = app.emit("install-host-dependencies-log", event) {
                log::error!("failed to emit install-host-dependencies-log: {}", e);
                break;
            }

            if is_finished {
                break;
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn copy_image(request: tauri::ipc::Request<'_>, app_handle: tauri::AppHandle) -> Result<(), String> {
    let bytes = match request.body() {
        tauri::ipc::InvokeBody::Json(value) => {
            let src = value
                .get("src")
                .unwrap_or_default()
                .as_str()
                .unwrap_or_default();

            if src.is_empty() {
                value.get("data")
                    .and_then(|d| d.as_array())
                    .map(|d| d
                        .iter()
                        .map(|o| o
                            .as_u64()
                            .map(|n| n as u8))
                        .collect::<Option<Vec<u8>>>())
                    .flatten()
                    .ok_or("data not found")?
            } else {
                get_image_bytes(&src).await.map_err(|e| e.to_string())?
            }
        },
        tauri::ipc::InvokeBody::Raw(data) => data.to_vec(),
    };

    let img = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map(|f| f.decode())
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;

    let height = img.height();
    let width = img.width();
    let rgba = img.to_rgba8().to_vec();
    let image = tauri::image::Image::new_owned(rgba, width, height);

    app_handle
        .clipboard()
        .write_image(&image)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn download_image(src: String, dst: String) -> Result<(), String> {
    let src = src.replace("blob:", "");
    let bytes = get_image_bytes(&src).await.map_err(|e| e.to_string())?;
    let path = std::path::Path::new(&dst);

    let filename = path.file_stem().unwrap_or_default().to_string_lossy();

    let ext = path
        .extension()
        .map(|e| e.to_string_lossy())
        .or_else(|| {
            ImageReader::new(Cursor::new(&bytes))
                .with_guessed_format()
                .ok()
                .and_then(|r| r.format())
                .and_then(|f| f.extensions_str().first())
                .map(|e| Cow::Borrowed(*e))
        })
        .unwrap_or_else(|| Cow::Borrowed("png"));

    let parent = path.parent().ok_or_else(|| "invalid path".to_string())?;
    tokio::fs::create_dir_all(parent)
        .await
        .map_err(|e| e.to_string())?;
    tokio::fs::write(parent.join(format!("{}.{}", filename, ext)), bytes)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn save_clipboard_image_to_cache(app_handle: tauri::AppHandle) -> Result<String, String> {
    let image = app_handle.clipboard().read_image().map_err(|e| e.to_string())?;
    let image_bytes = image.rgba();
    let width = image.width();
    let height = image.height();

    let image_path = crate::shared::PROJECT_DIRS.cache.join("clipboard.png");
    let raw_image = DynamicImage::ImageRgba8(ImageBuffer::from_raw(width, height, image_bytes.to_vec()).unwrap());
    raw_image.save_with_format(&image_path, image::ImageFormat::Png).map_err(|e| e.to_string())?;

    #[cfg(not(target_os = "windows"))]
    let dist = "asset://localhost/";

    #[cfg(target_os = "windows")]
    let dist = "http://asset.localhost/";

    Ok(format!("{}{}", dist, image_path.to_string_lossy()))
}