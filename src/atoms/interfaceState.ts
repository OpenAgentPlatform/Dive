import { imgPrefix } from "../ipc/env"
import { OAP_PROXY_URL } from "../../shared/oap"
import { ModelProvider } from "../../types/model"
import { fetchModels } from "../ipc/llm"
import { oapGetToken } from "../ipc"

export const EMPTY_PROVIDER = "none"

export const PROVIDERS: ModelProvider[] = [
  "openai",
  "openai_compatible",
  "ollama",
  "anthropic",
  "google-genai",
  "mistralai",
  "bedrock",
  "azure_openai",
  "openrouter",
  "lmstudio",
  "groq",
  "grok",
  "nvdia",
  "perplexity",
  "oap",
  "cerebras",
] as const

export const OPEAI_COMPATIBLE_PROVIDER: ModelProvider[] = [
  "openai_compatible",
  "lmstudio",
  "openrouter",
  "groq",
  "grok",
  "nvdia",
  "perplexity",
  "cerebras",
] as const

export const PROVIDER_LABELS: Record<ModelProvider, string> = {
  openai: "OpenAI",
  openai_compatible: "OpenAI Compatible",
  ollama: "Ollama",
  anthropic: "Anthropic",
  "google-genai": "Google Gemini",
  mistralai: "Mistral AI",
  bedrock: "AWS Bedrock",
  openrouter: "OpenRouter",
  lmstudio: "LM Studio",
  groq: "Groq",
  grok: "Grok",
  nvdia: "NVIDIA",
  perplexity: "Perplexity",
  oap: "OAP",
  azure_openai: "Azure OpenAI",
  cerebras: "Cerebras",
  default: "Default",
}

export const PROVIDER_ICONS: Record<ModelProvider, string> = {
  ollama: `${imgPrefix}model_ollama.svg`,
  openai_compatible: `${imgPrefix}model_openai_compatible.svg`,
  openai: `${imgPrefix}model_openai.svg`,
  anthropic: `${imgPrefix}model_anthropic.svg`,
  "google-genai": `${imgPrefix}model_gemini.svg`,
  mistralai: `${imgPrefix}model_mistral-ai.svg`,
  bedrock: `${imgPrefix}model_bedrock.svg`,
  openrouter: `${imgPrefix}model_openrouter.svg`,
  lmstudio: `${imgPrefix}model_lmstudio.svg`,
  groq: `${imgPrefix}model_groq.svg`,
  grok: `${imgPrefix}model_grok.svg`,
  nvdia: `${imgPrefix}model_nvdia.svg`,
  perplexity: `${imgPrefix}model_perplexity.svg`,
  oap: `${imgPrefix}logo_oap.png`,
  azure_openai: `${imgPrefix}model_azure.svg`,
  cerebras: `${imgPrefix}model_cerebras.svg`,
  default: "",
}

export type InputType = "text" | "password" | "checkbox"

export interface FieldDefinition {
  type: string | "list"
  inputType?: InputType
  description: string
  required: boolean
  default: any
  placeholder?: any
  readonly?: boolean
  label: string
  listCallback?: (deps: Record<string, string>) => Promise<string[]>
  listDependencies?: string[]
  value?: string
  getValue?: () => Promise<string>
}

export type InterfaceDefinition = Record<string, FieldDefinition>

const openaiCompatibleListCallback = async (deps: Record<string, string>) => {
  const results = await fetchModels("openai_compatible", deps.apiKey, deps.baseURL)
  if (results.error) {
    throw new Error(results.error)
  }
  return results.results
}

function openaiCompatibleTemplate(baseURL: string, overwrite: {apiKey?: any, baseURL?: any} = {apiKey: {}, baseURL: {}}): InterfaceDefinition {
  return {
    apiKey: {
      type: "string",
      inputType: "password",
      label: "API Key",
      description: "",
      required: false,
      default: "",
      placeholder: "YOUR_API_KEY",
      ...overwrite.apiKey,
    },
    baseURL: {
      type: "string",
      inputType: "text",
      label: "Base URL",
      description: "Base URL for API calls",
      required: true,
      default: baseURL,
      placeholder: baseURL,
      value: baseURL,
      readonly: false,
      ...overwrite.baseURL,
    },
    skip_tls_verify: {
      type: "boolean",
      inputType: "checkbox",
      label: "Skip TLS Verification",
      description: "Skip TLS Verification",
      required: false,
      default: false,
    },
    model: {
      type: "list",
      label: "Model ID",
      description: "modelConfig.modelDescriptionHint",
      required: false,
      default: "",
      placeholder: "Default model",
      listCallback: openaiCompatibleListCallback,
      listDependencies: ["apiKey", "baseURL"]
    }
  }
}

export const defaultInterface: Record<ModelProvider, InterfaceDefinition> = {
  default: {},
  openai: {
    apiKey: {
      type: "string",
      inputType: "password",
      label: "API Key",
      description: "OpenAI API Key",
      required: true,
      default: "",
      placeholder: "YOUR_API_KEY"
    },
    skip_tls_verify: {
      type: "boolean",
      inputType: "checkbox",
      label: "Skip TLS Verification",
      description: "Skip TLS Verification",
      required: false,
      default: false,
    },
    model: {
      type: "list",
      label: "Model ID",
      description: "modelConfig.modelDescriptionHint",
      required: false,
      default: "",
      placeholder: "Select a model",
      listCallback: async (deps) => {
        const results = await fetchModels("openai", deps.apiKey)
        if (results.error) {
          throw new Error(results.error)
        }
        return results.results
      },
      listDependencies: ["apiKey"]
    },
  },
  openai_compatible: openaiCompatibleTemplate("https://api.openai.com", {
    baseURL: {
      required: false,
      readonly: false,
    }
  }),
  oap: openaiCompatibleTemplate(`${OAP_PROXY_URL}/v1`, {
    apiKey: {
      getValue: () => {
        return oapGetToken()
      }
    }
  }),
  ollama: {
    baseURL: {
      type: "string",
      inputType: "text",
      label: "Base URL",
      description: "Base URL for API calls",
      required: true,
      default: "http://localhost:11434",
      placeholder: "http://localhost:11434"
    },
    skip_tls_verify: {
      type: "boolean",
      inputType: "checkbox",
      label: "Skip TLS Verification",
      description: "Skip TLS Verification",
      required: false,
      default: false,
    },
    model: {
      type: "list",
      label: "Model ID",
      description: "modelConfig.modelDescription",
      required: false,
      default: "",
      placeholder: "Select a model",
      listCallback: async (deps) => {
        const results = await fetchModels("ollama", "", deps.baseURL)
        if (results.error) {
          throw new Error(results.error)
        }
        return results.results
      },
      listDependencies: ["baseURL"]
    },
  },
  anthropic: {
    apiKey: {
      type: "string",
      inputType: "password",
      label: "API Key",
      description: "Anthropic API Key",
      required: false,
      default: "",
      placeholder: "YOUR_API_KEY"
    },
    baseURL: {
      type: "string",
      inputType: "text",
      label: "Base URL",
      description: "Base URL for API calls",
      required: false,
      default: "https://api.anthropic.com",
      placeholder: "https://api.anthropic.com"
    },
    model: {
      type: "list",
      label: "Model ID",
      description: "modelConfig.modelDescriptionHint",
      required: false,
      default: "",
      placeholder: "Select a model",
      listCallback: async (deps) => {
        const results = await fetchModels("anthropic", deps.apiKey, deps.baseURL)
        if (results.error) {
          throw new Error(results.error)
        }
        return results.results
      },
      listDependencies: ["apiKey", "baseURL"]
    },
  },
  "google-genai": {
    apiKey: {
      type: "string",
      inputType: "password",
      label: "API Key",
      description: "Google Gemini API Key",
      required: false,
      default: "",
      placeholder: "YOUR_API_KEY"
    },
    model: {
      type: "list",
      label: "Model ID",
      description: "modelConfig.modelDescriptionHint",
      required: false,
      default: "",
      placeholder: "Select a model",
      listCallback: async (deps) => {
        const results = await fetchModels("google-genai", deps.apiKey)
        if (results.error) {
          throw new Error(results.error)
        }
        return results.results
      },
      listDependencies: ["apiKey"]
    },
  },
  mistralai: {
    apiKey: {
      type: "string",
      inputType: "password",
      label: "API Key",
      description: "Mistral AI API Key",
      required: false,
      default: "",
      placeholder: "YOUR_API_KEY"
    },
    model: {
      type: "list",
      label: "Model ID",
      description: "modelConfig.modelDescriptionHint",
      required: false,
      default: "",
      placeholder: "Select a model",
      listCallback: async (deps) => {
        const results = await fetchModels("mistralai", deps.apiKey)
        if (results.error) {
          throw new Error(results.error)
        }
        return results.results
      },
      listDependencies: ["apiKey"]
    },
  },
  bedrock: {
    accessKeyId: {
      type: "string",
      inputType: "password",
      label: "AWS Access Key ID",
      description: "",
      required: true,
      default: "",
      placeholder: "YOUR_AWS_ACCESS_KEY_ID"
    },
    secretAccessKey: {
      type: "string",
      inputType: "password",
      label: "AWS Secret Access Key",
      description: "",
      required: true,
      default: "",
      placeholder: "YOUR_AWS_SECRET_ACCESS_KEY"
    },
    sessionToken: {
      type: "string",
      inputType: "password",
      label: "AWS Session Token",
      description: "",
      required: false,
      default: "",
      placeholder: "YOUR_AWS_SESSION_TOKEN"
    },
    region: {
      type: "string",
      inputType: "text",
      label: "Region",
      description: "",
      required: false,
      placeholder: "e.g. us-east-1",
      default: "us-east-1",
    },
    model: {
      type: "list",
      label: "Model ID",
      description: "modelConfig.modelDescriptionHint",
      required: false,
      default: "",
      placeholder: "Select a model",
      listCallback: async (deps) => {
        const results = await fetchModels("bedrock", "", "", [deps.accessKeyId, deps.secretAccessKey, deps.sessionToken, deps.region])
        if (results.error) {
          throw new Error(results.error)
        }
        return []
      },
      listDependencies: ["accessKeyId", "secretAccessKey", "sessionToken", "region"]
    },
    customModelId: {
      type: "string",
      label: "Custom Model ID",
      description: "",
      required: true,
      default: ""
    }
  },
  azure_openai: {
    apiKey: {
      type: "string",
      inputType: "password",
      label: "API Key",
      description: "Azure OpenAI API Key",
      required: true,
      default: "",
      placeholder: "YOUR_API_KEY"
    },
    azureEndpoint: {
      type: "string",
      inputType: "text",
      label: "Endpoint",
      description: "Azure OpenAI Endpoint",
      required: true,
      default: "",
      placeholder: "https://your-endpoint.openai.azure.com/"
    },
    azureDeployment: {
      type: "string",
      inputType: "text",
      label: "Deployment",
      description: "Azure OpenAI Deployment",
      required: true,
      default: "",
      placeholder: "YOUR_DEPLOYMENT"
    },
    apiVersion: {
      type: "string",
      inputType: "text",
      label: "API Version",
      description: "Azure OpenAI API Version",
      required: true,
      default: "2023-03-15-preview",
      placeholder: "2025-03-01-preview"
    },
    model: {
      type: "list",
      label: "Model ID",
      description: "modelConfig.modelDescriptionHint",
      required: false,
      default: "",
      placeholder: "Select a model",
      listCallback: async (deps) => {
        const results = await fetchModels("azure_openai", deps.apiKey, "", [deps.azureEndpoint, deps.azureDeployment, deps.apiVersion])
        if (results.error) {
          throw new Error(results.error)
        }
        return results.results
      },
      listDependencies: ["apiKey", "azureEndpoint", "azureDeployment", "apiVersion"]
    },
  },
  openrouter: openaiCompatibleTemplate("https://openrouter.ai/api/v1"),
  lmstudio: openaiCompatibleTemplate("https://localhost:1234/api/v1", {
    apiKey: {
      value: "lmstudio",
    },
    baseURL: {
      readonly: false,
    }
  }),
  groq: openaiCompatibleTemplate("https://api.groq.com/openai/v1"),
  grok: openaiCompatibleTemplate("https://api.x.ai/v1"),
  nvdia: openaiCompatibleTemplate("https://integrate.api.nvidia.com/v1"),
  perplexity: openaiCompatibleTemplate("https://api.perplexity.ai"),
  cerebras: openaiCompatibleTemplate("https://api.cerebras.ai/v1"),
}

export const isProviderIconNoFilter = (model: ModelProvider, userTheme: string, systemTheme: string) => {
  const isLightMode = userTheme === "system" ? systemTheme === "light" : userTheme === "light"
  switch (model) {
    case "oap":
    case "ollama":
    case "openai_compatible":
    case "bedrock":
    case "google-genai":
      return true
    case "mistralai":
      return isLightMode
    default:
      return model.startsWith("google") && isLightMode
  }
}
