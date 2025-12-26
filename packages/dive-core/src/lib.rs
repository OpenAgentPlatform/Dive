use anyhow::Result;
use std::{
    collections::HashMap,
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
};

use enclose::enclose;
use libdive_desktop::{
    proto::{
        ElicitationRequest, ElicitationResult, McpStreamResponse, mcp_stream_request::Payload,
    },
    serve_sessions,
};
use log::{info, warn};
use tokio::{
    spawn,
    sync::{Mutex, mpsc::Sender},
    task::JoinHandle,
};

pub use libdive_desktop;

#[derive(Clone, Default)]
pub struct McpElicitationManager {
    pub tx: Arc<Mutex<Option<Sender<McpStreamResponse>>>>,
    pub pending: Arc<AtomicBool>,
}

impl McpElicitationManager {
    pub async fn send(&self, response: McpStreamResponse) -> Result<()> {
        let tx = self.tx.lock().await;
        if let Some(tx) = &*tx {
            tx.send(response)
                .await
                .map_err(|e| anyhow::anyhow!("failed to send response: {e}"))?;
            self.pending.store(false, Ordering::Relaxed);
        }

        Ok(())
    }

    pub async fn send_cancel(&self) -> Result<()> {
        let mut tx = self.tx.lock().await;
        if let Some(tx) = (*tx).take() {
            let cancel_res = McpStreamResponse {
                payload: Some(
                    libdive_desktop::proto::mcp_stream_response::Payload::Elicitation(
                        ElicitationResult {
                            action: libdive_desktop::proto::elicitation_result::Action::Cancel
                                as i32,
                            content: HashMap::new(),
                        },
                    ),
                ),
            };

            tx.send(cancel_res).await?;
        }

        Ok(())
    }

    pub async fn reset(&self) -> Result<()> {
        if self.pending.load(Ordering::SeqCst) {
            self.send_cancel().await?;
        }

        Ok(())
    }

    pub async fn new_elicitation_tx(&self, tx: Sender<McpStreamResponse>) {
        let mut inner_tx = self.tx.lock().await;
        self.pending.store(true, Ordering::Release);
        *inner_tx = Some(tx);
    }
}

pub fn listen_ipc_mcp_elicitation<F>(mcp_state: McpElicitationManager, callback: F)
where
    F: Fn(ElicitationRequest) -> Result<()> + Send + 'static + Clone,
{
    let _handle: JoinHandle<Result<()>> = spawn(async move {
        let mut sessions = serve_sessions().await.unwrap();

        while let Some(mut session) = sessions.recv().await {
            info!("local IPC New client connected!");

            // Spawn a task to handle this client
            let _handle: JoinHandle<Result<()>> =
                spawn(enclose!((mcp_state, callback) async move {
                    while let Some(request) = session.recv().await {
                        if let Some(Payload::Elicitation(elicitation)) = request.payload {
                            info!("new elicitation request");

                            // cancel lasttime elicitation request
                            if let Err(e) = mcp_state.reset().await {
                                warn!("mcp state reset failed {}", e);
                            };

                            mcp_state.new_elicitation_tx(session.tx.clone()).await;
                            callback(elicitation)?;
                        }
                    }

                    info!("local IPC Client disconnected");
                    Ok(())
                }));
        }

        Ok(())
    });
}
