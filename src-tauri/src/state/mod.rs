use std::sync::Arc;

use serde::Serialize;
use tauri::Wry;
use tauri_plugin_store::Store;
use tokio::sync::mpsc;

use crate::host::McpHost;

pub mod mcp;
pub mod oap;

pub struct AppState {
    pub store: Arc<Store<Wry>>,
    pub mcp_host: McpHost,
}

impl AppState {
    pub fn get_minimize_to_tray(&self) -> bool {
        self.store
            .get("minimalToTray")
            .map(|v| v.as_bool())
            .flatten()
            .unwrap_or(!cfg!(debug_assertions))
    }

    pub fn set_minimize_to_tray(&self, value: bool) {
        self.store.set("minimalToTray", value);
    }
}

#[derive(Debug, Serialize, Clone, Copy, PartialEq)]
pub struct ProgressData {
    pub downloaded: u64,
    pub total: u64,
    pub percentage: f64,
    pub speed_bps: f64,
    pub elapsed_secs: f64,
}

#[derive(Serialize, Clone, PartialEq)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "lowercase")]
pub enum DownloadDependencyEvent {
    Output(String),
    Progress(ProgressData),
    Error(String),
    Finished,
}

pub struct DownloadDependencyState {
    pub rx: std::sync::Mutex<Option<mpsc::Receiver<DownloadDependencyEvent>>>,
}
