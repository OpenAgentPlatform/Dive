import { atom } from 'jotai'
import { ModelProvider } from './interfaceState'

export type ModelConfigList = ModelConfig[]

export type ModelConfig = {
  apiKey: string
  baseURL: string
  model: string | null
  modelProvider: ModelProvider
  configuration: ModelConfig
  active: boolean
  topP: number
  temperature: number
}

export type ActiveProviderConfig = {
  activeProvider: ModelProvider|""
  configs: Record<ModelProvider, ModelConfig>
}

export type MultiModelConfig = {
  name: ModelProvider
  apiKey: string
  baseURL: string
  active: boolean
  checked: boolean
  models: string[]
  topP: number
  temperature: number
}

export const configAtom = atom<ActiveProviderConfig | null>(null)

export const configListAtom = atom<Record<string, ModelConfig> | null>(null)

export const hasConfigAtom = atom(
  (get) => {
    const config = get(configAtom)
    return config !== null && config.activeProvider !== ""
  }
)

export const hasActiveConfigAtom = atom(
  (get) => {
    return get(hasConfigAtom) && get(activeProviderAtom) !== "none" as any
  }
)

export const activeProviderAtom = atom<ModelProvider>(
  (get) => {
    const config = get(configAtom)
    return config?.activeProvider || "none" as any
  }
)

export const activeConfigAtom = atom(
  (get) => {
    const config = get(configAtom)
    if (!config?.activeProvider) return null
    return config.configs[config.activeProvider]
  }
)

export const providerConfigAtom = atom(
  (get) => (provider: ModelProvider) => {
    const config = get(configAtom)
    return config?.configs[provider] || null
  }
)

export const loadConfigAtom = atom(
  null,
  async (get, set) => {
    try {
      const response = await fetch("/api/config/model")
      const data = await response.json()
      const config = data.config
      set(configAtom, config)
      set(configListAtom, config.configs)
      return config
    } catch (error) {
      console.warn("Failed to load config:", error)
      return null
    }
  }
)

export const saveConfigAtom = atom(
  null,
  async (get, set, params: {
    formData: ModelConfig
    provider: ModelProvider
  }) => {
    const { formData, provider } = params
    const modelProvider = provider.startsWith("openai") ? "openai" : provider
    formData.active = true
    const configuration = {...formData} as Partial<Pick<ModelConfig, "configuration">> & Omit<ModelConfig, "configuration">
    delete configuration.configuration

    try {
      const response = await fetch("/api/config/model", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: `${provider}`,
          modelSettings: {
            ...formData,
            modelProvider,
            configuration,
          },
        }),
      })

      const data = await response.json()
      if (data.success) {
        const config = get(configAtom)
        if (config) {
          config.configs[provider] = formData
        }
        set(configAtom, config)
      }
      return data
    } catch (error) {
      console.error("Failed to save config:", error)
      throw error
    }
  }
)

export const saveAllConfigAtom = atom(
  null,
  async (get, set, params: {
    providerConfigs: Record<string, ModelConfig>,
    activeProvider?: ModelProvider
  }) => {
    const { providerConfigs, activeProvider } = params

    try {
      const response = await fetch("/api/config/model/replaceAll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          activeProvider: activeProvider ?? get(activeProviderAtom),
          configs: providerConfigs,
          enable_tools: true
        }),
      })

      const data = await response.json()
      if (data.success) {
        let config = get(configAtom)
        if (config) {
          config = {
            ...config,
            configs: providerConfigs,
            activeProvider: activeProvider ?? get(activeProviderAtom)
          }
        }
        set(configAtom, config)
        set(configListAtom, providerConfigs)
      }
      return data
    } catch (error) {
      console.error("Failed to save config:", error)
      throw error
    }
  }
)

export const formatData = (data: ModelConfig) => {
  return {
    name: data.modelProvider as ModelProvider,
    apiKey: data.apiKey,
    baseURL: data.baseURL,
    active: data.active ?? false,
    checked: false,
    models: data.model ? [data.model] : [],
    topP: data.topP ?? 0,
    temperature: data.temperature ?? 0,
  }
}

export const extractData = (data: Record<string, ModelConfig>) => {
  const providerConfigList: MultiModelConfig[] = []

  Object.entries(data).forEach(([key, value]) => {
    if(!key.includes("-")){
      key = `${key}-${providerConfigList.length}-0`
    }
    const [name, index, modelIndex] = key.split("-")
    const _index = parseInt(index)

    if (!providerConfigList[_index]) {
      const _value = {...value}
      _value.modelProvider = name as ModelProvider
      providerConfigList[_index] = {
        ...formatData(_value),
      }
    } else if(value.model) {
      providerConfigList[_index].models.push(value.model)
    }
  })

  return providerConfigList
}

export const compressData = (data: MultiModelConfig, index: number) => {
  const compressedData: Record<string, ModelConfig> = {}

  const { models, ...restData } = data
  const modelsToProcess = models.length === 0 ? [null] : models
  modelsToProcess.forEach((model, modelIndex) => {
    const formData = {
      ...restData,
      model: model,
      modelProvider: data.name
    }
    const configuration = {...formData} as Partial<Pick<ModelConfig, "configuration">> & Omit<ModelConfig, "configuration">
    delete configuration.configuration
    compressedData[`${restData.name}-${index}-${modelIndex}`] = {
      ...formData,
      configuration: configuration as ModelConfig,
    }
  })

  return compressedData
}