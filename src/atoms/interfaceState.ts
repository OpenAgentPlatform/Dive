export const EMPTY_PROVIDER = "none"

export type BaseProvider = "openai" | "ollama" | "anthropic" | "mistralai" | "bedrock" | "azure_openai"
export type ModelProvider = BaseProvider | "google-genai"
export type InterfaceProvider = BaseProvider | "openai_compatible" | "google_genai" | "openrouter" | "lmstudio" | "groq" | "grok" | "nvdia" | "perplexity" | "azure_openai"
export const PROVIDERS: InterfaceProvider[] = [
  "openai",
  "openai_compatible",
  "ollama",
  "anthropic",
  "google_genai",
  "mistralai",
  "bedrock",
  "openrouter",
  "lmstudio",
  "groq",
  "grok",
  "nvdia",
  "perplexity",
  "azure_openai"
] as const

export const PROVIDER_LABELS: Record<InterfaceProvider, string> = {
  openai: "OpenAI",
  openai_compatible: "OpenAI Compatible",
  ollama: "Ollama",
  anthropic: "Anthropic",
  google_genai: "Google Gemini",
  mistralai: "Mistral AI",
  bedrock: "AWS Bedrock",
  openrouter: "OpenRouter",
  lmstudio: "LM Studio",
  groq: "Groq",
  grok: "Grok",
  nvdia: "NVIDIA",
  perplexity: "Perplexity",
  azure_openai: "Azure OpenAI",
}

export const PROVIDER_ICONS: Record<InterfaceProvider, string> = {
  ollama: "img://model_ollama.svg",
  openai_compatible: "img://model_openai_compatible.svg",
  openai: "img://model_openai.svg",
  anthropic: "img://model_anthropic.svg",
  google_genai: "img://model_gemini.svg",
  mistralai: "img://model_mistral-ai.svg",
  bedrock: "img://model_bedrock.svg",
  openrouter: "img://model_openrouter.svg",
  lmstudio: "img://model_lmstudio.svg",
  groq: "img://model_groq.svg",
  grok: "img://model_grok.svg",
  nvdia: "img://model_nvdia.svg",
  perplexity: "img://model_perplexity.svg",
  azure_openai: "img://model_azure_openai.svg",
}

export type InputType = "text" | "password"

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
}

export type InterfaceDefinition = Record<string, FieldDefinition>

const openaiCompatibleListCallback = async (deps: Record<string, string>) => {
  const results = await window.ipcRenderer.openaiCompatibleModelList(deps.apiKey, deps.baseURL)
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

export const defaultInterface: Record<InterfaceProvider, InterfaceDefinition> = {
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
    model: {
      type: "list",
      label: "Model ID",
      description: "modelConfig.modelDescriptionHint",
      required: false,
      default: "",
      placeholder: "Select a model",
      listCallback: async (deps) => {
        const results = await window.ipcRenderer.openaiModelList(deps.apiKey)
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
    model: {
      type: "list",
      label: "Model ID",
      description: "modelConfig.modelDescription",
      required: false,
      default: "",
      placeholder: "Select a model",
      listCallback: async (deps) => {
        const results = await window.ipcRenderer.ollamaModelList(deps.baseURL)
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
        const results = await window.ipcRenderer.anthropicModelList(deps.apiKey, deps.baseURL)
        if (results.error) {
          throw new Error(results.error)
        }
        return results.results
      },
      listDependencies: ["apiKey", "baseURL"]
    },
  },
  google_genai: {
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
        const results = await window.ipcRenderer.googleGenaiModelList(deps.apiKey)
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
        const results = await window.ipcRenderer.mistralaiModelList(deps.apiKey)
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
        const results = await window.ipcRenderer.bedrockModelList(deps.accessKeyId, deps.secretAccessKey, deps.sessionToken, deps.region)
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
      default: "",
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
        const results = await window.ipcRenderer.azureOpenaiModelList(deps.apiKey, deps.azureEndpoint, deps.azureDeployment, deps.apiVersion)
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
}
