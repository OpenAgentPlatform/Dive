use chrono::DateTime;
use tauri_plugin_http::reqwest;

type ModelListResult = Result<Vec<String>, String>;

#[tauri::command]
pub async fn llm_openai_model_list(api_key: String) -> ModelListResult {
    get_openai_model_list(api_key, "https://api.openai.com/v1").await
}

#[tauri::command]
pub async fn llm_openai_compatible_model_list(
    api_key: String,
    base_url: String,
) -> ModelListResult {
    get_openai_model_list(api_key, base_url).await
}

#[tauri::command]
pub async fn llm_openai_azure_model_list(
    api_key: String,
    endpoint: String,
    deployment: String,
    api_version: String,
) -> ModelListResult {
    let config = async_openai::config::AzureConfig::new()
        .with_api_key(api_key)
        .with_api_version(api_version)
        .with_api_base(endpoint)
        .with_deployment_id(deployment);

    let client = async_openai::Client::with_config(config);
    let models = async_openai::Models::new(&client);
    let list = models.list().await.map_err(|e| e.to_string())?;

    Ok(list.data
        .iter()
        .map(|model| model.id.clone())
        .collect::<Vec<String>>())
}

#[tauri::command]
pub async fn llm_anthropic_model_list(
    api_key: String,
    base_url: Option<String>,
) -> ModelListResult {
    let base_url = base_url.unwrap_or("https://api.anthropic.com".to_string());

    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/v1/models", base_url))
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let body = response
        .json::<serde_json::Value>()
        .await
        .map_err(|_| "Failed to get model list")?;

    if let Some(err) = body.get("error") {
        if let Some(msg) = err.get("message") {
            return Err(msg.to_string());
        }
        return Err(err.to_string());
    }

    body.get("data")
        .and_then(|data| data.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|model| {
                    model
                        .get("id")
                        .and_then(|id| id.as_str().map(|id| id.to_string()))
                })
                .collect::<Vec<String>>()
        })
        .ok_or("The model list parsing failed".to_string())
}

#[tauri::command]
pub async fn llm_ollama_model_list(base_url: String) -> ModelListResult {
    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/api/tags", base_url))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let mut body = response
        .json::<serde_json::Value>()
        .await
        .map_err(|_| "Failed to get model list")?;

    body.get("models")
        .and_then(|data| data.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|model| {
                    model
                        .get("name")
                        .and_then(|name| name.as_str().map(|name| name.to_string()))
                })
                .collect::<Vec<String>>()
        })
        .ok_or("The model list parsing failed".to_string())
}

#[tauri::command]
pub fn llm_bedrock_model_list() -> ModelListResult {
    // use custom model for bedrock
    Ok(vec![])
}

#[tauri::command]
pub async fn llm_mistralai_model_list(api_key: String) -> ModelListResult {
    let client = reqwest::Client::new();
    let response = client
        .get("https://api.mistral.ai/v1/models")
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = response.status().as_u16();

    let mut body = response
        .json::<serde_json::Value>()
        .await
        .map_err(|_| "Failed to get model list")?;

    if status > 399 {
        if let Some(err) = body.get("msg") {
            return Err(err.to_string());
        }
        return Err("Failed to get model list".to_string());
    }

    body.get_mut("data")
        .and_then(|data| data.as_array_mut())
        .map(|arr| {
            arr.sort_by(|a, b| {
                let a = a.get("created_at").and_then(|created| created.as_u64()).unwrap_or(0);
                let b = b.get("created_at").and_then(|created| created.as_u64()).unwrap_or(0);
                b.cmp(&a)
            });

            arr.iter()
                .filter_map(|model| {
                    model
                        .get("name")
                        .and_then(|name| name.as_str().map(|name| name.to_string()))
                })
                .collect::<Vec<String>>()
        })
        .ok_or("The model list parsing failed".to_string())
}

#[tauri::command]
pub async fn llm_google_genai_model_list(api_key: String) -> ModelListResult {
    let client = reqwest::Client::new();
    let response = client
        .get(format!(
            "https://generativelanguage.googleapis.com/v1beta/models?key={}",
            api_key
        ))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = response.status().as_u16();

    let body = response
        .json::<serde_json::Value>()
        .await
        .map_err(|_| "Failed to get model list")?;

    if status > 399 {
        return Err(body.to_string());
    }

    body.get("models")
        .and_then(|data| data.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|model| {
                    model
                        .get("name")
                        .and_then(|name| name.as_str().map(|name| name.to_string()))
                })
                .collect::<Vec<String>>()
        })
        .ok_or("The model list parsing failed".to_string())
}

async fn get_openai_model_list<T: AsRef<str>>(api_key: String, base_url: T) -> ModelListResult {
    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/models", base_url.as_ref()))
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = response.status().as_u16();

    let mut body = response
        .json::<serde_json::Value>()
        .await
        .map_err(|_| "Failed to get model list")?;

    if status > 399 {
        if let Some(err) = body.get("error") {
            if let Some(msg) = err.get("message") {
                return Err(msg.to_string());
            }
            return Err(err.to_string());
        }
        return Err(body.to_string());
    }

    body.get_mut("data")
        .and_then(|data| data.as_array_mut())
        .map(|arr| {
            arr.sort_by(|a, b| {
                let a = a.get("created").and_then(|created| created.as_u64()).unwrap_or(0);
                let b = b.get("created").and_then(|created| created.as_u64()).unwrap_or(0);
                b.cmp(&a)
            });

            arr
                .iter()
                .filter_map(|model| {
                    model
                        .get("id")
                        .and_then(|id| id.as_str().map(|id| id.to_string()))
                })
                .collect::<Vec<String>>()
        })
        .ok_or("The model list parsing failed".to_string())
}
