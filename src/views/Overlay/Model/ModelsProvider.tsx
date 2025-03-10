import { ReactNode, createContext, useCallback, useContext, useEffect, useState } from "react";
import { activeProviderAtom, compressData, configAtom, configListAtom, extractData, loadConfigAtom, ModelConfig, MultiModelConfig, saveAllConfigAtom } from "../../../atoms/configState";
import { useAtomValue, useSetAtom } from "jotai";
import { FieldDefinition, ModelProvider } from "../../../atoms/interfaceState";
import { ignoreFieldsForModel } from "../../../constants";

export type ListOption = {
  name: string
  checked: boolean
  supportTools?: boolean
}

type ContextType = {
  multiModelConfigList?: MultiModelConfig[]
  setMultiModelConfigList: (multiModelConfigList: MultiModelConfig[]) => void
  parameter: Record<string, number>
  setParameter: (parameter: Record<string, number>) => void
  currentIndex: number
  setCurrentIndex: (currentIndex: number) => void
  listOptions: ListOption[]
  setListOptions: (listOptions: ListOption[]) => void
  fetchListOptions: (multiModelConfig: MultiModelConfig, fields: Record<string, FieldDefinition>) => Promise<ListOption[]>
  prepareModelConfig: (config: ModelConfig, provider: ModelProvider) => ModelConfig
  verifyModel: (multiModelConfig: MultiModelConfig, model: string) => Promise<{ success: boolean, supportTools?: boolean }>
  saveConfig: (activeProvider?: ModelProvider) => Promise<{ success: boolean, error?: string }>
}

const context = createContext<ContextType>({} as ContextType)

export default function ModelsProvider({
  children,
}:{
  children: ReactNode
}) {
  const configList = useAtomValue(configListAtom)
  const config = useAtomValue(configAtom)
  const loadConfig = useSetAtom(loadConfigAtom)
  const saveAllConfig = useSetAtom(saveAllConfigAtom)
  const activeProvider = useAtomValue(activeProviderAtom)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [listOptions, setListOptions] = useState<ListOption[]>([])
  const [multiModelConfigList, setMultiModelConfigList] = useState<MultiModelConfig[]>([])
  const [parameter, setParameter] = useState<Record<string, number>>(JSON.parse(localStorage.getItem("ConfigParameter") || "{}"))
  const getMultiModelConfigList = () => {
    return new Promise((resolve, reject) => {
      setMultiModelConfigList(prev => {
        resolve(prev)
        return prev
      })
    }) as Promise<MultiModelConfig[]>
  }
  const getParameter = () => {
    return new Promise((resolve, reject) => {
      setParameter(prev => {
        resolve(prev)
        return prev
      })
    }) as Promise<Record<string, number>>
  }

  useEffect(() => {
    const fetchData = async () => {
      const data = await loadConfig()
      if (!data || Object.keys(data.configs).length === 0) {
        const _parameter = localStorage.getItem("ConfigParameter")
        if(_parameter){
          setParameter(JSON.parse(_parameter))
        }
        return
      }
      let providerConfigList: MultiModelConfig[] = []
      providerConfigList = extractData(data.configs)
      setMultiModelConfigList(providerConfigList)
      if(providerConfigList){
        const _topP = providerConfigList.find(config => config.topP)
        const _temperature = providerConfigList.find(config => config.temperature)
        setParameter({
          topP: _topP?.topP ?? 0,
          temperature: _temperature?.temperature ?? 0
        })
      } else {
        const parameter = localStorage.getItem("ConfigParameter")
        if(parameter){
          setParameter(JSON.parse(parameter))
        }
        return
      }
    }
    fetchData()
  }, [config?.activeProvider])

  useEffect(() => {
    if(multiModelConfigList && multiModelConfigList?.length > 0){
      localStorage.removeItem("ConfigParameter")
    }
  }, [multiModelConfigList])

  const prepareModelConfig = useCallback((config: ModelConfig, provider: ModelProvider) => {
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
        [key]: _config[key as keyof ModelConfig]
      }
    }, {} as ModelConfig)
  }, [])

  const fetchListOptions = async (multiModelConfig: MultiModelConfig, fields: Record<string, FieldDefinition>) => {
    let options: string[] = []
    for (const [key, field] of Object.entries(fields)) {
      if (field.type === "list" && field.listCallback && field.listDependencies) {
        const deps = field.listDependencies.reduce((acc, dep) => ({
          ...acc,
          [dep]: multiModelConfig[dep as keyof MultiModelConfig] || ""
        }), {})

        options = await field.listCallback!(deps)
      }
    }

    const newListOptions: ListOption[] = []
    options.forEach((option: string) => {
      newListOptions.push({
        name: option,
        checked: multiModelConfig.models.includes(option)
      })
    })
    return newListOptions
  }

  const verifyModel = async (multiModelConfig: MultiModelConfig, model: string) => {
    try {
      const modelProvider = multiModelConfig.name.startsWith("openai") ? "openai" : multiModelConfig.name
      const formData = {
        apiKey: multiModelConfig.apiKey,
        baseURL: multiModelConfig.baseURL,
        model: model,
        modelProvider: multiModelConfig.name,
        configuration: {},
        active: multiModelConfig.active,
        topP: multiModelConfig.topP,
        temperature: multiModelConfig.temperature
      } as ModelConfig

      const configuration = {...formData} as ModelConfig
      delete (configuration as any).configuration

      const _formData = prepareModelConfig(formData, multiModelConfig.name)

      const response = await fetch("/api/modelVerify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: multiModelConfig.name,
          modelSettings: {
            ..._formData,
            modelProvider,
            configuration,
          },
        }),
      })

      const data = await response.json()
      return data
    } catch (error) {
      console.error("Failed to verify model:", error)
      return false
    }
  }

  const saveConfig = async (newActiveProvider?: ModelProvider) => {
    let compressedData: Record<string, ModelConfig> = {}
    const _multiModelConfigList = await getMultiModelConfigList()
    const _parameter = await getParameter()
    _multiModelConfigList.forEach((multiModelConfig, index) => {
      multiModelConfig = Object.assign(multiModelConfig, _parameter)
      compressedData = Object.assign(compressedData, compressData(multiModelConfig, index))
    })
    Object.entries(compressedData).forEach(([key, value]) => {
      if (value !== undefined) {
        compressedData[key] = prepareModelConfig(value, value.modelProvider)
      }
    })

    let _activeProvider: ModelProvider | "" = newActiveProvider ?? config?.activeProvider ?? ""
    const model = configList?.[_activeProvider]?.model
    const existModel = Object.keys(compressedData).find(key => compressedData[key].active && compressedData[key].model === model) as ModelProvider
    const activeModel = Object.keys(compressedData).filter(key => compressedData[key].active)
    _activeProvider = existModel ?? "none"
    _activeProvider = activeModel?.length == 1 ? activeModel[0] as ModelProvider : _activeProvider

    if(!_multiModelConfigList?.length){
      const _parameter = await getParameter()
      localStorage.setItem("ConfigParameter", JSON.stringify(_parameter))
    }

    const data = await saveAllConfig({ providerConfigs: compressedData, activeProvider: _activeProvider as ModelProvider })
    return data
  }

  return (
    <context.Provider value={{
      multiModelConfigList,
      setMultiModelConfigList,
      parameter,
      setParameter,
      currentIndex,
      setCurrentIndex,
      listOptions,
      setListOptions,
      fetchListOptions,
      prepareModelConfig,
      verifyModel,
      saveConfig
    }}>
      {children}
    </context.Provider>
  )
}

export function useModelsProvider() {
  return useContext(context)
}