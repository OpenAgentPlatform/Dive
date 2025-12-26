#![deny(clippy::all)]

use std::{
    collections::HashMap,
    sync::{Arc, LazyLock},
};

use dive_core::{
    libdive_desktop::proto::{mcp_stream_response::Payload, ElicitationResult, McpStreamResponse},
    McpElicitationManager,
};

use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi_derive::napi;

static ELICITATION_MANAGER: LazyLock<McpElicitationManager> =
    LazyLock::new(McpElicitationManager::default);

#[napi]
pub async fn listen_ipc_elicitation_request(callback: ThreadsafeFunction<String>) {
    let tsfn = Arc::new(callback);
    dive_core::listen_ipc_mcp_elicitation(ELICITATION_MANAGER.clone(), move |e| {
        if let Ok(j) = serde_json::to_string(&e) {
            tsfn.call(Ok(j), ThreadsafeFunctionCallMode::Blocking);
        }

        Ok(())
    })
}

#[napi]
pub async fn response_elicitation(action: i32, content: HashMap<String, String>) {
    let data = ElicitationResult { action, content };
    let payload = Payload::Elicitation(data);
    let elicitation: McpStreamResponse = McpStreamResponse {
        payload: Some(payload),
    };

    tokio::spawn(async move {
        if let Err(e) = ELICITATION_MANAGER.clone().send(elicitation).await {
            log::warn!("{e}");
        }
    });
}
