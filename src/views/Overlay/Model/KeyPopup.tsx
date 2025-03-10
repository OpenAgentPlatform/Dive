import { useTranslation } from "react-i18next"
import { formatData, ModelConfig } from "../../../atoms/configState"
import { defaultInterface, FieldDefinition, ModelProvider, PROVIDER_LABELS } from "../../../atoms/interfaceState"
import PopupConfirm from "../../../components/PopupConfirm"
import { useEffect, useRef, useState } from "react"
import { showToastAtom } from "../../../atoms/toastState"
import { useAtom } from "jotai"
import React from "react"
import { useModelsProvider } from "./ModelsProvider"

const KeyPopup = ({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) => {
  const { t } = useTranslation()
  const PROVIDERS: ModelProvider[] = ["openai", "openai_compatible", "ollama", "anthropic"]
  const [provider, setProvider] = useState(PROVIDERS[0])
  const [fields, setFields] = useState<Record<string, FieldDefinition>>(defaultInterface[provider])

  const [formData, setFormData] = useState<ModelConfig>({active: true} as ModelConfig)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [verifiedCnt, setVerifiedCnt] = useState(0)
  const isVerifying = useRef(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [, showToast] = useAtom(showToastAtom)

  const { multiModelConfigList, setMultiModelConfigList,
    saveConfig, prepareModelConfig,
    fetchListOptions, setListOptions,
    setCurrentIndex, verifyModel
  } = useModelsProvider()

  useEffect(() => {
    return () => {
      isVerifying.current = false
    }
  }, [])

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value as ModelProvider
    setProvider(newProvider)
    setFormData({active: true} as ModelConfig)
    setFields(defaultInterface[newProvider])
  }

  const handleChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }))
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

  const handleSubmit = async (data: Record<string, any>) => {
    try {
      if (data.success) {
        onSuccess()
      }
    } catch (error) {
      console.error("Failed to save config:", error)
      showToast({
        message: t("setup.saveFailed"),
        type: "error"
      })
    }
  }

  const onConfirm = async () => {
    if (!validateForm())
      return

    const _formData = prepareModelConfig(formData, provider)
    const multiModelConfig = {
      ...formatData(_formData),
      name: provider,
    }

    const _multiModelConfigList = JSON.parse(JSON.stringify(multiModelConfigList))

    try {
      setErrors({})
      setIsSubmitting(true)
      setVerifiedCnt(0)
      isVerifying.current = true

      const listOptions = await fetchListOptions(multiModelConfig, fields)

      if (!listOptions?.length){
        const newErrors: Record<string, string> = {}
        newErrors["apiKey"] = t("models.apiKeyError")
        setErrors(newErrors)
        return
      }
      const verifiedList = []
      for(const index in listOptions){
        const verifyResult = await verifyModel(multiModelConfig, listOptions[index].name)
        if(!isVerifying.current)
          return
        if(verifyResult && verifyResult.success){
          const options = JSON.parse(JSON.stringify(listOptions))
          options[index].supportTools = verifyResult.supportTools
          verifiedList.push(options[index])
        }
        setVerifiedCnt((Number(index)+1) / listOptions.length)
      }
      sessionStorage.setItem(`model-list-${multiModelConfig.apiKey || multiModelConfig.baseURL}`, JSON.stringify(verifiedList))
      setListOptions(verifiedList)
      setMultiModelConfigList([...(multiModelConfigList ?? []), multiModelConfig])
      setCurrentIndex((multiModelConfigList?.length ?? 0))
      const data = await saveConfig()
      await handleSubmit(data)
    } catch (error) {
      const newErrors: Record<string, string> = {}
      newErrors["apiKey"] = t("models.apiKeyError")
      setErrors(newErrors)
      setMultiModelConfigList(_multiModelConfigList)
    } finally {
      setIsSubmitting(false)
      setVerifiedCnt(0)
      isVerifying.current = false
    }
  }

  const handleClose = () => {
    if(isVerifying.current){
      showToast({
        message: t("models.verifyingAbort"),
        type: "error"
      })
    }
    onClose()
  }

  return (
    <PopupConfirm
      noBorder={true}
      zIndex={900}
      footerType="center"
      onConfirm={onConfirm}
      confirmText={(isVerifying.current || isSubmitting) ? (
        <div className="loading-spinner"></div>
      ) : t("tools.save")}
      disabled={isVerifying.current || isSubmitting}
      onCancel={handleClose}
      onClickOutside={handleClose}
    >
      <div className="models-key-popup">
        <div className="models-key-form-group">
          <div className="models-key-field-title">
            API Provider
          </div>
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
          key !== "model" && (
            <div key={key} className="models-key-form-group">
              <label className="models-key-field-title">
                <>
                  {field.label}
                  {field.required && <span className="required">*</span>}
                </>
                <div className="models-key-field-description">{field.description}</div>
              </label>
              <input
                type={"text"}
                value={formData[key as keyof ModelConfig] as string || ""}
                onChange={e => handleChange(key, e.target.value)}
                placeholder={field.placeholder?.toString()}
                className={errors[key] ? "error" : ""}
              />
              {errors[key] && <div className="error-message">{errors[key]}</div>}
            </div>
          )
        ))}
        {isVerifying.current && (
          <div className="models-key-progress-wrapper">
            {t("models.verifying")}
            <div className="models-key-progress-container">
              <div
                className="models-key-progress"
                style={{
                  width: `${verifiedCnt * 100}%`
                }}
              />
            </div>
          </div>
        )}
      </div>
    </PopupConfirm>
  )
}

export default React.memo(KeyPopup)