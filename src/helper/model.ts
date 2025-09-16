import type { BaseModel, BedrockModelGroup, CommonConfiguration, DefaultModelGroup, LLMGroup, ModelGroupSetting, ModelProvider } from "../../types/model"
import { ModelConfig, ModelConfigMap, ModelParameter, RawModelConfig } from "../atoms/configState"
import { defaultInterface } from "../atoms/interfaceState"
import isMatch from "lodash/isMatch"
import merge from "lodash/merge"
import { getVerifyKey, getVerifyKeyFromModelConfig } from "./verify"
import { getVerifyStatus } from "../views/Overlay/Model/ModelVerify"

export type GroupTerm = Partial<Omit<LLMGroup, "models">>
export type ModelTerm = Partial<BaseModel>

export function isBedRockModel(model: LLMGroup): model is BedrockModelGroup {
  return model.modelProvider === "bedrock"
}

export function defaultModelGroupSetting(): ModelGroupSetting {
  return {
    groups: [],
    common: {
      configuration: {
        temperature: 0.0,
        topP: 0.0
      }
    },
    disableDiveSystemPrompt: false
  }
}

export function defaultModelGroup(): LLMGroup {
  return {
    modelProvider: "default",
    models: [],
    extra: {},
    maxTokens: null,
    active: true,
  }
}

export function isDefaultModelGroup(group: LLMGroup): group is DefaultModelGroup {
  return group.modelProvider === "default"
}

export function defaultBaseModel(): BaseModel {
  return {
    disableStreaming: false,
    active: true,
    toolsInPrompt: false,
    extra: {},
    model: "",
  }
}

export function fromModelConfigToLLMGroup(config: ModelConfig): LLMGroup {
  const fakeRawConfig: RawModelConfig = {
    activeProvider: "fake",
    configs: {
      fake: config
    },
    disableDiveSystemPrompt: false
  }

  const setting = fromRawConfigToModelGroupSetting(fakeRawConfig)
  return setting.groups[0]
}

export function fromRawConfigToModelGroupSetting(rawConfig: RawModelConfig): ModelGroupSetting {
  const { configs, disableDiveSystemPrompt } = rawConfig
  const settings = defaultModelGroupSetting()
  settings.disableDiveSystemPrompt = disableDiveSystemPrompt ?? false
  const allVerifiedList = localStorage.getItem("modelVerify")

  const groups = groupRawModelConfig(configs)
  for (const configs of groups) {
    const group = defaultModelGroup()

    for (const config of configs) {
      const model = defaultBaseModel()
      const { model: modelName, active, configuration, apiKey, baseURL, toolsInPrompt, disable_streaming } = config

      settings.common.configuration = getCommonConfigurationFromRawConfiguration(configuration || {})

      model.active = active
      model.model = modelName!
      model.toolsInPrompt = !!toolsInPrompt
      model.disableStreaming = !!disable_streaming
      model.verifyStatus = config.modelProvider === "oap" ? "success" : getVerifyStatus(allVerifiedList?.[getVerifyKeyFromModelConfig(config)] ?? null)

      if (model.model) {
        group.models.push(model)
      }

      group.modelProvider = getModelProviderFromModelConfig(config)
      group.active = group.active || active

      if ("maxTokens" in config) {
        group.maxTokens = config.maxTokens as number
      }

      switch (group.modelProvider) {
        case "bedrock":
          group.extra.credentials = (config as any).credentials
          group.extra.region = (config as any).region
          break
        case "azure_openai":
          group.apiKey = apiKey
          group.extra.azureEndpoint = (config as any).azureEndpoint
          group.extra.azureDeployment = (config as any).azureDeployment
          group.extra.apiVersion = (config as any).apiVersion
          break
        case "openai":
        case "openai_compatible":
        case "ollama":
          group.apiKey = apiKey
          group.baseURL = baseURL || configuration?.baseURL
          group.extra.skip_tls_verify = !!(config as any).skip_tls_verify
          break
        default:
          group.apiKey = apiKey
          group.baseURL = baseURL || configuration?.baseURL
      }
    }

    settings.groups.push(group)
  }

  return settings
}

export function getCommonConfigurationFromRawConfiguration(rawConfiguration: ModelParameter): CommonConfiguration {
  return {
    temperature: rawConfiguration.temperature || 0,
    topP: rawConfiguration.topP || 0
  }
}

export function getModelProviderFromModelConfig(rawConfig: ModelConfig): ModelProvider {
  const { modelProvider, apiKey, baseURL } = rawConfig

  if (modelProvider !== "openai") {
    return modelProvider
  }

  if (apiKey && !baseURL) {
    return "openai"
  }

  return matchOpenaiCompatible(baseURL!)
}

export function matchOpenaiCompatible(baseURL: string): ModelProvider {
  switch (baseURL) {
    case defaultInterface.openrouter["baseURL"].default:
      return "openrouter"
    case defaultInterface.lmstudio["baseURL"].default:
      return "lmstudio"
    case defaultInterface.groq["baseURL"].default:
      return "groq"
    case defaultInterface.grok["baseURL"].default:
      return "grok"
    case defaultInterface.nvdia["baseURL"].default:
      return "nvdia"
    case defaultInterface.perplexity["baseURL"].default:
      return "perplexity"
    default:
      return "openai_compatible"
  }
}

export function groupRawModelConfig(map: ModelConfigMap): ModelConfig[][] {
  const profileGroup: Record<string, ModelConfig[]> = {}

  for (const mapKey in map) {
    const config = map[mapKey]
    if (!config) {
      continue
    }

    const { configuration, apiKey, baseURL } = config
    const _baseURL = baseURL || configuration?.baseURL || "baseurl"
    const _apiKey = apiKey || "apikey"

    const modelProvider = getModelProviderFromModelConfig(config)

    let key = modelProvider as string
    switch (modelProvider) {
      case "bedrock":
        key = `${modelProvider}-${(config as any).credentials.accessKeyId}`
        break
      case "ollama":
        key = `${modelProvider}-${_baseURL}`
        break
      default:
        key = `${modelProvider}-${_apiKey}-${_baseURL}`
    }

    if (!profileGroup[key]) {
      profileGroup[key] = []
    }

    profileGroup[key].push(config)
  }

  return Object.values(profileGroup)
}

export function queryGroup(term: GroupTerm, groups: LLMGroup[]): LLMGroup[] {
  return groups.filter(group => isMatch(group, term))
}

export function reverseQueryGroup(term: GroupTerm, groups: LLMGroup[]): LLMGroup[] {
  return groups.filter(group => !isMatch(group, term))
}

export function queryModel(term: ModelTerm, group: LLMGroup): BaseModel[] {
  return group.models.filter(model => isMatch(model, term))
}

export function reverseQueryModel(term: ModelTerm, group: LLMGroup): BaseModel[] {
  return group.models.filter(model => !isMatch(model, term))
}

export function updateGroup(groupTerm: GroupTerm, groups: LLMGroup[], newGroup: Partial<LLMGroup>) {
  const index = groups.findIndex(group => isMatch(group, groupTerm))
  if (index === -1) {
    return
  }

  groups[index] = merge({}, groups[index], newGroup)
  return groups
}

export function updateModel(modelTerm: ModelTerm, llmGroup: LLMGroup, newModel: Partial<BaseModel>) {
  const index = llmGroup.models.findIndex(model => isMatch(model, modelTerm))
  if (index === -1) {
    return
  }

  llmGroup.models[index] = merge({}, llmGroup.models[index], newModel)
  return llmGroup
}

export function removeGroup(groupTerm: GroupTerm, groups: LLMGroup[]) {
  return reverseQueryGroup(groupTerm, groups)
}

export function removeModel(modelTerm: ModelTerm, group: LLMGroup) {
  return reverseQueryModel(modelTerm, group)
}

export function getGroupAndModel(groupTerm: GroupTerm, modelTerm: ModelTerm, groups: LLMGroup[]): { group: LLMGroup, model: BaseModel } | null {
  const group = queryGroup(groupTerm, groups)
  if (!group.length) {
    return null
  }

  const model = queryModel(modelTerm, group[0])
  if (!model.length) {
    return null
  }

  return {
    group: group[0],
    model: model[0]
  }
}

export function intoModelConfig(group: LLMGroup, model: BaseModel): ModelConfig {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { active, models, extra, custom, baseURL, apiKey, ...baseConfig } = group
  const { disableStreaming, extra: modelExtra, custom: modelCustom, model: modelName } = model

  const allVerifiedList: Record<string, any> = JSON.parse(localStorage.getItem("modelVerify") || "{}")
  const status = getVerifyStatus(allVerifiedList?.[getVerifyKey(group)]?.[modelName] ?? null)

  const modelConfig = baseConfig as unknown as ModelConfig
  modelConfig.disable_streaming = disableStreaming
  modelConfig.toolsInPrompt = status === "successInPrompt"
  modelConfig.model = modelName
  modelConfig.modelProvider = [
    "openai_compatible",
    "lmstudio",
    "openrouter",
    "groq",
    "grok",
    "nvdia",
    "perplexity",
  ].includes(group.modelProvider) ? "openai" : group.modelProvider

  if (apiKey) {
    modelConfig.apiKey = apiKey
  }

  if (baseURL) {
    modelConfig.configuration = { baseURL } as any
  }

  return merge(
    {},
    modelConfig,
    extra,
    custom,
    modelExtra,
    modelCustom,
  )
}

export function intoRawModelConfigWithQuery(setting: ModelGroupSetting, groupTerm: GroupTerm, modelTerm: ModelTerm): RawModelConfig | null {
  const { groups } = setting
  const result = getGroupAndModel(groupTerm, modelTerm, groups)
  if (!result) {
    return null
  }

  const { group, model } = result
  return intoRawModelConfig(setting, group, model)
}

export function intoRawModelConfig(setting: ModelGroupSetting, group: LLMGroup, model: BaseModel): RawModelConfig | null {
  const { disableDiveSystemPrompt } = setting
  const modelConfig = intoModelConfig(group, model)

  const activeName = "act"
  return {
    disableDiveSystemPrompt,
    activeProvider: activeName,
    enableTools: model.enableTools ?? true,
    configs: {
      [activeName]: modelConfig
    }
  }
}

function keyMask(key: string): string {
  return "***" + key.slice(-4)
}

export function getGroupDisplayDetail(group: LLMGroup): string[] {
  switch (group.modelProvider) {
  case "bedrock":
    return [
      `KeyId: ${keyMask(group.extra.credentials.accessKeyId)}`,
      `SecretKey: ${keyMask(group.extra.credentials.secretAccessKey)}`,
      `Region: ${group.extra.region}`
    ]
  case "ollama":
    return [group.baseURL || ""]
  default:
    if (group.apiKey && group.baseURL) {
      return [`Key: ${keyMask(group.apiKey)}`, group.baseURL]
    }

    if (group.apiKey) {
      return [`Key: ${keyMask(group.apiKey)}`]
    }

    return [group.baseURL || ""]
  }
}

export function getGroupDisplayKeyInMenu(group: LLMGroup): string {
  switch (group.modelProvider) {
  case "bedrock":
    return keyMask(group.extra.credentials.accessKeyId)
  case "ollama":
  case "lmstudio":
    return group.modelProvider
  default:
    return keyMask(group.apiKey || "")
  }
}

export function getGroupTerm(group: LLMGroup): GroupTerm {
  switch (group.modelProvider) {
  case "bedrock":
    return {
      modelProvider: "bedrock",
      extra: {
        credentials: {
          accessKeyId: group.extra.credentials.accessKeyId
        }
      }
    }
  case "ollama":
    return {
      modelProvider: "ollama",
      ...(group.baseURL && { baseURL: group.baseURL } || {})
    }
  case "lmstudio":
    return {
      modelProvider: "lmstudio",
      apiKey: "lmstudio",
      baseURL: group.baseURL
    }
  default:
    if (group.apiKey && group.baseURL) {
      return {
        modelProvider: group.modelProvider,
        apiKey: group.apiKey,
        baseURL: group.baseURL
      }
    } else if (group.apiKey) {
      return {
        modelProvider: group.modelProvider,
        apiKey: group.apiKey
      }
    }

    return {
      modelProvider: group.modelProvider,
      baseURL: group.baseURL
    }
  }
}

export function getModelTerm(model: BaseModel): ModelTerm {
  return {
    model: model.model
  }
}

export function getTermFromModelConfig(config: ModelConfig): { group: GroupTerm, model: ModelTerm } | null {
  if (!config.model) {
    return null
  }

  const group = fromModelConfigToLLMGroup(config)
  return {
    group: getGroupTerm(group),
    model: getModelTerm(group.models[0])
  }
}

export function getTermFromRawModelConfig(config: RawModelConfig): { group: GroupTerm, model: ModelTerm } | null {
  const { configs, activeProvider } = config
  if (!configs[activeProvider]) {
    return null
  }

  return getTermFromModelConfig(configs[activeProvider])
}

export function fieldsToLLMGroup(provider: ModelProvider, obj: Record<string, any>) {
  const mutGroup = defaultModelGroup()
  mutGroup.modelProvider = provider

  const { apiKey, baseURL, model: _, ...other } = obj
  switch (provider) {
  case "bedrock":
    mutGroup.extra = { credentials: other }
    break
  default:
    if (apiKey) {
      mutGroup.apiKey = apiKey
    }
    if (baseURL) {
      mutGroup.baseURL = baseURL
    }

    mutGroup.extra = { ...other }
  }

  return mutGroup
}