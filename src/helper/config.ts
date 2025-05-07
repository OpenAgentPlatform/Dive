import { InterfaceModelConfig, InterfaceModelConfigMap, ModelConfig, ModelConfigMap, MultiModelConfig } from "../atoms/configState"
import { defaultInterface, InterfaceProvider, ModelProvider } from "../atoms/interfaceState"

export const formatData = (data: InterfaceModelConfig | ModelConfig): MultiModelConfig => {
  const {
    modelProvider,
    model,
    apiKey,
    baseURL,
    active,
    topP,
    temperature,
    ...otherParams
  } = convertConfigToInterfaceModel(data)

  const baseParams = { topP: topP ?? 0, temperature: temperature ?? 0 }

  const allParams = { ...baseParams, ...otherParams }

  return {
    name: modelProvider,
    apiKey,
    baseURL,
    active: active ?? false,
    checked: false,
    models: model ? [model] : [],
    model,
    temperature: temperature ?? 0,
    topP: topP ?? 0,
    parameters: model ? { [model]: allParams } : {},
    ...otherParams,
  } as any
}

export const extractData = (data: InterfaceModelConfigMap|ModelConfigMap) => {
  const providerConfigList: MultiModelConfig[] = []

  Object.entries(data).forEach(([key, value]) => {
    if(!key.includes("-")){
      key = `${key}-${providerConfigList.length}-0`
    }
    const [name , index, ..._] = key.split("-")
    const _index = parseInt(index)

    if (!providerConfigList[_index]) {
      const _value: InterfaceModelConfig | ModelConfig = { ...value }
      _value.modelProvider = name as InterfaceProvider
      providerConfigList[_index] = {
        ...formatData(_value),
      }
    } else if (value.model) {
      const formatData_ = formatData(value)
      const allParams = formatData_.parameters[value.model] || {}
      providerConfigList[_index].models.push(value.model)
      providerConfigList[_index].parameters = {
        ...(providerConfigList[_index].parameters || {}),
        [value.model]: {
          ...allParams,
        },
      }
    }
  })

  return providerConfigList
}

export const compressData = (
  data: MultiModelConfig,
  index: number,
  _parameter: Record<string, any>,
) => {
  const compressedData: Record<string, InterfaceModelConfig> = {}

  const { models, parameters, ...restData } = data
  const modelsToProcess = models.length === 0 ? [null] : models
  modelsToProcess.forEach((model, modelIndex) => {
    const formData = {
      ...restData,
      model: model,
      modelProvider: data.name,
      ...(model ? parameters[model] || {} : _parameter),
    }
    const configuration = { ...formData } as Partial<Pick<InterfaceModelConfig, "configuration">> &
      Omit<InterfaceModelConfig, "configuration">
    delete configuration.configuration
    compressedData[`${restData.name}-${index}-${modelIndex}`] = {
      ...formData,
      configuration: configuration as InterfaceModelConfig,
    }
  })

  return compressedData
}

export function transformModelProvider(provider: InterfaceProvider): ModelProvider {
  switch (provider) {
    case "openrouter":
    case "lmstudio":
    case "groq":
    case "grok":
    case "nvdia":
    case "perplexity":
    case "openai_compatible":
      return "openai"
    case "google_genai":
      return "google-genai"
    default:
      return provider
  }
}

export function getInterfaceProvider(model: InterfaceModelConfig|ModelConfig): InterfaceProvider {
  switch (model.modelProvider) {
    case "openai":
      if (!model.baseURL) {
        break
      }

      switch (model.baseURL) {
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
    case "google-genai":
      return "google_genai"
  }

  return model.modelProvider
}

export function convertConfigToInterfaceModel(model: InterfaceModelConfig|ModelConfig): InterfaceModelConfig {
  model.modelProvider = getInterfaceProvider(model)
  return model as InterfaceModelConfig
}

