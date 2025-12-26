pub const EMIT_OAP_LOGIN: &str = "oap:login";
pub const EMIT_OAP_LOGOUT: &str = "oap:logout";
pub const EMIT_OAP_REFRESH: &str = "oap:refresh";
pub const EMIT_MCP_INSTALL: &str = "mcp:install";
pub const IPC_MCP_ELICITATION_REQUEST: &str = "ipc:elicitation_req";

#[derive(Debug, Clone, serde::Serialize)]
pub struct MCPInstallParam {
    pub name: String,
    pub config: String,
}
