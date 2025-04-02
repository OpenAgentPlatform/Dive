import { getVerifyStatus } from './../views/Overlay/Model/ModelVerify'
import { atom } from "jotai"
import { EMPTY_PROVIDER, InterfaceProvider, ModelProvider } from "./interfaceState"
import { getModelPrefix } from "../util"
import { transformModelProvider } from "../helper/config"
import { ignoreFieldsForModel } from '../constants'

export type ProviderRequired = {
  apiKey: string
  baseURL: string
  model: string | null
}

export type ModelParameter = {
  topP: number
  temperature: number
}

export type ModelConfig = ProviderRequired & ModelParameter & {
  modelProvider: ModelProvider
  configuration: ProviderRequired & ModelParameter
  active: boolean
}

export type InterfaceModelConfig = Omit<ModelConfig, "modelProvider"> & {
  modelProvider: InterfaceProvider
}

export type ModelConfigMap = Record<string, ModelConfig>
export type InterfaceModelConfigMap = Record<string, InterfaceModelConfig>

export type RawModelConfig = {
  activeProvider: string
  configs: ModelConfigMap
}

export type MultiModelConfig = ProviderRequired & ModelParameter & {
  name: InterfaceProvider
  active: boolean
  checked: boolean
  models: string[]
}

export const configAtom = atom<RawModelConfig>({
  activeProvider: "",
  configs: {}
})

export const updateConfigWithProviderAtom = atom(
  null,
  (get, set, params: {
    provider: string
    data: ModelConfig
  }) => {
    const { provider, data } = params
    const config = get(configAtom)
    config.configs[provider] = data
    set(configAtom, {...config})
  }
)

export const activeConfigAtom = atom<ModelConfig | null>(
  (get) => {
    const config = get(configAtom)
    return !config ? null : config.configs[config.activeProvider] || null
  }
)

export const activeConfigIdAtom = atom<string>(
  (get) => {
    const config = get(configAtom)
    return !config ? "" : config.activeProvider
  }
)

export const enabledConfigsAtom = atom<ModelConfigMap>(
  (get) => {
    const localListOptions = localStorage.getItem("modelVerify")
    const allVerifiedList = localListOptions ? JSON.parse(localListOptions) : {}
    const configDict = get(configDictAtom)
    return Object.keys(configDict)
      .reduce((acc, key) => {
        const config = configDict[key]
        const verifiedConfig = allVerifiedList[config.apiKey || config.baseURL as string]
        if(config.active
          && config.model
          && (!verifiedConfig || !verifiedConfig[config.model as string] || verifiedConfig[config.model as string].success || verifiedConfig[config.model as string] === "ignore")
        ) {
          acc[key] = config
        }

        return acc
      }, {} as ModelConfigMap)
  }
)

export const enabledModelsIdsAtom = atom<{key: string, name: string, provider: string}[]>(
  (get) => {
    const enabledConfigs = get(enabledConfigsAtom)
    return Object.keys(enabledConfigs).map((key) => ({
      key,
      name: `${getModelPrefix(enabledConfigs[key], 4)}/${enabledConfigs[key].model}`,
      provider: enabledConfigs[key].modelProvider
    }))
  }
)

export const configDictAtom = atom<ModelConfigMap>((get) => get(configAtom).configs)

export const isConfigNotInitializedAtom = atom(
  (get) => {
    const config = get(configAtom)
    return !config?.activeProvider
  }
)

export const isConfigActiveAtom = atom(
  (get) => {
    const config = get(configAtom)
    return config !== null && config.activeProvider !== EMPTY_PROVIDER
  }
)

export const activeProviderAtom = atom<string>(
  (get) => {
    const config = get(configAtom)
    return config?.activeProvider || EMPTY_PROVIDER
  }
)

export const currentModelSupportToolsAtom = atom<boolean>(
  (get) => {
    const localListOptions = localStorage.getItem("modelVerify")
    const allVerifiedList = localListOptions ? JSON.parse(localListOptions) : {}
    const activeConfig = get(activeConfigAtom)
    const verifiedConfig = allVerifiedList[activeConfig?.apiKey || activeConfig?.baseURL as string]
    // Can only check for tool support when the model is verified,
    // if the model is not verified, consider it as support tools
    return !verifiedConfig
            || !activeConfig
            || !verifiedConfig[activeConfig.model as string]
            || verifiedConfig[activeConfig.model as string].supportTools
            || verifiedConfig[activeConfig.model as string] === "ignore"
  }
)

export const loadConfigAtom = atom(
  null,
  async (get, set) => {
    try {
      const response = await fetch("/api/config/model")
      const data = await response.json()
      set(configAtom, data.config)
      return data.config
    } catch (error) {
      console.warn("Failed to load config:", error)
      return null
    }
  }
)

export const saveFirstConfigAtom = atom(
  null,
  async (get, set, params: {
    data: InterfaceModelConfig
    provider: InterfaceProvider
  }) => {
    const { data: config, provider } = params
    const modelProvider = transformModelProvider(provider)
    config.active = true
    const configuration: any = {...config} as Partial<Pick<ModelConfig, "configuration">> & Omit<ModelConfig, "configuration">

    if (config.modelProvider === "bedrock") {
      config.apiKey = (config as any).accessKeyId || (config as any).credentials.accessKeyId
      if (!((config as any).credentials)) {
        ;(config as any).credentials = {
          accessKeyId: (config as any).accessKeyId,
          secretAccessKey: (config as any).secretAccessKey,
          sessionToken: (config as any).sessionToken,
        }
      }

      delete (config as any).accessKeyId
      delete (config as any).secretAccessKey
      delete (config as any).sessionToken
      delete configuration.accessKeyId
      delete configuration.secretAccessKey
      delete configuration.sessionToken
    }

    return set(writeRawConfigAtom, {
      providerConfigs: {
        [`${modelProvider}-0-0`]: cleanUpModelConfig({
          ...config,
          modelProvider,
          configuration,
        })
      },
      activeProvider: `${modelProvider}-0-0` as any
    })
  }
)

export const writeRawConfigAtom = atom(
  null,
  async (get, set, params: {
    providerConfigs: InterfaceModelConfigMap
    activeProvider?: InterfaceProvider
  }) => {
    const { providerConfigs, activeProvider } = params

    const configs = Object.keys(providerConfigs).reduce((acc, key) => {
      const config = providerConfigs[key] as any
      config.modelProvider = transformModelProvider(config.modelProvider)

      // process bedrock config
      if (config.modelProvider === "bedrock") {
        if (!config.credentials && (config as any).accessKeyId) {
          config.credentials = {
            accessKeyId: (config as any).accessKeyId,
            secretAccessKey: (config as any).secretAccessKey,
            sessionToken: (config as any).sessionToken,
          }
        }

        config.apiKey = (config as any).accessKeyId || (config as any).credentials?.accessKeyId

        delete config.accessKeyId
        delete config.secretAccessKey
        delete config.sessionToken
        delete config.configuration.accessKeyId
        delete config.configuration.secretAccessKey
        delete config.configuration.sessionToken
      }

      acc[key] = cleanUpModelConfig(config) as ModelConfig
      return acc
    }, {} as ModelConfigMap)

    const localListOptions = localStorage.getItem("modelVerify")
    const allVerifiedList = localListOptions ? JSON.parse(localListOptions) : {}
    const activeConfig = configs[activeProvider as string]
    const verifiedModel = allVerifiedList[activeConfig?.apiKey ?? activeConfig?.baseURL]?.[activeConfig.model ?? ""]

    try {
      const response = await fetch("/api/config/model/replaceAll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          configs,
          enable_tools: (getVerifyStatus(verifiedModel) !== "unSupportTool" && getVerifyStatus(verifiedModel) !== "unSupportModel") ? true : false,
          activeProvider: activeProvider ?? get(activeProviderAtom),
        }),
      })

      const data = await response.json()
      if (data.success) {
        set(configAtom, {
          ...get(configAtom),
          configs,
          activeProvider: activeProvider ?? get(activeProviderAtom)
        })
      }
      return data
    } catch (error) {
      console.error("Failed to save config:", error)
      throw error
    }
  }
)

export function prepareModelConfig(config: InterfaceModelConfig, provider: InterfaceProvider): InterfaceModelConfig {
  const _config = {...config}
  if (provider === "openai" && config.baseURL) {
    delete (_config as any).baseURL
  }

  if (_config.topP === 0) {
    delete (_config as any).topP
  }

  if (_config.temperature === 0) {
    delete (_config as any).temperature
  }

  return Object.keys(_config).reduce((acc, key) => {
    if (ignoreFieldsForModel.some(item => (item.model === _config.model || _config.model?.startsWith(item.prefix)) && item.fields.includes(key))) {
      return acc
    }

    return {
      ...acc,
      [key]: _config[key as keyof InterfaceModelConfig]
    }
  }, {} as InterfaceModelConfig)
}

export async function verifyModelWithConfig(config: InterfaceModelConfig, signal?: AbortSignal) {
  const modelProvider = transformModelProvider(config.modelProvider)
  const configuration = {...config} as Partial<Pick<ModelConfig, "configuration">> & Omit<ModelConfig, "configuration">
  delete configuration.configuration

  const _formData = prepareModelConfig(config, config.modelProvider)

  if (modelProvider === "bedrock") {
    _formData.apiKey = (_formData as any).accessKeyId || (_formData as any).credentials.accessKeyId
    if (!((_formData as any).credentials)) {
      ;(_formData as any).credentials = {
        accessKeyId: (_formData as any).accessKeyId,
        secretAccessKey: (_formData as any).secretAccessKey,
        sessionToken: (_formData as any).sessionToken,
      }
    }
  }

  console.log(modelProvider, _formData, configuration)
  return await fetch("/api/modelVerify", {
    signal,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      provider: modelProvider,
      modelSettings: {
        ..._formData,
        modelProvider,
        configuration,
      },
    }),
  }).then(res => res.json())
}

function cleanUpModelConfig(config: any) {
  const _config = {...config}
  delete _config.configuration.active
  delete _config.configuration.checked
  delete _config.configuration.modelProvider
  delete _config.configuration.model
  delete _config.configuration.apiKey
  delete _config.configuration.name
  return _config
}
