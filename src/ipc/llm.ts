import { invoke } from "@tauri-apps/api/core"
import { ModelProvider } from "../../types/model"
import { ModelResults } from "../vite-env"
import { isTauri } from "./env"

export function fetchElectronModels(provider: ModelProvider, apiKey: string, baseURL: string = "", extra: string[] = []) {
  switch(provider) {
  case "openai":
    return window.ipcRenderer.openaiModelList(apiKey)
  case "ollama":
    return window.ipcRenderer.ollamaModelList(baseURL)
  case "anthropic":
    return window.ipcRenderer.anthropicModelList(apiKey, baseURL)
  case "google-genai":
    return window.ipcRenderer.googleGenaiModelList(apiKey)
  case "bedrock":
    return window.ipcRenderer.bedrockModelList(...(extra as [string, string, string, string]))
  case "mistralai":
    return window.ipcRenderer.mistralaiModelList(apiKey)
  case "azure_openai":
    return window.ipcRenderer.azureOpenaiModelList(apiKey, ...(extra as [string, string, string]))
  // openai compatible
  default:
    return window.ipcRenderer.openaiCompatibleModelList(apiKey, baseURL)
  }
}

export async function fetchTauriModels(provider: ModelProvider, apiKey: string, baseUrl: string = "", extra: string[] = []): Promise<ModelResults> {
  const wrapper = async (res: Promise<string[]>): Promise<ModelResults> => {
    return res
      .then(res => ({
        results: res,
        error: undefined,
      }))
      .catch(err => ({
        results: [],
        error: err.toString(),
      }))
  }

  switch(provider) {
  case "openai":
    return wrapper(invoke("llm_openai_model_list", { apiKey }))
  case "ollama":
    return wrapper(invoke("llm_ollama_model_list", { baseUrl }))
  case "anthropic":
    return wrapper(invoke("llm_anthropic_model_list", { apiKey, baseUrl }))
  case "google-genai":
    return wrapper(invoke("llm_google_genai_model_list", { apiKey }))
  case "bedrock":
    return wrapper(invoke("llm_bedrock_model_list"))
  case "mistralai":
    return wrapper(invoke("llm_mistralai_model_list", { apiKey }))
  case "azure_openai":
    const [endpoint, deployment, apiVersion] = extra as [string, string, string]
    if (!endpoint || !deployment || !apiVersion) {
      return {
        results: [],
        error: "Azure OpenAI endpoint, deployment id, and API version are required",
      }
    }

    return wrapper(invoke("llm_openai_azure_model_list", { apiKey, endpoint, deployment, apiVersion }))
  // openai compatible
  default:
    return wrapper(invoke("llm_openai_compatible_model_list", { apiKey, baseUrl }))
  }
}

export async function fetchModels(provider: ModelProvider, apiKey: string, baseURL: string = "", extra?: string[]) {
  const res = isTauri
    ? await fetchTauriModels(provider, apiKey, baseURL, extra)
    : await fetchElectronModels(provider, apiKey, baseURL, extra)

  console.log("[llm] fetchModels", res)
  return res
}