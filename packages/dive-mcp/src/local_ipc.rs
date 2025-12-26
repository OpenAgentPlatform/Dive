use libdive_desktop::proto::ipc_service_client::IpcServiceClient;
use libdive_desktop::proto::{
    elicitation_result::Action, ElicitationRequest, McpStreamRequest, RequestedSchema,
    SchemaProperty,
};
use rmcp::model::{ElicitationAction, ElicitationSchema, PrimitiveSchema, StringFormat};
use std::collections::HashMap;
use tokio_stream::StreamExt;

/// Elicitation result from local IPC
pub struct LocalElicitationResult {
    pub action: ElicitationAction,
    pub content: Option<serde_json::Map<String, serde_json::Value>>,
}

/// Convert StringFormat to string
fn format_to_string(format: &StringFormat) -> String {
    match format {
        StringFormat::Email => "email".to_string(),
        StringFormat::Uri => "uri".to_string(),
        StringFormat::Date => "date".to_string(),
        StringFormat::DateTime => "date-time".to_string(),
    }
}

/// Convert rmcp ElicitationSchema to libdive RequestedSchema
fn convert_schema(schema: &ElicitationSchema) -> RequestedSchema {
    let mut properties = HashMap::new();

    for (name, prop) in schema.properties.iter() {
        let schema_prop = match prop {
            PrimitiveSchema::String(s) => SchemaProperty {
                r#type: "string".to_string(),
                title: s.title.as_ref().map(|v| v.to_string()),
                description: s.description.as_ref().map(|v| v.to_string()),
                min_length: s.min_length.map(|v| v as i32),
                max_length: s.max_length.map(|v| v as i32),
                format: s.format.as_ref().map(format_to_string),
                ..Default::default()
            },
            PrimitiveSchema::Number(n) => SchemaProperty {
                r#type: "number".to_string(),
                title: n.title.as_ref().map(|v| v.to_string()),
                description: n.description.as_ref().map(|v| v.to_string()),
                minimum: n.minimum,
                maximum: n.maximum,
                ..Default::default()
            },
            PrimitiveSchema::Integer(i) => SchemaProperty {
                r#type: "integer".to_string(),
                title: i.title.as_ref().map(|v| v.to_string()),
                description: i.description.as_ref().map(|v| v.to_string()),
                minimum: i.minimum.map(|v| v as f64),
                maximum: i.maximum.map(|v| v as f64),
                ..Default::default()
            },
            PrimitiveSchema::Boolean(b) => SchemaProperty {
                r#type: "boolean".to_string(),
                title: b.title.as_ref().map(|v| v.to_string()),
                description: b.description.as_ref().map(|v| v.to_string()),
                default_value: b.default.map(|v| v.to_string()),
                ..Default::default()
            },
            PrimitiveSchema::Enum(e) => SchemaProperty {
                r#type: "string".to_string(),
                title: e.title.as_ref().map(|v| v.to_string()),
                description: e.description.as_ref().map(|v| v.to_string()),
                enum_values: e.enum_values.clone(),
                enum_names: e.enum_names.clone().unwrap_or_default(),
                ..Default::default()
            },
        };
        properties.insert(name.clone(), schema_prop);
    }

    RequestedSchema {
        properties,
        required: schema.required.clone().unwrap_or_default(),
    }
}

/// Request elicitation via local IPC (libdive)
pub async fn request_elicitation(
    message: String,
    schema: ElicitationSchema,
) -> Result<LocalElicitationResult, String> {
    // Connect to libdive IPC
    let channel = libdive_desktop::connect()
        .await
        .map_err(|e| format!("Failed to connect to libdive IPC: {}", e))?;

    let mut client = IpcServiceClient::new(channel);

    // Create channel for streaming
    let (tx, rx) = tokio::sync::mpsc::channel(1);
    let stream = tokio_stream::wrappers::ReceiverStream::new(rx);

    // Start the stream
    let mut response_stream = client
        .mcp_stream(stream)
        .await
        .map_err(|e| format!("Failed to create MCP stream: {}", e))?
        .into_inner();

    // Convert and send elicitation request
    let requested_schema = convert_schema(&schema);

    tx.send(McpStreamRequest {
        payload: Some(
            libdive_desktop::proto::mcp_stream_request::Payload::Elicitation(ElicitationRequest {
                message,
                requested_schema: Some(requested_schema),
            }),
        ),
    })
    .await
    .map_err(|e| format!("Failed to send elicitation request: {}", e))?;

    // Wait for response
    let result = response_stream
        .next()
        .await
        .ok_or_else(|| "No response from libdive IPC".to_string())?
        .map_err(|e| format!("Error receiving response: {}", e))?;

    // Close the stream
    drop(tx);

    // Process response
    if let Some(libdive_desktop::proto::mcp_stream_response::Payload::Elicitation(r)) =
        result.payload
    {
        let action = match Action::try_from(r.action) {
            Ok(Action::Accept) => ElicitationAction::Accept,
            Ok(Action::Decline) => ElicitationAction::Decline,
            Ok(Action::Cancel) => ElicitationAction::Cancel,
            _ => ElicitationAction::Cancel,
        };

        let content = if action == ElicitationAction::Accept && !r.content.is_empty() {
            let mut map = serde_json::Map::new();
            for (k, v) in r.content {
                map.insert(k, serde_json::Value::String(v));
            }
            Some(map)
        } else {
            None
        };

        Ok(LocalElicitationResult { action, content })
    } else {
        Err("Unexpected response from libdive IPC".to_string())
    }
}
