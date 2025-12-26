use std::error::Error;
use rmcp::ServiceExt;

#[cfg(feature = "local_ipc")]
mod local_ipc;
mod service;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let io = (tokio::io::stdin(), tokio::io::stdout());
    service::DiveDefaultService::new()
        .serve(io)
        .await?
        .waiting()
        .await?;

    Ok(())
}
