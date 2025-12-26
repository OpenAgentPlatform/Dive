use crate::service::DiveDefaultService;
use rmcp::{
    ErrorData as McpError,
    handler::server::wrapper::Parameters,
    model::{CallToolResult, Content},
    tool, tool_router,
};
use serde::Deserialize;
use std::collections::HashMap;

#[derive(Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "UPPERCASE")]
pub enum HttpMethod {
    Get,
    Post,
    Put,
    Delete,
    Options,
}

#[derive(Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum ContentType {
    Json,
    Form,
}

#[derive(Deserialize, schemars::JsonSchema)]
pub struct FetchParams {
    /// The URL to fetch
    url: String,
    /// HTTP method (GET, POST, PUT, DELETE, OPTIONS)
    #[serde(default = "default_method")]
    method: HttpMethod,
    /// Content type (json or form)
    #[serde(default)]
    content_type: Option<ContentType>,
    /// Headers to include in the request
    #[serde(default)]
    headers: Option<HashMap<String, String>>,
    /// Body data for POST/PUT requests (can be JSON object or form data)
    #[serde(default)]
    body: Option<serde_json::Value>,
}

fn default_method() -> HttpMethod {
    HttpMethod::Get
}

#[tool_router(router = tool_router_fetch, vis = "pub")]
impl DiveDefaultService {
    #[tool(description = "Make HTTP requests with support for different methods and content types")]
    pub async fn fetch(
        &self,
        Parameters(params): Parameters<FetchParams>,
    ) -> Result<CallToolResult, McpError> {
        // Build the request based on method
        let mut request_builder = match params.method {
            HttpMethod::Get => self.http_client.get(&params.url),
            HttpMethod::Post => self.http_client.post(&params.url),
            HttpMethod::Put => self.http_client.put(&params.url),
            HttpMethod::Delete => self.http_client.delete(&params.url),
            HttpMethod::Options => self
                .http_client
                .request(reqwest::Method::OPTIONS, &params.url),
        };

        // Add headers if provided
        if let Some(headers) = params.headers {
            for (key, value) in headers {
                request_builder = request_builder.header(&key, &value);
            }
        }

        // Add body if provided
        if let Some(body) = params.body {
            match params.content_type {
                Some(ContentType::Form) => {
                    // Convert JSON object to form data
                    if let Some(obj) = body.as_object() {
                        let mut form = Vec::new();
                        for (key, value) in obj {
                            if let Some(val_str) = value.as_str() {
                                form.push((key.clone(), val_str.to_string()));
                            } else {
                                form.push((key.clone(), value.to_string()));
                            }
                        }
                        request_builder = request_builder.form(&form);
                    } else {
                        return Err(McpError::new(
                            rmcp::model::ErrorCode::INVALID_PARAMS,
                            "Body must be an object for form content type".to_string(),
                            None,
                        ));
                    }
                }
                Some(ContentType::Json) | None => {
                    // Default to JSON
                    request_builder = request_builder.json(&body);
                }
            }
        }

        // Send the request
        match request_builder.send().await {
            Ok(response) => {
                let status = response.status();
                let headers: HashMap<String, String> = response
                    .headers()
                    .iter()
                    .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
                    .collect();

                match response.text().await {
                    Ok(body) => {
                        let result = serde_json::json!({
                            "status": status.as_u16(),
                            "statusText": status.canonical_reason().unwrap_or(""),
                            "headers": headers,
                            "body": body,
                        });

                        Ok(CallToolResult::success(vec![Content::text(
                            serde_json::to_string_pretty(&result)
                                .unwrap_or_else(|_| result.to_string()),
                        )]))
                    }
                    Err(e) => Err(McpError::new(
                        rmcp::model::ErrorCode::INTERNAL_ERROR,
                        format!("Failed to read response body: {}", e),
                        None,
                    )),
                }
            }
            Err(e) => Err(McpError::new(
                rmcp::model::ErrorCode::INTERNAL_ERROR,
                format!("Failed to send request: {}", e),
                None,
            )),
        }
    }
}

