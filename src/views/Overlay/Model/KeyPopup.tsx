import { useTranslation } from "react-i18next"
import { InterfaceModelConfig, ModelConfig } from "../../../atoms/configState"
import { defaultInterface, FieldDefinition, InterfaceProvider, PROVIDER_LABELS, PROVIDERS } from "../../../atoms/interfaceState"
import PopupConfirm from "../../../components/PopupConfirm"
import { useEffect, useRef, useState } from "react"
import { showToastAtom } from "../../../atoms/toastState"
import { useAtom } from "jotai"
import React from "react"
import { useModelsProvider } from "./ModelsProvider"
import { formatData } from "../../../helper/config"
import CheckBox from "../../../components/CheckBox"

const KeyPopup = ({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: (customModelID?: string) => void
}) => {
  const { t } = useTranslation()
  const [provider, setProvider] = useState<InterfaceProvider>(PROVIDERS[0])
  const [fields, setFields] = useState<Record<string, FieldDefinition>>(defaultInterface[provider])

  const [formData, setFormData] = useState<InterfaceModelConfig>({active: true} as InterfaceModelConfig)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [customModelID, setCustomModelID] = useState<string>("")
  const isVerifying = useRef(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [, showToast] = useAtom(showToastAtom)
  const [showOptional, setShowOptional] = useState<Record<string, boolean>>({})

  const { multiModelConfigList, setMultiModelConfigList,
    saveConfig, prepareModelConfig,
    fetchListOptions, setCurrentIndex
  } = useModelsProvider()

  useEffect(() => {
    return () => {
      isVerifying.current = false
    }
  }, [])

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value as InterfaceProvider
    setProvider(newProvider)
    setFormData({active: true} as InterfaceModelConfig)
    setFields(defaultInterface[newProvider])
    setErrors({})
  }

  const handleChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    Object.entries(fields).forEach(([key, field]) => {
      if (field.required && !formData[key as keyof InterfaceModelConfig]) {
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
        onSuccess(customModelID)
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

    const __formData = {
      ...formData,
      baseURL: (!fields?.baseURL?.required && !showOptional[provider]) ? "" : formData.baseURL,
    }

    let existingIndex = -1
    if(multiModelConfigList && multiModelConfigList.length > 0){
      if (__formData.baseURL) {
        if (__formData.apiKey) {
          existingIndex = multiModelConfigList.findIndex(config =>
            config.baseURL === __formData.baseURL &&
            config.apiKey === __formData.apiKey
          )
        } else {
          existingIndex = multiModelConfigList.findIndex(config =>
            config.baseURL === __formData.baseURL
          )
        }
      } else if (__formData.apiKey) {
        existingIndex = multiModelConfigList.findIndex(config =>
          config.apiKey === __formData.apiKey
        )
      }
    }

    if(existingIndex !== -1){
      setCurrentIndex(existingIndex)
      onSuccess()
      return
    }

    const _formData = prepareModelConfig(__formData, provider)
    const multiModelConfig = {
      ...formatData(_formData),
      name: provider,
    }

    const _multiModelConfigList = JSON.parse(JSON.stringify(multiModelConfigList))

    try {
      setErrors({})
      setIsSubmitting(true)
      isVerifying.current = true

      if(!customModelID) {
        const listOptions = await fetchListOptions(multiModelConfig, fields)

        if (!listOptions?.length){
          const newErrors: Record<string, string> = {}
          newErrors["apiKey"] = t("models.apiKeyError")
          setErrors(newErrors)
          return
        }
      } else {
        // save custom model list to local storage
        const customModelList = localStorage.getItem("customModelList")
        const allCustomModelList = customModelList ? JSON.parse(customModelList) : {}
        localStorage.setItem("customModelList", JSON.stringify({
          ...allCustomModelList,
          [_formData.apiKey || _formData.baseURL]: [customModelID]
        }))
      }

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
                  {(key === "baseURL" && !field.required) ?
                    <div className="models-key-field-optional">
                      <CheckBox
                        checked={showOptional[provider]}
                        onChange={() => setShowOptional(prev => ({ ...prev, [provider]: !prev[provider] }))}
                      ></CheckBox>
                      {`${field.label}${t("models.optional")}`}
                    </div>
                  : field.label}
                  {field.required && <span className="required">*</span>}
                </>
                <div className="models-key-field-description">{field.description}</div>
              </label>
              {(showOptional[provider] || key !== "baseURL" || field.required) && (
                <input
                  type={"text"}
                  value={formData[key as keyof ModelConfig] as string || ""}
                  onChange={e => handleChange(key, e.target.value)}
                  placeholder={field.placeholder?.toString()}
                  className={errors[key] ? "error" : ""}
                />
              )}
              {errors[key] && <div className="error-message">{errors[key]}</div>}
            </div>
          )
        ))}
        <div className="models-key-form-group">
          <label className="models-key-field-title">
            <>
              {`Custom Model ID${t("models.optional")}`}
            </>
            <div className="models-key-field-description">Custom Model ID</div>
          </label>
          <input
            type={"text"}
            value={customModelID as string || ""}
            onChange={e => setCustomModelID(e.target.value)}
            placeholder={"YOUR_MODEL_ID"}
            className={errors["customModelID"] ? "error" : ""}
          />
          {errors["customModelID"] && <div className="error-message">{errors["customModelID"]}</div>}
        </div>
      </div>
    </PopupConfirm>
  )
}

export default React.memo(KeyPopup)