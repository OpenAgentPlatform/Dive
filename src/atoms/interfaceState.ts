export const EMPTY_PROVIDER = "none"

export type BaseProvider = "openai" | "ollama" | "anthropic" | "mistralai" | "bedrock"
export type ModelProvider = BaseProvider | "google-genai"
export type InterfaceProvider = BaseProvider | "openai_compatible" | "google_genai"
export const PROVIDERS: InterfaceProvider[] = ["openai", "openai_compatible", "ollama", "anthropic", "google_genai", "mistralai", "bedrock"] as const

export const PROVIDER_LABELS: Record<InterfaceProvider, string> = {
  openai: "OpenAI",
  openai_compatible: "OpenAI Compatible",
  ollama: "Ollama",
  anthropic: "Anthropic",
  google_genai: "Google Gemini",
  mistralai: "Mistral AI",
  bedrock: "AWS Bedrock",
}

export const PROVIDER_ICONS: Record<InterfaceProvider, string> = {
  ollama: "img://model_ollama.svg",
  openai_compatible: "img://model_openai_compatible.svg",
  openai: "img://model_openai.svg",
  anthropic: "img://model_anthropic.svg",
  google_genai: "img://model_gemini.svg",
  mistralai: "img://model_mistral-ai.svg",
  bedrock: "img://model_bedrock.svg",
}

export type InputType = "text" | "password"

export interface FieldDefinition {
  type: string | "list"
  inputType?: InputType
  description: string
  required: boolean
  default: any
  placeholder?: any
  label: string
  listCallback?: (deps: Record<string, string>) => Promise<string[]>
  listDependencies?: string[]
}

export type InterfaceDefinition = Record<string, FieldDefinition>

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
        try {
          return !deps.apiKey ? [] : await window.ipcRenderer.openaiModelList(deps.apiKey)
        } catch (error) {
          console.error(error)
          return []
        }
      },
      listDependencies: ["apiKey"]
    },
  },
  openai_compatible: {
    baseURL: {
      type: "string",
      inputType: "text",
      label: "Base URL",
      description: "Base URL for API calls",
      required: false,
      default: "",
      placeholder: ""
    },
    apiKey: {
      type: "string",
      inputType: "password",
      label: "API Key",
      description: "API Key",
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
      placeholder: "Default model",
      listCallback: async (deps) => {
        try {
          return await window.ipcRenderer.openaiCompatibleModelList(deps.apiKey, deps.baseURL)
        } catch (error) {
          console.error(error)
          return []
        }
      },
      listDependencies: ["apiKey", "baseURL"]
    }
  },
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
        try {
          return await window.ipcRenderer.ollamaModelList(deps.baseURL)
        } catch (error) {
          console.error(error)
          return []
        }
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
        try {
          return await window.ipcRenderer.anthropicModelList(deps.apiKey, deps.baseURL)
        } catch (error) {
          console.error(error)
          return []
        }
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
        try {
          return await window.ipcRenderer.googleGenaiModelList(deps.apiKey)
        } catch (error) {
          console.error(error)
          return []
        }
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
        try {
          return await window.ipcRenderer.mistralaiModelList(deps.apiKey)
        } catch (error) {
          console.error(error)
          return []
        }
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
      required: false,
      default: "",
      placeholder: "YOUR_AWS_ACCESS_KEY_ID"
    },
    secretAccessKey: {
      type: "string",
      inputType: "password",
      label: "AWS Secret Access Key",
      description: "",
      required: false,
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
        try {
          return await window.ipcRenderer.bedrockModelList(deps.accessKeyId, deps.secretAccessKey, deps.sessionToken, deps.region)
        } catch (error) {
          console.error(error)
          return []
        }
      },
      listDependencies: ["accessKeyId", "secretAccessKey", "sessionToken", "region"]
    },
  }
}
