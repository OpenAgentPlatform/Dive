use rmcp::{ServerHandler, handler::server::tool::ToolRouter, model::*, tool_handler, tool_router};
use std::sync::Arc;
use tokio::sync::RwLock;

mod echo;
mod fetch;
mod fs;

#[derive(Clone)]
pub struct DiveDefaultService {
    http_client: reqwest::Client,
    tool_router: ToolRouter<Self>,
    allowed_dirs: Arc<RwLock<Vec<String>>>,
}

#[tool_router]
impl DiveDefaultService {
    pub fn new() -> Self {
        let allowed_dirs = Self::load_allowed_dirs().unwrap_or_default();
        Self {
            http_client: reqwest::Client::new(),
            tool_router: Self::tool_router_echo()
                + Self::tool_router_fetch()
                + Self::tool_router_fs(),
            allowed_dirs: Arc::new(RwLock::new(allowed_dirs)),
        }
    }

    fn get_config_path() -> std::path::PathBuf {
        homedir::my_home()
            .ok()
            .flatten()
            .unwrap()
            .join(".dive/mcp/fs.json")
    }

    fn load_allowed_dirs() -> Result<Vec<String>, Box<dyn std::error::Error>> {
        use serde_json::Value;
        let config_path = Self::get_config_path();

        if !config_path.exists() {
            return Ok(Vec::new());
        }

        let content = std::fs::read_to_string(&config_path)?;
        let json: Value = serde_json::from_str(&content)?;

        let dirs = json
            .get("fs")
            .and_then(|obj| obj.get("allow_dir"))
            .and_then(|dirs| dirs.as_array())
            .map(|dirs| {
                dirs.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect::<Vec<String>>()
            })
            .unwrap_or_default();

        Ok(dirs)
    }

    async fn save_allowed_dirs(&self) -> Result<(), Box<dyn std::error::Error>> {
        use serde_json::json;
        let config_path = Self::get_config_path();

        // Create parent directory if it doesn't exist
        if let Some(parent) = config_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let allowed_dirs = self.allowed_dirs.read().await;
        let json = json!({
            "fs": {
                "allow_dir": *allowed_dirs
            }
        });

        std::fs::write(&config_path, serde_json::to_string_pretty(&json)?)?;
        Ok(())
    }
}

#[tool_handler]
impl ServerHandler for DiveDefaultService {
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            instructions: Some("default mcp server for dive client".into()),
            capabilities: ServerCapabilities::builder()
                .enable_tools()
                .enable_tool_list_changed()
                .build(),
            ..Default::default()
        }
    }
}
