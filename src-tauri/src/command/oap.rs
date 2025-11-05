use std::sync::Arc;

use tauri_plugin_opener::OpenerExt;

use crate::shared::OAP_ROOT_URL;
use crate::state::oap::{MCPServerSearchParam, OAPState};

#[tauri::command]
pub async fn oap_login(
    state: tauri::State<'_, Arc<OAPState>>,
    token: String,
) -> Result<(), String> {
    state.login(token).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn oap_logout(state: tauri::State<'_, Arc<OAPState>>) -> Result<(), String> {
    log::info!("oap logout");
    state.logout().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn oap_get_mcp_servers(
    state: tauri::State<'_, Arc<OAPState>>,
) -> Result<serde_json::Value, String> {
    state.get_mcp_servers().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn oap_search_mcp_server(
    state: tauri::State<'_, Arc<OAPState>>,
    params: MCPServerSearchParam,
) -> Result<serde_json::Value, String> {
    state
        .search_mcp_server(params)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn oap_apply_mcp_server(
    state: tauri::State<'_, Arc<OAPState>>,
    ids: Vec<String>,
) -> Result<serde_json::Value, String> {
    state.apply_mcp_server(ids).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn oap_get_me(
    state: tauri::State<'_, Arc<OAPState>>,
) -> Result<serde_json::Value, String> {
    state.get_me().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn oap_get_usage(
    state: tauri::State<'_, Arc<OAPState>>,
) -> Result<serde_json::Value, String> {
    state.get_usage().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_oap_login_page(app: tauri::AppHandle, regist: bool) -> Result<(), String> {
    let hostname = hostname::get().map_err(|e| e.to_string())?;
    let hostname = hostname.to_string_lossy();

    let url = if regist {
        format!(
            "{}/signup?client=dive&name={}&system={}",
            OAP_ROOT_URL,
            hostname,
            std::env::consts::OS
        )
    } else {
        format!(
            "{}/signin?client=dive&name={}&system={}",
            OAP_ROOT_URL,
            hostname,
            std::env::consts::OS
        )
    };

    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn oap_get_token(state: tauri::State<'_, Arc<OAPState>>) -> Result<String, String> {
    state.client.credentials.get_token().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn oap_get_model_description(
    state: tauri::State<'_, Arc<OAPState>>,
    params: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    state
        .get_model_description(params)
        .await
        .map_err(|e| e.to_string())
}
