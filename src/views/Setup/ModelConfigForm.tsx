import React, { useState, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { FieldDefinition, PROVIDER_LABELS, PROVIDERS } from "../../atoms/interfaceState"
import { ModelConfig, verifyModelWithConfig, writeEmptyConfigAtom, writeRawConfigAtom } from "../../atoms/configState"
import { useSetAtom } from "jotai"
import { loadConfigAtom } from "../../atoms/configState"
import useDebounce from "../../hooks/useDebounce"
import { showToastAtom } from "../../atoms/toastState"
import Input from "../../components/WrappedInput"
import Tooltip from "../../components/Tooltip"
import SelectSearch from "../../components/SelectSearch"
import { getVerifyStatus } from "../../views/Overlay/Model/ModelVerify"
import { useNavigate } from "react-router-dom"
import { ModelProvider } from "../../../types/model"
import { defaultBaseModel, fieldsToLLMGroup, intoModelConfig } from "../../helper/model"
import { modelSettingsAtom } from "../../atoms/modelState"
import Button from "../../components/Button"

interface ModelConfigFormProps {
  provider: ModelProvider
  fields: Record<string, FieldDefinition>
  onProviderChange?: (provider: ModelProvider) => void
  onSubmit: (data: any) => void
  submitLabel?: string
}

const ModelConfigForm: React.FC<ModelConfigFormProps> = ({
  provider,
  fields,
  onProviderChange,
  onSubmit,
  submitLabel = "setup.submit",
}) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [verifyError, setVerifyError] = useState<string>("")
  const [isVerifying, setIsVerifying] = useState(false)
  const [isVerifyingNoTool, setIsVerifyingNoTool] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [listOptions, setListOptions] = useState<Record<string, string[]>>({} as Record<string, string[]>)
  const initProvider = useRef(provider)
  const loadConfig = useSetAtom(loadConfigAtom)
  const saveConfig = useSetAtom(writeRawConfigAtom)
  const writeEmptyConfig = useSetAtom(writeEmptyConfigAtom)
  const showToast = useSetAtom(showToastAtom)
  const setSettings = useSetAtom(modelSettingsAtom)

  const [fetchListOptions, cancelFetch] = useDebounce(async (key: string, field: FieldDefinition, deps: Record<string, string>) => {
    try {
      setVerifyError("")
      const options = await field.listCallback!(deps)
      setListOptions(prev => ({
        ...prev,
        [key]: options
      }))

      if (options.length > 0 && !options.includes(formData[key as keyof ModelConfig] as string)) {
        handleChange(key, options[0])
      }
    } catch (error) {
      setVerifyError((error as Error).message)
    }
  }, 100)

  useEffect(() => {
    if (initProvider.current !== provider) {
      setListOptions({})
      setFormData(getFieldDefaultValue())
    }
  }, [provider])

  useEffect(() => {
    Object.entries(fields).forEach(([key, field]) => {
      if (field.type === "list" && field.listCallback && field.listDependencies) {
        const deps = field.listDependencies.reduce((acc, dep) => ({
          ...acc,
          [dep]: formData[dep] || ""
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
    }, {})
  }

  const handleProviderChange = (value: unknown) => {
    const newProvider = value as ModelProvider
    onProviderChange?.(newProvider)
    setIsVerified(false)
  }

  const getLLMGroupAndModel = () => {
    const group = fieldsToLLMGroup(provider, formData)
    const model = defaultBaseModel()
    model.model = formData.model
    return { group, model }
  }

  const verifyModel = async () => {
    try {
      setIsVerifying(true)
      const { group, model } = getLLMGroupAndModel()
      const data = await verifyModelWithConfig(intoModelConfig(group, model))
      if (data.success) {
        setIsVerified(true)
        const status = getVerifyStatus(data)
        if(status === "success" || status === "successInPrompt") {
          setIsVerifyingNoTool(false)
          showToast({
            message: t("setup.verifySuccess"),
            type: "success",
            duration: 5000
          })
        }else if(status === "unSupportTool"){
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

    setIsSubmitting(true)

    const { group, model } = getLLMGroupAndModel()
    group.models = [model]
    setSettings(prev => ({
      ...prev,
      disableDiveSystemPrompt: false,
      enableTools: true,
      groups: [group]
    }))
    onSubmit(await saveConfig({
      activeProvider: "act",
      disableDiveSystemPrompt: false,
      enableTools: true,
      configs: {
        act: intoModelConfig(group, model)
      },
    }).catch(() => ({ success: false })))
    loadConfig().catch(console.error)
    setIsSubmitting(false)
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

  const handleSkip = () => {
    writeEmptyConfig()
    navigate("/")
  }

  const handleCopiedError = async (text: string) => {
    await navigator.clipboard.writeText(text)
    showToast({
      message: t("toast.copiedToClipboard"),
      type: "success"
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label>{t("setup.provider")}</label>
        <SelectSearch
          fullWidth
          options={PROVIDERS.map(p => ({ value: p, label: PROVIDER_LABELS[p] }))}
          value={provider}
          onSelect={handleProviderChange as (value: unknown) => void}
          noResultText={t("tools.noProviderSearchResult")}
          className="provider-select"
          contentClassName="provider-select-content"
          placeholder="Select Provider"
          searchPlaceholder={t("tools.providerSearchPlaceholder")}
          searchCaseSensitive="weak"
        />
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

        {verifyError && (
          <Tooltip content={t("models.copyContent")}>
            <div onClick={() => handleCopiedError(verifyError)} className="error-message">
              {verifyError}
              <svg xmlns="http://www.w3.org/2000/svg" width="18px" height="18px" viewBox="0 0 22 22" fill="transparent">
                <path d="M13 20H2V6H10.2498L13 8.80032V20Z" fill="transparent" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinejoin="round"/>
                <path d="M13 9H10V6L13 9Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 3.5V2H17.2498L20 4.80032V16H16" fill="transparent" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinejoin="round"/>
                <path d="M20 5H17V2L20 5Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </Tooltip>
        )}

      <div className="form-actions">
        <Button
          theme="Color"
          color="success"
          size="medium"
          onClick={verifyModel}
          disabled={isSubmitting}
          loading={isVerifying}
        >
          {t("setup.verify")}
        </Button>
        <Button
          type="submit"
          theme="Color"
          color="primary"
          size="medium"
          disabled={isVerifying || !isVerified}
          loading={isSubmitting}
        >
          {t(submitLabel)}
        </Button>
      </div>

      <div className="form-actions">
        <div className="skip-btn" onClick={handleSkip}>Skip</div>
      </div>

    </form>
  )
}

export default React.memo(ModelConfigForm)