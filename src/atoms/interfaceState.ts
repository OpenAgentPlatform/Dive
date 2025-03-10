import { atom } from "jotai"

export type ModelProvider = "openai" | "openai_compatible" | "ollama" | "anthropic"

export const PROVIDER_LABELS: Record<ModelProvider, string> = {
  openai: "OpenAI",
  openai_compatible: "OpenAI Compatible",
  ollama: "Ollama",
  anthropic: "Anthropic"
}

export const PROVIDER_ICONS: Record<ModelProvider, string> = {
  ollama: "img://model_ollama.svg",
  openai_compatible: "img://model_openai_compatible.svg",
  openai: "img://model_openai.svg",
  anthropic: "img://model_anthropic.svg"
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

export const defaultInterface: Record<ModelProvider, InterfaceDefinition> = {
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
  }
}

export const interfaceAtom = atom<{
  provider: ModelProvider
  fields: InterfaceDefinition
}>({
  provider: "openai",
  fields: defaultInterface["openai"]
})