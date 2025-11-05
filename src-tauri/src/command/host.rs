use std::sync::Arc;

use tauri_plugin_http::reqwest;

use crate::state::AppState;

#[tauri::command]
pub async fn host_refresh_config(state: tauri::State<'_, Arc<AppState>>) -> Result<(), String> {
    let url = state.mcp_host.build_url("/api/plugins/oap-platform/config/refresh").map_err(|e| e.to_string())?;

    reqwest::get(url).await.map_err(|e| e.to_string())?;
    Ok(())
}
