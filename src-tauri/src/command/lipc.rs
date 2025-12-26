// use dive_core::libdive_desktop::proto::{
//     mcp_stream_response::Payload, ElicitationResult, McpStreamResponse,
// };

use crate::state::mcp::McpState;

#[tauri::command]
pub async fn response_mcp_elicitation(
    state: tauri::State<'_, McpState>,
    // data: ElicitationResult,
) -> Result<(), String> {
    // let payload = Payload::Elicitation(data);
    // let elicitation: McpStreamResponse = McpStreamResponse {
    //     payload: Some(payload),
    // };
    // state.send(elicitation).await.map_err(|e| e.to_string())
    Ok(())
}
