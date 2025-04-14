import { InterfaceModelConfig, InterfaceModelConfigMap, ModelConfig, ModelConfigMap, MultiModelConfig } from "../atoms/configState"
import { InterfaceProvider, ModelProvider } from "../atoms/interfaceState"

export const formatData = (data: InterfaceModelConfig | ModelConfig): MultiModelConfig => {
  const {
    modelProvider,
    model,
    apiKey,
    baseURL,
    active,
    topP,
    temperature,
    configuration,
    checked,
    name,
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
    parameters: model
      ? {
          [model]: allParams,
  }
      : {},
  }
}

export const extractData = (data: InterfaceModelConfigMap|ModelConfigMap) => {
  const providerConfigList: MultiModelConfig[] = []

  Object.entries(data).forEach(([key, value]) => {
    if(!key.includes("-")){
      key = `${key}-${providerConfigList.length}-0`
    }
    const [name , index, modelIndex] = key.split("-")
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
    const configuration = { ...formData } as Partial<Pick<InterfaceModelConfig, 'configuration'>> &
      Omit<InterfaceModelConfig, 'configuration'>
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
    case "openai_compatible":
      return "openai"
    case "google_genai":
      return "google-genai"
    default:
      return provider
  }
}

export function convertConfigToInterfaceModel(model: InterfaceModelConfig|ModelConfig): InterfaceModelConfig {
  switch (model.modelProvider) {
    case "openai":
      if (model.baseURL) {
        return {
          ...model,
          modelProvider: "openai_compatible"
        }
      }

      break
    case "google-genai":
      return {
        ...model,
        modelProvider: "google_genai"
      }
  }

  return model as InterfaceModelConfig
}

