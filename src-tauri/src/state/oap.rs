use anyhow::Result;
use std::{collections::HashMap, ops::Deref, sync::Arc};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Wry};
use tauri_plugin_store::Store;

use crate::{
    event::{EMIT_OAP_LOGIN, EMIT_OAP_LOGOUT},
    host::McpHost,
    oap::OAPClient,
};

#[derive(Serialize, Deserialize, Debug)]
pub struct MCPServerSearchParam {
    search_input: String,
    text_tag: bool,
    search_tag: bool,
    document_tag: bool,
    image_tag: bool,
    audio_video_tag: bool,
    page: u32,
    filter: u32,
    #[serde(rename = "mcp-sort-order")]
    mcp_sort_order: u32,
}

impl MCPServerSearchParam {
    pub fn into_form(&self) -> HashMap<String, String> {
        let mut form = HashMap::new();
        form.insert("search_input".to_string(), self.search_input.clone());
        form.insert("text_tag".to_string(), self.text_tag.to_string());
        form.insert("search_tag".to_string(), self.search_tag.to_string());
        form.insert("document_tag".to_string(), self.document_tag.to_string());
        form.insert("image_tag".to_string(), self.image_tag.to_string());
        form.insert("audio_video_tag".to_string(), self.audio_video_tag.to_string());
        form.insert("page".to_string(), self.page.to_string());
        form.insert("filter".to_string(), self.filter.to_string());
        form.insert("mcp-sort-order".to_string(), self.mcp_sort_order.to_string());
        form
    }
}

pub struct OAPState {
    app_handle: AppHandle<Wry>,
    store: Arc<Store<Wry>>,
    pub client: OAPClient,
}

impl Deref for OAPState {
    type Target = OAPClient;
    fn deref(&self) -> &Self::Target {
        &self.client
    }
}

impl OAPState {
    pub fn new(app_handle: AppHandle<Wry>, store: Arc<Store<Wry>>, mcp_host: McpHost) -> Self {
        let token = store.get("token").unwrap_or_default();
        let token = if token.is_null() {
            None
        } else {
            token.as_str().map(|s| s.to_string())
        };

        Self {
            app_handle,
            store,
            client: OAPClient::new(token, mcp_host),
        }
    }

    pub async fn try_login(&self) -> Result<()> {
        let token = self.store.get("token").unwrap_or_default();
        if token.is_null() {
            log::info!("no token found, skip login");
            return Ok(());
        }

        log::info!("token found, try to login");
        if let Some(token) = token.as_str() {
            self.login(token.to_string()).await?;
        }

        Ok(())
    }

    pub async fn login(&self, token: String) -> Result<()> {
        self.store.set("token", token.clone());
        self.client.login(token).await?;
        let _ = self.app_handle.emit(EMIT_OAP_LOGIN, "");
        Ok(())
    }

    pub async fn logout(&self) -> Result<()> {
        self.client.logout().await?;
        let _ = self.app_handle.emit(EMIT_OAP_LOGOUT, "");
        self.store.delete("token");
        Ok(())
    }
}
