export type BaseProvider =
  "openai" |
  "ollama" |
  "anthropic" |
  "mistralai" |
  "oap" |
  "openai_compatible" |
  "google-genai" |
  "openrouter" |
  "lmstudio" |
  "groq" |
  "grok" |
  "nvdia" |
  "perplexity" |
  "azure_openai"

export type ModelVerifyStatus = "ignore" | "success" | "successInPrompt" | "unSupportTool" | "unSupportModel" | "unVerified" | "error" | "verifying" | "abort"

export type ModelProvider = BaseProvider | "bedrock" | "default"

export interface BaseModel<E = Record<string, any>> {
  disableStreaming: boolean
  active: boolean
  toolsInPrompt: boolean
  extra: E
  custom?: Record<string, any>
  model: string
  isCustomModel?: boolean
  verifyStatus?: ModelVerifyStatus
  enableTools?: boolean
  expired?: boolean
}

export interface BaseConfigInModel {
  temperature: number
  topP: number
}

export interface ModelGroup<P extends ModelProvider, ME = Record<string, any>, E = Record<string, any>> {
  modelProvider: P
  maxTokens: number | null
  apiKey?: string
  baseURL?: string
  active: boolean
  models: BaseModel<E>[]
  extra: ME
  custom?: Record<string, any>
}

export type BedrockCredential = {
  accessKeyId: string
  secretAccessKey: string
  sessionToken: string
  region: string
}

export type AzureOpenaiConfig = {
  apiKey: string
  azureEndpoint: string
  azureDeployment: string
  apiVersion: string
}

export type DefaultModelGroup = ModelGroup<"default", any, any>
export type BedrockModelGroup = ModelGroup<"bedrock", { credentials: BedrockCredential, region: string }>
export type AzureOpenaiModelGroup = ModelGroup<"azure_openai", AzureOpenaiConfig>

export type LLMGroup = ModelGroup<BaseProvider> | BedrockModelGroup | AzureOpenaiModelGroup | DefaultModelGroup

export interface CommonConfiguration {
  temperature: number
  topP: number
}

export interface ModelGroupSetting {
  groups: LLMGroup[]
  disableDiveSystemPrompt: boolean
  common: {
    configuration: CommonConfiguration
    [key: string]: any
  }
}