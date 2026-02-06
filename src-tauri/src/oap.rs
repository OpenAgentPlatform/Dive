use anyhow::Result;
use futures::StreamExt;
use serde_json::Value;
use tokio_tungstenite::{
    connect_async,
    tungstenite::{
        client::IntoClientRequest,
        handshake::client::Request,
        Message,
    },
};
use std::{
    collections::HashMap, ops::Deref, sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    }
};
use tokio::{sync::{broadcast, Mutex}, task::JoinHandle};

use tauri_plugin_http::reqwest::{Client, RequestBuilder};

use crate::{host::McpHost, shared::{OAP_ROOT_URL, VERSION}, state::oap::MCPServerSearchParam};

#[derive(Clone)]
pub struct OAPCredentials {
    inner: Arc<Mutex<OAPCredentialsInner>>,
}

impl Deref for OAPCredentials {
    type Target = Arc<Mutex<OAPCredentialsInner>>;
    fn deref(&self) -> &Self::Target {
        &self.inner
    }
}

impl OAPCredentials {
    pub fn new(token: Option<String>) -> Self {
        Self { inner: Arc::new(Mutex::new(OAPCredentialsInner { token })) }
    }
}

impl OAPCredentials {
    pub async fn get_token(&self) -> Result<String> {
        let credentials = self.inner.lock().await;
        if let Some(t) = &credentials.token {
            return Ok(t.clone());
        }

        Err(anyhow::anyhow!("not logged in"))
    }

    pub async fn set_token(&self, token: String) -> Result<()> {
        let mut credentials = self.inner.lock().await;
        credentials.token = Some(token);

        Ok(())
    }
}

#[derive(Clone)]
pub struct OAPCredentialsInner {
    token: Option<String>,
}

pub struct OAPClient {
    api_client: OAPAPIClient,
    ws_client: Mutex<OAPWebSocketClient>,
    pub credentials: OAPCredentials,
}

impl Deref for OAPClient {
    type Target = OAPAPIClient;
    fn deref(&self) -> &Self::Target {
        &self.api_client
    }
}

impl OAPClient {
    pub fn new(token: Option<String>, mcp_host: McpHost) -> Self {
        let client = Client::new();
        let credentials = OAPCredentials::new(token);
        let api_client = OAPAPIClient { client, credentials: credentials.clone(), mcp_host: mcp_host.clone() };
        let ws_client = Mutex::new(OAPWebSocketClient::new(credentials.clone()));
        Self { api_client, ws_client, credentials }
    }

    pub async fn login(&self, token: String) -> Result<()> {
        let me = self.api_client.get_me_with_token(Some(token.clone())).await?;
        if let Some(status) = me.get("status").and_then(|v| v.as_str()) {
            if status != "success" {
                return Err(anyhow::anyhow!("login failed: {}", status));
            }
        }

        self.api_client.login(token).await?;
        self.ws_client.lock().await.connect().await?;
        log::info!("login success");
        Ok(())
    }

    pub async fn logout(&self) -> Result<()> {
        self.api_client.logout().await?;
        self.ws_client.lock().await.disconnect();
        Ok(())
    }

    pub async fn on_recv_ws_event<F>(&self, callback: F)
    where
        F: Fn(OAPWebSocketHandlerEvent) + Send + Sync + 'static,
    {
        self.ws_client.lock().await.on_recv(callback);
    }
}

#[derive(Clone)]
pub struct OAPAPIClient {
    client: Client,
    credentials: OAPCredentials,
    mcp_host: McpHost,
}

impl OAPAPIClient {
    pub async fn login(&self, token: String) -> Result<()> {
        let auth_url = self.mcp_host.build_url("/api/plugins/oap-platform/auth")?;
        let auth_body = HashMap::from([("token", token.clone())]);
        let refresh_url = self.mcp_host.build_url("/api/plugins/oap-platform/config/refresh")?;

        self.client
            .post(auth_url)
            .json(&auth_body)
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("failed to login to oap: {}", e))?;
        self.client
            .post(refresh_url)
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("failed to refresh config: {}", e))?;

        self.credentials.set_token(token).await?;
        Ok(())
    }

    pub async fn logout(&self) -> Result<()> {
        let logout_oap_url = self.build_url("/api/v1/user/logout");
        let logout_host_url = self.mcp_host.build_url("/api/plugins/oap-platform/auth")?;

        if let Err(e) = self.fetch(self.client.get(logout_oap_url)).await {
            log::error!("failed to logout from oap: {}", e);
        }

        if let Err(e) = self.client.get(logout_host_url).send().await {
            log::error!("failed to logout from host: {}", e);
        }

        self.credentials.set_token(String::new()).await?;
        Ok(())
    }

    async fn fetch(&self, req_builder: RequestBuilder) -> Result<Value> {
        self.fetch_with_token(req_builder, None).await
    }

    async fn fetch_with_token(&self, req_builder: RequestBuilder, token: Option<String>) -> Result<Value> {
        let currnt_token = self.credentials.get_token().await.ok();
        let Some(token) = token.or(currnt_token) else {
            return Err(anyhow::anyhow!("not logged in and no token provided"));
        };

        req_builder
            .header("Authorization", format!("Bearer {}", token))
            .header("User-Agent", format!("DiveDesktop/{}", VERSION))
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("failed to send request: {}", e))?
            .json::<Value>()
            .await
            .map_err(|e| anyhow::anyhow!("failed to parse response: {}", e))
    }

    #[inline]
    pub fn build_url(&self, path: &str) -> String {
        format!("{}{}", OAP_ROOT_URL, path)
    }

    pub async fn get_mcp_servers(&self) -> Result<Value> {
        let url = self.build_url("/api/v1/user/mcp/configs");
        let res = self.fetch(self.client.get(url)).await?;
        Ok(res)
    }

    pub async fn search_mcp_server(&self, params: MCPServerSearchParam) -> Result<Value> {
        let url = self.build_url("/api/v1/user/mcp/search2");
        let res = self.fetch(self.client.post(url).json(&params)).await?;
        Ok(res)
    }

    pub async fn apply_mcp_server(&self, id: Vec<String>) -> Result<Value> {
        let url = self.build_url("/api/v1/user/mcp/apply");
        let res = self.fetch(self.client.post(url).json(&id)).await?;
        Ok(res)
    }

    pub async fn get_me(&self) -> Result<Value> {
        self.get_me_with_token(None).await
    }

    pub async fn get_me_with_token(&self, token: Option<String>) -> Result<Value> {
        let url = self.build_url("/api/v1/user/me");
        let res = self.fetch_with_token(self.client.get(url), token).await?;
        Ok(res)
    }

    pub async fn get_usage(&self) -> Result<Value> {
        let url = self.build_url("/api/v1/user/usage");
        let res = self.fetch(self.client.get(url)).await?;
        Ok(res)
    }

    pub async fn get_model_description(&self, params: Option<serde_json::Value>) -> Result<Value> {
        match params {
            Some(params) => {
                let url = self.build_url("/api/v1/llms/query");
                let res = self.fetch(self.client.post(url).json(&params)).await?;
                Ok(res)
            }
            None => {
                let url = self.build_url("/api/v1/llms");
                let res = self.fetch(self.client.get(url)).await?;
                Ok(res)
            }
        }
    }

    pub async fn limiter_check(&self, params: serde_json::Value) -> Result<Value> {
        let url = self.build_url("/api/v1/user/limiter/check");
        let res = self.fetch(self.client.post(url).json(&params)).await?;
        Ok(res)
    }

    pub async fn get_mcp_tags(&self) -> Result<Value> {
        let url = self.build_url("/api/v1/mcp/tags");
        let res = self.fetch(self.client.get(url)).await?;
        Ok(res)
    }
}

#[derive(Copy, Clone, Debug, PartialEq)]
pub enum OAPWebSocketClientEvent {
    Dropped,
    Disconnected,
}

#[derive(Copy, Clone, Debug, PartialEq)]
pub enum OAPWebSocketHandlerEvent {
    Disconnect,
    Refresh,
}

pub struct OAPWebSocketClient {
    credentials: OAPCredentials,
    tx: broadcast::Sender<OAPWebSocketHandlerEvent>,
    rx: broadcast::Receiver<OAPWebSocketHandlerEvent>,
    client_tx: broadcast::Sender<OAPWebSocketClientEvent>,
    client_rx: broadcast::Receiver<OAPWebSocketClientEvent>,
    connected: Arc<AtomicBool>,
    handler: Option<JoinHandle<()>>,
    handler_rx: Option<JoinHandle<()>>,
    on_recv_callback: Arc<std::sync::Mutex<Option<Box<dyn Fn(OAPWebSocketHandlerEvent) + Send + Sync>>>>,
}

impl OAPWebSocketClient {
    pub fn new(credentials: OAPCredentials) -> Self {
        let (tx, rx) = broadcast::channel(10);
        let (client_tx, client_rx) = broadcast::channel(1);
        Self {
            credentials,
            tx,
            rx,
            client_tx,
            client_rx,
            connected: Arc::new(AtomicBool::new(false)),
            handler: None,
            handler_rx: None,
            on_recv_callback: Arc::new(std::sync::Mutex::new(None)),
        }
    }

    pub fn on_recv<F>(&mut self, callback: F)
    where
        F: Fn(OAPWebSocketHandlerEvent) + Send + Sync + 'static,
    {
        let on_recv_callback = self.on_recv_callback.lock();
        if let Ok(mut guard) = on_recv_callback {
            *guard = Some(Box::new(callback));
        }
    }

    pub async fn connect(&mut self) -> Result<()> {
        if self.connected.load(Ordering::Relaxed) {
            return Ok(());
        }

        let Ok(token) = self.credentials.get_token().await else {
            return Err(anyhow::anyhow!("not logged in"));
        };

        let url = format!("wss://{}/api/v1/socket", OAP_ROOT_URL.split("://").nth(1).unwrap());
        let mut request = url.into_client_request().unwrap();
        request.headers_mut().insert("Authorization", format!("Bearer {}", token).parse().unwrap());

        let mut handler = OAPWebSocketHandler { tx: self.tx.clone(), rx: self.client_rx.resubscribe() };
        self.handler = Some(tokio::spawn(async move {
            handler.run(request).await;
        }));

        // handle client events
        let mut rx = self.rx.resubscribe();
        let connected = self.connected.clone();
        let on_recv_callback = self.on_recv_callback.clone();
        self.handler_rx = Some(tokio::spawn(async move {
            loop {
                if let Ok(event) = rx.recv().await {
                    if let Ok(on_recv_callback) = on_recv_callback.lock() {
                        if let Some(on_recv_callback) = on_recv_callback.as_ref() {
                            on_recv_callback(event);
                        }
                    }

                    if matches!(event, OAPWebSocketHandlerEvent::Disconnect) {
                        connected.store(false, Ordering::SeqCst);
                        return;
                    }
                }
            }
        }));

        self.connected.store(true, Ordering::Relaxed);
        Ok(())
    }

    pub fn disconnect(&mut self) {
        if let Some(handler) = self.handler.take() {
            if !handler.is_finished() {
                handler.abort();
            }
        }

        if let Some(handler_rx) = self.handler_rx.take() {
            if !handler_rx.is_finished() {
                handler_rx.abort();
            }
        }

        let _ = self.client_tx.send(OAPWebSocketClientEvent::Disconnected);

        log::info!("[ws] disconnected from oap websocket");
        self.connected.store(false, Ordering::SeqCst);
    }
}

impl Drop for OAPWebSocketClient {
    fn drop(&mut self) {
        self.disconnect();
        let _ = self.client_tx.send(OAPWebSocketClientEvent::Dropped);
    }
}

enum OAPWebSocketHandlerResult {
    Reconnect,
    Disconnect,
    Continue,
}

struct OAPWebSocketHandler {
    tx: broadcast::Sender<OAPWebSocketHandlerEvent>,
    rx: broadcast::Receiver<OAPWebSocketClientEvent>,
}

impl OAPWebSocketHandler {
    async fn run(&mut self, req: Request) {
        let tx = self.tx.clone();
        tokio::spawn(async move {
            const MAX_RETRIES: usize = 5;
            let mut retries = 0;

            loop {
                match connect_async(req.clone()).await {
                    Ok((mut ws_stream, _)) => {
                        log::info!("[ws] connected to oap websocket");
                        loop {
                            tokio::select! {
                                result = ws_stream.next() => {
                                    let res = match result {
                                        Some(Ok(msg)) => Self::handle_websocket_message(tx.clone(), msg).await,
                                        Some(Err(err)) => Self::handle_websocket_error(err).await,
                                        _ => continue,
                                    };

                                    match res {
                                        OAPWebSocketHandlerResult::Reconnect => break,
                                        OAPWebSocketHandlerResult::Continue => continue,
                                        OAPWebSocketHandlerResult::Disconnect => {
                                            let _ = tx.send(OAPWebSocketHandlerEvent::Disconnect);
                                            return;
                                        },
                                    }
                                }
                            }
                        }
                    }
                    Err(err) => {
                        log::error!("[ws] failed to connect to oap websocket: {}", err);
                    }
                }

                // reconnect after 10 seconds
                tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
                log::info!("[ws] reconnecting to oap websocket");
                if retries >= MAX_RETRIES {
                    log::error!("[ws] failed to connect to oap websocket after {} retries", MAX_RETRIES);
                    let _ = tx.send(OAPWebSocketHandlerEvent::Disconnect);
                    return;
                }

                retries += 1;
            }
        });

        loop {
            tokio::select! {
                event = self.rx.recv() => {
                    log::info!("[ws] received event: {:?}", event);
                    match event {
                        Ok(OAPWebSocketClientEvent::Dropped | OAPWebSocketClientEvent::Disconnected) => return,
                        _ => continue,
                    }
                }
            }
        }
    }

    async fn handle_websocket_message(tx: broadcast::Sender<OAPWebSocketHandlerEvent>, msg: Message) -> OAPWebSocketHandlerResult {
        log::debug!("[ws] received message: {:?}", &msg);
        match msg {
            Message::Binary(bytes) => {
                let Ok(json) = serde_json::from_slice::<Value>(&bytes) else {
                    return OAPWebSocketHandlerResult::Continue;
                };

                if let Some(event_type) = json.get("type").and_then(|v| v.as_str()) {
                    if matches!(event_type, "user.account.coupon.update" | "user.account.subscription.update") {
                        let _ = tx.send(OAPWebSocketHandlerEvent::Refresh);
                    }
                };
            }
            Message::Close(_) => {
                log::info!("[ws] connection closed");
                return OAPWebSocketHandlerResult::Disconnect;
            }
            _ => {}
        }

        OAPWebSocketHandlerResult::Continue
    }

    async fn handle_websocket_error(err: tokio_tungstenite::tungstenite::Error) -> OAPWebSocketHandlerResult {
        use OAPWebSocketHandlerResult::*;
        use tokio_tungstenite::tungstenite::Error;

        match &err {
            Error::ConnectionClosed => {
                log::info!("[ws] connection closed");
                Disconnect
            }
            Error::AlreadyClosed => {
                log::info!("[ws] connection already closed");
                Disconnect
            }
            Error::Io(io_err) => {
                log::error!("[ws] network error: {} - reconnecting", io_err);
                Reconnect
            }
            Error::Protocol(protocol_err) => {
                match protocol_err {
                    tokio_tungstenite::tungstenite::error::ProtocolError::ResetWithoutClosingHandshake => {
                        log::error!("[ws] connection reset without closing handshake - reconnecting");
                        Reconnect
                    }
                    _ => {
                        log::error!("[ws] protocol error: {}", protocol_err);
                        Disconnect
                    }
                }
            }
            Error::Tls(tls_err) => {
                log::error!("[ws] tls error: {} - reconnecting", tls_err);
                Reconnect
            }
            _ => {
                log::error!("[ws] unknown error: {}", err);
                Reconnect
            }
        }
    }
}
