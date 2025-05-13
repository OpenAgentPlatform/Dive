import { getVerifyStatus } from "../views/Overlay/Model/ModelVerify"
import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"
import { EMPTY_PROVIDER, InterfaceProvider, ModelProvider } from "./interfaceState"
import { getModelPrefix } from "../util"
import { getInterfaceProvider, transformModelProvider } from "../helper/config"
import { ignoreFieldsForModel } from "../constants"


export type OldVerifyStatus = {
  success: boolean
  connectingSuccess: boolean
  supportTools: boolean
  connectingResult: string | null
  supportToolsResult: string | null
}

export type NewVerifyStatus = {
  success: boolean
  connecting: {
    success: boolean
    final_state: string
    error_msg: string | null
  }
  supportTools: {
    success: boolean
    final_state: string
    error_msg: string | null
  }
  supportToolsInPrompt: {
    success: boolean
    final_state: string
    error_msg: string | null
  }
}

export type ProviderRequired = {
  apiKey: string
  baseURL: string
  model: string | null
}

export type ModelParameter = {
  topP: number
  temperature: number
}

export type BedrockCredentials = {
  accessKeyId: string
  secretAccessKey: string
  sessionToken: string
}

export type ModelConfig = ProviderRequired & ModelParameter & {
  modelProvider: ModelProvider
  configuration: Partial<ProviderRequired> & ModelParameter
  active: boolean
  enableTools?: boolean
}

export type InterfaceModelConfig = Omit<ModelConfig, "modelProvider"> & Partial<ModelParameter> & Partial<BedrockCredentials> & {
  modelProvider: InterfaceProvider;
    checked?: boolean;
    name?: string;
  };

export type ModelConfigMap = Record<string, ModelConfig>
export type InterfaceModelConfigMap = Record<string, InterfaceModelConfig>

export type RawModelConfig = {
  activeProvider: string
  configs: ModelConfigMap
  disableDiveSystemPrompt: boolean
}

export type MultiModelConfig = ProviderRequired & ModelParameter & Partial<BedrockCredentials> & {
  name: InterfaceProvider
  active: boolean
  checked: boolean
  models: string[]
  parameters: {
    [key: string]: any
  }
}

export const configAtom = atom<RawModelConfig>({
  activeProvider: "",
  configs: {},
  disableDiveSystemPrompt: false
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
    const activeProvider = get(activeProviderAtom)
    if(!config || !activeProvider || activeProvider === EMPTY_PROVIDER || !config.configs[activeProvider]){
      return null
    }

    return config.configs[activeProvider]
  }
)

export const activeConfigIdAtom = atom<string>(
  (get) => {
    const config = get(configAtom)
    const activeProvider = get(activeProviderAtom)
    return !config ? "" : activeProvider
  }
)

export const enabledConfigsAtom = atom<ModelConfigMap>(
  (get) => {
    const allVerifiedList = get(modelVerifyListAtom)
    const configDict = get(configDictAtom)
    return Object.keys(configDict)
      .reduce((acc, key) => {
        const config = configDict[key]
        const verifiedConfig = allVerifiedList[config.apiKey || config.baseURL as string]
        if(config.active
          && config.model
          && (!verifiedConfig || !verifiedConfig[config.model as string] || verifiedConfig[config.model as string].connecting?.success || verifiedConfig[config.model as string] === "ignore")
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
    return Object.keys(enabledConfigs).map((key) => {
      let modelName = enabledConfigs[key].model
      if(modelName && modelName.length > 43) {
        modelName = modelName.slice(0, 20) + "..." + modelName.slice(-20)
      }

      return {
        key,
        name: `${getModelPrefix(enabledConfigs[key], 4)}/${modelName}`,
        provider: getInterfaceProvider(enabledConfigs[key])
      }
    })
  }
)

export const configDictAtom = atom<ModelConfigMap>((get) => get(configAtom).configs)

export const modelVerifyListAtom = atomWithStorage<Record<string, any>>("modelVerify", {})

export const isConfigNotInitializedAtom = atom(
  (get) => {
    const config = get(configAtom)
    return !config?.activeProvider
  }
)

export const isConfigActiveAtom = atom(
  (get) => {
    const config = get(configAtom)
    const activeProvider = get(activeProviderAtom)

    return config !== null && activeProvider !== EMPTY_PROVIDER
  }
)

export const activeProviderAtom = atom<string>(
  (get) => {
    const config = get(configAtom)
    const allVerifiedList = get(modelVerifyListAtom)
    if(!config){
      return EMPTY_PROVIDER
    }

    if(!config.configs[config.activeProvider]?.active){
      return EMPTY_PROVIDER
    }

    const key = config.configs[config.activeProvider]?.apiKey || config.configs[config.activeProvider]?.baseURL
    const verifiedStatus = allVerifiedList[key as string]
    const activeModel = config.configs[config.activeProvider]?.model as string || ""
    if(!activeModel){
      return EMPTY_PROVIDER
    }

    const verifiedModel = verifiedStatus?.[activeModel]
    if(verifiedModel && typeof verifiedModel === "object" && "connecting" in verifiedModel && !verifiedModel.connecting.success) {
      return EMPTY_PROVIDER
    }

    return config?.activeProvider || EMPTY_PROVIDER
  }
)

export const currentModelSupportToolsAtom = atom<boolean>(
  (get) => {
    const allVerifiedList = get(modelVerifyListAtom)
    const activeConfig = get(activeConfigAtom)
    const activeModel = activeConfig?.model as string
    const verifiedConfig = allVerifiedList[activeConfig?.apiKey || activeConfig?.baseURL as string]
    // Can only check for tool support when the model is verified,
    // if the model is not verified, consider it as support tools
    return !verifiedConfig
            || !activeConfig
            || !verifiedConfig[activeModel]
            || (verifiedConfig[activeModel].supportTools && verifiedConfig[activeModel].supportTools.success)
            || (verifiedConfig[activeModel].supportToolsInPrompt && verifiedConfig[activeModel].supportToolsInPrompt.success)
            || verifiedConfig[activeModel] === "ignore"
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
    disableDiveSystemPrompt?: boolean
  }) => {
    const { providerConfigs, activeProvider, disableDiveSystemPrompt } = params

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

      if (config.modelProvider === "openai" && !config.apiKey) {
        config.apiKey = ""
      }

      if (!config.model) {
        config.model = ""
      }

      acc[key] = cleanUpModelConfig(config) as ModelConfig
      return acc
    }, {} as ModelConfigMap)

    const allVerifiedList = get(modelVerifyListAtom)
    const activeConfig = configs[activeProvider as string]
    const verifiedModel = allVerifiedList[activeConfig?.apiKey ?? activeConfig?.baseURL]?.[activeConfig.model ?? ""]
    const ifSuccessInPrompt = getVerifyStatus(verifiedModel) === "successInPrompt"
    const ifUnSupportTools = getVerifyStatus(verifiedModel) === "unSupportTool" || getVerifyStatus(verifiedModel) === "unSupportModel"
    const enableTools = ifUnSupportTools ? ("enableTools" in activeConfig ? activeConfig.enableTools : true) : true

    const ifConfigActive = activeProvider && configs[activeProvider as string]?.active
    const provider = ifConfigActive ? (activeProvider ?? get(activeProviderAtom)) : EMPTY_PROVIDER

    try {
      const response = await fetch("/api/config/model/replaceAll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          configs,
          enableTools,
          toolsInPrompt: ifSuccessInPrompt,
          activeProvider: provider,
          disableDiveSystemPrompt: disableDiveSystemPrompt ?? get(disableDiveSystemPromptAtom)
        }),
      })

      const data = await response.json()
      if (data.success) {
        set(configAtom, {
          ...get(configAtom),
          configs,
          activeProvider: provider
        })
      }
      return data
    } catch (error) {
      console.error("Failed to save config:", error)
      throw error
    }
  }
)

export const disableDiveSystemPromptAtom = atom<boolean>(
  (get) => {
    const config = get(configAtom)
    if("disableDiveSystemPrompt" in config) {
      return config.disableDiveSystemPrompt ?? false
    }
    return false
  }
)

export const updateDisableDiveSystemPromptAtom = atom(
  null,
  (get, set, params: {
    value: boolean
  }) => {
    const { value } = params
    set(configAtom, {
      ...get(configAtom),
      disableDiveSystemPrompt: value
    })
    set(writeRawConfigAtom, {
      providerConfigs: get(configDictAtom) as unknown as InterfaceModelConfigMap,
      activeProvider: get(activeProviderAtom) as InterfaceProvider,
      disableDiveSystemPrompt: value
    })
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

  const body: any = {
    ..._formData,
    modelProvider,
    configuration,
  }

  if (!body.baseURL) {
    delete body.baseURL
  }

  if (!body?.configuration?.baseURL) {
    delete body.configuration.baseURL
  }

  return await fetch("/model_verify", {
    signal,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      modelSettings: body,
    }),
  }).then(res => res.json())
}

export const writeEmptyConfigAtom = atom(
  null,
  async (get, set) => {
    const config = {
      configs: {},
      enableTools: true,
      activeProvider: EMPTY_PROVIDER,
      disableDiveSystemPrompt: false
    }

    await fetch("/api/config/model/replaceAll", {
      method: "POST",
      headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      }
    )

    set(configAtom, config)
  }
)

function cleanUpModelConfig(config: any) {
  const _config = {...config}
  delete _config.configuration.active
  delete _config.configuration.checked
  delete _config.configuration.modelProvider
  delete _config.configuration.model
  delete _config.configuration.apiKey
  delete _config.configuration.name
  delete _config.configuration.embed
  delete _config.configuration.embed_dims
  delete _config.configuration.maxTokens
  delete _config.configuration.vector_store
  return _config
}
