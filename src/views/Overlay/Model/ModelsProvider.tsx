import { ReactNode, createContext, useCallback, useContext, useRef } from "react"
import { BaseModel, LLMGroup, ModelProvider } from "../../../../types/model"
import { defaultBaseModel, defaultModelGroup, fieldsToLLMGroup, getGroupTerm, getModelTerm, GroupTerm, intoRawModelConfigWithQuery, queryGroup, reverseQueryGroup } from "../../../helper/model"
import { modelGroupsAtom, modelSettingsAtom } from "../../../atoms/modelState"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { fetchModels as _fetchModels } from "../../../ipc/llm"
import { getVerifyKey } from "../../../helper/verify"
import isMatch from "lodash/isMatch"
import { writeRawConfigAtom } from "../../../atoms/configState"

type ContextType = {
  buffer: { group: LLMGroup, models: BaseModel[] }
  getLatestBuffer: () => { group: LLMGroup, models: BaseModel[] }
  reset: () => void
  flush: () => Promise<void>
  verifyKey: () => string
  writeGroupBuffer: (group: LLMGroup) => void
  writeGroupBufferWithFields: (provider: ModelProvider, obj: Record<string, any>) => void
  writeModelsBuffer: (models: BaseModel[]) => void
  writeModelsBufferWithModelNames: (models: string[], customModels?: string[]) => void
  pushModelBufferWithModelNames: (models: string[], customModels?: string[]) => void
  setOriginalGroup: (group: LLMGroup) => void
  isGroupExist: (group: LLMGroup) => boolean
  groupToFields: (group: LLMGroup) => Record<string, any>
  fetchModels: () => Promise<BaseModel[]>
  modelToBaseModel: (modelName: string, isCustomModel: boolean) => BaseModel
}

const context = createContext<ContextType>({} as ContextType)

export default function ModelsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useAtom(modelSettingsAtom)
  const modelGroups = useAtomValue(modelGroupsAtom)
  const modelGroupBuffer = useRef<LLMGroup>(defaultModelGroup())
  const modelsBuffer = useRef<BaseModel[]>([])
  const originalGroupTermRef = useRef<GroupTerm | null>(null)
  const writeRawConfig = useSetAtom(writeRawConfigAtom)

  const getLatestBuffer = useCallback(() => {
    return {
      group: modelGroupBuffer.current,
      models: modelsBuffer.current,
    }
  }, [])

  const verifyKey = useCallback(() => {
    return getVerifyKey(modelGroupBuffer.current)
  }, [])

  const reset = useCallback(() => {
    modelGroupBuffer.current = defaultModelGroup()
    modelsBuffer.current = []
    originalGroupTermRef.current = null
  }, [])

  const setOriginalGroup = useCallback((group: LLMGroup) => {
    originalGroupTermRef.current = getGroupTerm(group)
  }, [])

  const groupToFields = useCallback((group: LLMGroup) => {
    switch(group.modelProvider){
      case "bedrock":
        return {
          ...group.extra.credentials,
          region: group.extra.region,
        }
      case "azure_openai":
        return {
          ...group.extra,
          apiKey: group.apiKey || "",
        }
      default:
        return {
          ...group.extra,
          apiKey: group.apiKey,
          baseURL: group.baseURL,
        }
    }
  }, [])

  const writeGroupBuffer = useCallback((group: LLMGroup) => {
    modelGroupBuffer.current = group
  }, [])

  const writeModelsBuffer = useCallback((models: BaseModel[]) => {
    modelsBuffer.current = models
  }, [])

  const writeGroupBufferWithFields = useCallback((provider: ModelProvider, obj: Record<string, any>) => {
    modelGroupBuffer.current = fieldsToLLMGroup(provider, obj)
  }, [])

  const modelToBaseModel = useCallback((modelName: string, isCustomModel: boolean = false) => {
    return {
      ...defaultBaseModel(),
      model: modelName,
      active: false,
      isCustomModel,
    }
  }, [])

  const writeModelsBufferWithModelNames = useCallback((models: string[], customModels: string[] = []) => {
    modelsBuffer.current = [
      ...customModels.map(m => modelToBaseModel(m, true)),
      ...models.map(m => modelToBaseModel(m)),
    ]
  }, [modelToBaseModel])

  const pushModelBufferWithModelNames = useCallback((models: string[], customModels: string[] = []) => {
    modelsBuffer.current = [
      ...customModels.map(m => modelToBaseModel(m, true)),
      ...modelsBuffer.current,
      ...models.map(m => modelToBaseModel(m)),
    ]
  }, [modelToBaseModel])

  const fetchModels = useCallback(async () => {
    const group = modelGroupBuffer.current
    let extra: string[] = []

    if (group.modelProvider === "bedrock") {
      extra = [group.extra.credentials.accessKeyId, group.extra.credentials.secretAccessKey, group.extra.credentials.sessionToken, group.extra.credentials.region]
    }

    if (group.modelProvider === "azure_openai") {
      extra = [group.extra.azureEndpoint, group.extra.azureDeployment, group.extra.apiVersion]
    }

    const result = await _fetchModels(group.modelProvider, group.apiKey || "", group.baseURL || "", extra).catch(() => ({ error: "fetch models failed" }))
    if (result.error || !("results" in result)) {
      return []
    }

    return result.results.map(m => modelToBaseModel(m, false))
  }, [modelToBaseModel])

  const getGroups = useCallback((group: LLMGroup) => {
    const term = getGroupTerm(group)
    return queryGroup(term, modelGroups)
  }, [modelGroups])

  const isGroupExist = useCallback((group: LLMGroup) => {
    return getGroups(group).length > 0
  }, [getGroups])

  const flush = useCallback(async () => {
    const { group, models } = getLatestBuffer()
    group.models = models

    const originalTerm = originalGroupTermRef.current
    const newTerm = getGroupTerm(group)

    // If editing an existing group and the term changed (e.g. API key),
    // remove the old group and insert the updated one.
    if (originalTerm && !isMatch(originalTerm, newTerm)) {
      setSettings(settings => {
        const oldGroup = queryGroup(originalTerm, settings.groups)[0]
        const filtered = reverseQueryGroup(originalTerm, settings.groups)
        return {
          ...settings,
          groups: [...filtered, { ...group, active: oldGroup?.active ?? true }],
        }
      })
    } else {
      const exitsGroups = getGroups(group)
      if (exitsGroups.length === 0) {
        setSettings(settings => {
          return {
            ...settings,
            groups: [...settings.groups, { ...group, active: true }],
          }
        })
      }

      setSettings(settings => {
        return {
          ...settings,
          groups: settings.groups.map(og => {
            return isMatch(getGroupTerm(og), newTerm) ? { ...group, active: og.active } : og
          }),
        }
      })
    }

    if (settings.groups.length === 0) {
      const rawConfig = intoRawModelConfigWithQuery(settings, newTerm, getModelTerm(group.models[0]))
      if (rawConfig) {
        writeRawConfig(rawConfig)
      }
    }

    reset()
  }, [getGroups, reset, setSettings, getLatestBuffer, settings, writeRawConfig])

  return (
    <context.Provider value={{
      buffer: getLatestBuffer(),
      getLatestBuffer,
      reset,
      flush,
      verifyKey,
      writeGroupBuffer,
      writeModelsBuffer,
      writeGroupBufferWithFields,
      writeModelsBufferWithModelNames,
      pushModelBufferWithModelNames,
      setOriginalGroup,
      isGroupExist,
      groupToFields,
      fetchModels,
      modelToBaseModel,
    }}>
      {children}
    </context.Provider>
  )
}

export function useModelsProvider() {
  return useContext(context)
}