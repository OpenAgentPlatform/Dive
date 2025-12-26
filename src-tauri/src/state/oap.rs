use anyhow::Result;
use std::{ops::Deref, sync::Arc};

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
    page: Option<u32>,
    tags: Option<Vec<String>>,
    subscription_level: Option<u8>,
    is_official: Option<bool>,
    sort_order: Option<u8>,
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
