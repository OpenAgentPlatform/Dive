use rmcp::{
    ErrorData as McpError,
    handler::server::wrapper::Parameters,
    model::{CallToolResult, Content},
    tool, tool_router,
};
use serde::Deserialize;

use crate::service::DiveDefaultService;

#[derive(Deserialize, schemars::JsonSchema)]
struct EchoParam {
    /// The content from user input
    message: String,
}

#[tool_router(router = tool_router_echo, vis = "pub")]
impl DiveDefaultService {
    #[tool(description = "Repeat what you say")]
    async fn echo(
        &self,
        Parameters(object): Parameters<EchoParam>,
    ) -> Result<CallToolResult, McpError> {
        Ok(CallToolResult::success(vec![Content::text(object.message)]))
    }
}
