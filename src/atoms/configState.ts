import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"
import { EMPTY_PROVIDER } from "./interfaceState"
import { isLoggedInOAPAtom, OAPLevelAtom } from "./oapState"
import { OAP_PROXY_URL } from "../../shared/oap"
import { ModelGroupSetting, ModelProvider, ModelVerifyStatus } from "../../types/model"
import { modelSettingsAtom } from "./modelState"
import { defaultBaseModel, defaultModelGroup, intoRawModelConfig, intoRawModelConfigWithQuery, reverseQueryGroup } from "../helper/model"
import { getVerifyKeyFromModelConfig } from "../helper/verify"
import { oapGetToken } from "../ipc"
import { fetchModels } from "../ipc/llm"


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

type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export type ModelConfig = Optional<ProviderRequired, "baseURL"> & {
  modelProvider: ModelProvider
  configuration: Partial<ProviderRequired> & ModelParameter
  active: boolean
  enableTools?: boolean
  disable_streaming?: boolean
  toolsInPrompt?: boolean
}

export type ModelConfigMap = Record<string, ModelConfig>

export type RawModelConfig = {
  activeProvider: string
  configs: ModelConfigMap
  disableDiveSystemPrompt?: boolean
  enableTools?: boolean
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
    console.log(config, activeProvider)
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

    const key = config.configs[config.activeProvider]?.apiKey || config.configs[config.activeProvider]?.baseURL
    const verifiedStatus = allVerifiedList[key as string]
    const activeModel = config.configs[config.activeProvider]?.model as string || ""
    if(!activeModel){
      return EMPTY_PROVIDER
    }

    const verifiedModel = verifiedStatus?.[getVerifyKeyFromModelConfig(config.configs[config.activeProvider]!)]
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
    const verifiedConfig = allVerifiedList[getVerifyKeyFromModelConfig(activeConfig!)]
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

export const writeRawConfigAtom = atom(
  null,
  async (get, set, rawConfig: RawModelConfig) => {
    try {
      const response = await fetch("/api/config/model/replaceAll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(rawConfig),
      })

      const data = await response.json()
      if (data.success) {
        set(configAtom, rawConfig)
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
  (get, set, params: { value: boolean }) => {
    const { value } = params
    set(configAtom, {
      ...get(configAtom),
      disableDiveSystemPrompt: value
    })

    set(modelSettingsAtom, {
      ...get(modelSettingsAtom),
      disableDiveSystemPrompt: value
    })

    set(writeRawConfigAtom, {
      configs: get(configDictAtom),
      activeProvider: get(activeProviderAtom),
      disableDiveSystemPrompt: value
    })
  }
)

export async function verifyModelWithConfig(config: ModelConfig, signal?: AbortSignal) {
  return await fetch("/model_verify", {
    signal,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      modelSettings: config
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

export const removeOapConfigAtom = atom(
  null,
  async (get, set) => {
    const activeConfig = get(activeConfigAtom)
    const settings = get(modelSettingsAtom)

    set(modelSettingsAtom, {
      ...settings,
      groups: reverseQueryGroup({modelProvider: "oap"}, settings.groups)
    })

    if (activeConfig?.modelProvider === "oap" && settings.groups.length === 1) {
      set(writeEmptyConfigAtom)
    }
  }
)

export const writeOapConfigAtom = atom(
  null,
  async (get, set, enableGroup: boolean = true, enableRef: string[] = []) => {
    const isLoggedInOAP = get(isLoggedInOAPAtom)
    const config = get(configAtom)
    const settings = get(modelSettingsAtom)
    const OAPLevel = get(OAPLevelAtom)
    // there is no base model in oap anymore
    if (!isLoggedInOAP || OAPLevel === "BASE") {
      return
    }

    const token = await oapGetToken()
    const models = await fetchModels("openai_compatible", token, `${OAP_PROXY_URL}/v1`)
    if (models.error) {
      return
    }

    settings.groups = reverseQueryGroup({modelProvider: "oap"}, settings.groups)
    const newModelSettings: ModelGroupSetting = {
      ...settings,
      groups: [
        ...settings.groups,
        {
          ...defaultModelGroup(),
          modelProvider: "oap",
          apiKey: token,
          baseURL: `${OAP_PROXY_URL}/v1`,
          active: enableGroup,
          models: models.results.map(model => ({
            ...defaultBaseModel(),
            model: model,
            active: enableGroup && enableRef.length === 0 ? true : enableRef.includes(model),
            verifyStatus: "success" as ModelVerifyStatus,
            enableTools: true,
            isCustomModel: false,
          }))
        }
      ]
    }
    set(modelSettingsAtom, newModelSettings)

    const modelVerifyList = get(modelVerifyListAtom)
    set(modelVerifyListAtom, {
      ...modelVerifyList,
      [token]: {
        ...modelVerifyList[token],
        ...models.results.reduce((acc, model) => ({
          ...acc,
          [model]: {
            "success": true,
            "connecting": {
              "success": true,
              "final_state": "SUCCESS",
              "error_msg": ""
            },
            "supportTools": {
              "success": true,
              "final_state": "SUCCESS",
              "error_msg": ""
            },
            "supportToolsInPrompt": {
              "success": true,
              "final_state": "SUCCESS",
              "error_msg": ""
            }
          }
        }), {})
      }
    })

    if(localStorage.getItem("selectedModel")) {
      const selectedModel = JSON.parse(localStorage.getItem("selectedModel")!)
      if(selectedModel.group.modelProvider === "oap") {
        set(writeRawConfigAtom, intoRawModelConfig(settings, selectedModel.group, selectedModel.model)!)
        return
      }
    }

    if (config.activeProvider === EMPTY_PROVIDER) {
      set(writeRawConfigAtom, intoRawModelConfigWithQuery(newModelSettings, {modelProvider: "oap"}, {model: models.results[0]})!)
    }
  }
)

export const reloadOapConfigAtom = atom(
  null,
  async (get, set) => {
    const settings = get(modelSettingsAtom)
    const group = settings.groups.find(group => group.modelProvider === "oap")
    if(!group) {
      return
    }

    const models = group.models
      .filter(model => model.active)
      .map(model => model.model)

    return set(writeOapConfigAtom, group.active, models)
  }
)
