import React, { useState, useEffect, useRef, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { FieldDefinition, ModelProvider, PROVIDER_LABELS } from "../atoms/interfaceState"
import { configAtom, ModelConfig, saveConfigAtom } from "../atoms/configState"
import { ignoreFieldsForModel } from "../constants"
import { useAtom } from "jotai"
import { loadConfigAtom } from "../atoms/configState"
import useDebounce from "../hooks/useDebounce"
import CustomInstructions from "./CustomInstructions"
import InfoTooltip from "./InfoTooltip"
import { showToastAtom } from "../atoms/toastState"
import Input from "./WrappedInput"

const PROVIDERS: ModelProvider[] = ["openai", "openai_compatible", "ollama", "anthropic"]

interface ModelConfigFormProps {
  provider: ModelProvider
  fields: Record<string, FieldDefinition>
  initialData?: ModelConfig|null
  onProviderChange?: (provider: ModelProvider) => void
  onSubmit: (data: any) => void
  submitLabel?: string
  showVerify?: boolean
  showParameters?: boolean
}

const ModelConfigForm: React.FC<ModelConfigFormProps> = ({
  provider,
  fields,
  initialData,
  onProviderChange,
  onSubmit,
  submitLabel = "setup.submit",
  showVerify = true,
  showParameters = false,
}) => {
  const { t } = useTranslation()
  const [formData, setFormData] = useState<ModelConfig>(initialData || {} as ModelConfig)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isVerifying, setIsVerifying] = useState(false)
  const [isVerifyingNoTool, setIsVerifyingNoTool] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [listOptions, setListOptions] = useState<Record<string, string[]>>(initialData?.model ? { model: [initialData.model] } : {})
  const initProvider = useRef(provider)
  const [, loadConfig] = useAtom(loadConfigAtom)
  const [config] = useAtom(configAtom)
  const [, saveConfig] = useAtom(saveConfigAtom)
  const [, showToast] = useAtom(showToastAtom)

  const [fetchListOptions, cancelFetch] = useDebounce(async (key: string, field: FieldDefinition, deps: Record<string, string>) => {
    try {
      const options = await field.listCallback!(deps)
      setListOptions(prev => ({
        ...prev,
        [key]: options
      }))
      
      if (options.length > 0 && !options.includes(formData[key as keyof ModelConfig] as string)) {
        handleChange(key, options[0])
      }
    } catch (error) {
      showToast({
        message: t("setup.verifyError"),
        type: "error"
      })
    }
  }, 100)
  
  useEffect(() => {
    if (initProvider.current !== provider) {
      setListOptions({})
      setFormData(Object.assign(getFieldDefaultValue(), config?.configs[provider] || {} as ModelConfig))
    } else {
      setListOptions(initialData?.model ? { model: [initialData.model] } : {})
      setFormData(initialData || {} as ModelConfig)
    }
  }, [provider])

  useEffect(() => {
    Object.entries(fields).forEach(([key, field]) => {
      if (field.type === "list" && field.listCallback && field.listDependencies) {
        const deps = field.listDependencies.reduce((acc, dep) => ({
          ...acc,
          [dep]: formData[dep as keyof ModelConfig] || ""
        }), {})

        const allDepsHaveValue = field.listDependencies.every(dep => !!formData[dep as keyof ModelConfig])
        
        if (allDepsHaveValue) {
          fetchListOptions(key, field, deps)
        }
      }
    })

    return () => {
      cancelFetch()
    }
  }, [fields, formData])
  
  const getFieldDefaultValue = () => {
    return Object.keys(fields).reduce((acc, key) => {
      return {
        ...acc,
        [key]: fields[key].default
      }
    }, {} as ModelConfig)
  }

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value as ModelProvider
    onProviderChange?.(newProvider)
    setIsVerified(false)
  }
  
  const prepareModelConfig = useCallback((config: ModelConfig, provider: ModelProvider) => {
    const _config = {...config}
    if (provider === "openai" && initialData?.baseURL) {
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

  const verifyModel = async () => {
    try {
      setIsVerifying(true)
      const modelProvider = provider.startsWith("openai") ? "openai" : provider

      const configuration = {...formData} as Partial<Pick<ModelConfig, "configuration">> & Omit<ModelConfig, "configuration">
      delete configuration.configuration
      
      const _formData = prepareModelConfig(formData, provider)
      
      const response = await fetch("/api/modelVerify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider,
          modelSettings: {
            ..._formData,
            modelProvider,
            configuration,
          },
        }),
      })

      const data = await response.json()
      if (data.success) {
        setIsVerified(true)
        if(data.connectingSuccess && data.supportTools) {
          setIsVerifyingNoTool(false)
          showToast({
            message: t("setup.verifySuccess"),
            type: "success",
            duration: 5000
          })
        }else if(data.connectingSuccess || data.supportTools){
          setIsVerifyingNoTool(true)
          showToast({
            message: t("setup.verifySuccessNoTool"),
            type: "success",
            duration: 5000
          })
        }
      } else {
        setIsVerified(false)
        showToast({
          message: t("setup.verifyFailed"),
          type: "error",
          duration: 5000
        })
      }
    } catch (error) {
      console.error("Failed to verify model:", error)
      setIsVerified(false)
      showToast({
        message: t("setup.verifyError"),
        type: "error"
      })
    } finally {
      setIsVerifying(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm())
      return

    const _formData = prepareModelConfig(formData, provider)
    
    try {
      setIsSubmitting(true)
      const data = await saveConfig({ formData: _formData, provider })
      await onSubmit(data)
      loadConfig()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [key]: value
    }))
    setErrors(prev => ({
      ...prev,
      [key]: ""
    }))
    if(fields[key]?.required) {
      setIsVerified(false)
    }
  }
  
  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    Object.entries(fields).forEach(([key, field]) => {
      if (field.required && !formData[key as keyof ModelConfig]) {
        newErrors[key] = t("setup.required")
      }
    })

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return false
    }
    return true
  }

  const validateNumber = (value: number, min: number, max: number) => {
    return value > max ? max : value < min ? min : value
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label>{t("setup.provider")}</label>
        <select 
          value={provider} 
          onChange={handleProviderChange}
          className="provider-select"
        >
          {PROVIDERS.map(p => (
            <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
          ))}
        </select>
      </div>

      {Object.entries(fields).map(([key, field]) => (
        <div key={key} className="form-group">
          <label>
            {field.label}
            {field.required && <span className="required">*</span>}
          </label>
          <div className="field-description">{t(field.description)}</div>
          {field.type === "list" ? (
            <select
              value={formData[key as keyof ModelConfig] as string || ""}
              onChange={e => handleChange(key, e.target.value)}
              className={errors[key] ? "error" : ""}
            >
              <option value="">{field.placeholder}</option>
              {listOptions[key]?.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <Input
              type={"text"}
              value={formData[key as keyof ModelConfig] as string || ""}
              onChange={e => handleChange(key, e.target.value)}
              placeholder={field.placeholder?.toString()}
              className={errors[key] ? "error" : ""}
            />
          )}
          {key==="model" && isVerifyingNoTool && (
              <div className="field-model-description">
                {t("setup.verifySuccessNoTool")}
              </div>
          )}
          {errors[key] && <div className="error-message">{errors[key]}</div>}
        </div>
      ))}

      <div className="form-actions">
        {showVerify && (
          <button 
            type="button" 
            className="verify-btn"
            onClick={verifyModel}
            disabled={isVerifying || isSubmitting}
          >
            {isVerifying ? (
              <div className="loading-spinner"></div>
            ) : t("setup.verify")}
          </button>
        )}
        <button 
          type="submit" 
          className="submit-btn"
          disabled={isVerifying || isSubmitting || (showVerify && !isVerified)}
        >
          {isSubmitting ? (
            <div className="loading-spinner"></div>
          ) : t(submitLabel)}
        </button>
      </div>

      <div className="divider" />

      {showParameters && (
        <div className="form-group parameters">
          <label>{t("setup.parameters")}</label>
          <div className="parameters-container">
            <div className="parameters-grid">
                <InfoTooltip
                  maxWidth={270}
                  side="left"
                  content={t("setup.topPDescription")}
                >
                <div className="parameter-label">
                  <div>TOP-P</div>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 23 22" width="15" height="15">
                    <g clipPath="url(#ic_information_svg__a)">
                      <circle cx="11.5" cy="11" r="10.25" stroke="currentColor" strokeWidth="1.5"></circle>
                      <path fill="currentColor" d="M9.928 13.596h3.181c-.126-2.062 2.516-2.63 2.516-5.173 0-2.01-1.6-3.677-4.223-3.608-2.229.051-4.08 1.288-4.026 3.9h2.714c0-.824.593-1.168 1.222-1.185.593 0 1.258.326 1.222.962-.144 1.942-2.911 2.389-2.606 5.104Zm1.582 3.591c.988 0 1.779-.618 1.779-1.563 0-.963-.791-1.581-1.78-1.581-.97 0-1.76.618-1.76 1.58 0 .946.79 1.565 1.76 1.565Z"></path>
                    </g>
                    <defs>
                      <clipPath id="ic_information_svg__a">
                        <path fill="currentColor" d="M.5 0h22v22H.5z"></path>
                      </clipPath>
                    </defs>
                  </svg>
                </div>
              </InfoTooltip>
              <Input type="number" value={formData.topP ?? 0} min={0} max={1} step={0.1} onChange={e => handleChange("topP", validateNumber(parseFloat(e.target.value), 0, 1))} />
            </div>
            <div className="parameters-grid">
              <InfoTooltip
                maxWidth={270}
                side="left"
                content={t("setup.temperatureDescription")}
              >
                <div className="parameter-label">
                  <div>Temperature</div>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 23 22" width="15" height="15">
                    <g clipPath="url(#ic_information_svg__a)">
                      <circle cx="11.5" cy="11" r="10.25" stroke="currentColor" strokeWidth="1.5"></circle>
                      <path fill="currentColor" d="M9.928 13.596h3.181c-.126-2.062 2.516-2.63 2.516-5.173 0-2.01-1.6-3.677-4.223-3.608-2.229.051-4.08 1.288-4.026 3.9h2.714c0-.824.593-1.168 1.222-1.185.593 0 1.258.326 1.222.962-.144 1.942-2.911 2.389-2.606 5.104Zm1.582 3.591c.988 0 1.779-.618 1.779-1.563 0-.963-.791-1.581-1.78-1.581-.97 0-1.76.618-1.76 1.58 0 .946.79 1.565 1.76 1.565Z"></path>
                    </g>
                    <defs>
                      <clipPath id="ic_information_svg__a">
                        <path fill="currentColor" d="M.5 0h22v22H.5z"></path>
                      </clipPath>
                    </defs>
                  </svg>
                </div>
              </InfoTooltip>
              <Input type="number" value={formData.temperature ?? 0} min={0} max={1} step={0.1} onChange={e => handleChange("temperature", validateNumber(parseFloat(e.target.value), 0, 1))} />
            </div>
          </div>
        </div>
      )}

      <div className="divider" />

      {showParameters && (
        <CustomInstructions />
      )}
    </form>
  )
}

export default React.memo(ModelConfigForm) 