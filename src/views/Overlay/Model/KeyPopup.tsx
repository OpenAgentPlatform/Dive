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
import Tooltip from "../../../components/Tooltip"

const KeyPopup = ({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: (customModelId?: string) => void
}) => {
  const { t } = useTranslation()
  const [provider, setProvider] = useState<InterfaceProvider>(PROVIDERS[0])
  const [fields, setFields] = useState<Record<string, FieldDefinition>>(defaultInterface[provider])

  const [formData, setFormData] = useState<InterfaceModelConfig>({active: true} as InterfaceModelConfig)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [customModelId, setCustomModelId] = useState<string>("")
  const [verifyError, setVerifyError] = useState<string>("")
  const isVerifying = useRef(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [, showToast] = useAtom(showToastAtom)
  const [showOptional, setShowOptional] = useState<Record<string, Record<string, boolean>>>({})

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
    setVerifyError("")
  }

  const handleChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    Object.entries(fields).forEach(([key, field]) => {
      if (field.required && !formData[key as keyof InterfaceModelConfig] && key !== "customModelId") {
        newErrors[key] = t("setup.required")
      }
    })

    if(fields["customModelId"]?.required && !customModelId) {
      newErrors["customModelId"] = t("setup.required")
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return false
    }
    return true
  }

  const handleSubmit = async (data: Record<string, any>) => {
    try {
      if (data.success) {
        onSuccess(customModelId)
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
      baseURL: (!fields?.baseURL?.required && !showOptional[provider]?.["baseURL"]) ? "" : formData.baseURL
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
      setVerifyError("")
      setIsSubmitting(true)
      isVerifying.current = true

      let newCustomModelId = customModelId
      if(!fields["customModelId"]?.required && !showOptional[provider]?.["customModelId"]) {
        newCustomModelId = ""
        setCustomModelId(newCustomModelId)
      }

      //if custom model id is required, still need to check if the key is valid
      if(!newCustomModelId || fields["customModelId"]?.required) {
        const listOptions = await fetchListOptions(multiModelConfig, fields)

        //if custom model id is required, it doesn't need to check if listOptions is empty
        //because fetchListOptions in pre step will throw error if the key is invalid
        if (!listOptions?.length && !fields["customModelId"]?.required){
          const newErrors: Record<string, string> = {}
          newErrors["apiKey"] = t("models.apiKeyError")
          setErrors(newErrors)
          return
        }
      }

      if(newCustomModelId) {
        // save custom model list to local storage
        const customModelList = localStorage.getItem("customModelList")
        const allCustomModelList = customModelList ? JSON.parse(customModelList) : {}
        localStorage.setItem("customModelList", JSON.stringify({
          ...allCustomModelList,
          [formData.accessKeyId || _formData.apiKey || _formData.baseURL]: [newCustomModelId]
        }))
      }

      setMultiModelConfigList([...(multiModelConfigList ?? []), multiModelConfig])
      setCurrentIndex((multiModelConfigList?.length ?? 0))
      const data = await saveConfig()
      await handleSubmit(data)
    } catch (error) {
      setVerifyError((error as Error).message)
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

  const handleCopiedError = async (text: string) => {
    await navigator.clipboard.writeText(text)
    showToast({
      message: t("toast.copiedToClipboard"),
      type: "success"
    })
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
          key !== "model" && key !== "customModelId" && (
            <div key={key} className="models-key-form-group">
              <label className="models-key-field-title">
                <>
                  {(key === "baseURL" && !field.required) ?
                    <div className="models-key-field-optional">
                      <CheckBox
                        checked={showOptional[provider]?.[key]}
                        onChange={() => setShowOptional(prev => ({ ...prev, [provider]: { ...prev[provider], [key]: !prev[provider]?.[key] } }))}
                      ></CheckBox>
                      {`${field.label}${t("models.optional")}`}
                    </div>
                  : field.label}
                  {field.required && <span className="required">*</span>}
                </>
                <div className="models-key-field-description">{field.description}</div>
              </label>
              {(showOptional[provider]?.[key] || key !== "baseURL" || field.required) && (
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
            {!fields["customModelId"]?.required ? (
              <>
                <div className="models-key-field-optional">
                  <CheckBox
                    checked={showOptional[provider]?.["customModelId"]}
                    onChange={() =>
                      setShowOptional(prev => ({
                        ...prev,
                        [provider]: { ...prev[provider], customModelId: !prev[provider]?.customModelId },
                      }))
                    }
                  ></CheckBox>
                  {`Custom Model ID${t("models.optional")}`}
                </div>
              </>
            ) : (
              <>
                {`Custom Model ID`}<span className="required">*</span>
              </>
            )}
          </label>
          {(showOptional[provider]?.["customModelId"] || fields["customModelId"]?.required) && (
            <input
              type={"text"}
              value={customModelId as string || ""}
              onChange={e => setCustomModelId(e.target.value)}
              placeholder={"YOUR_MODEL_ID"}
              className={errors["customModelId"] ? "error" : ""}
            />
          )}
          {errors["customModelId"] && <div className="error-message">{errors["customModelId"]}</div>}
        </div>
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
      </div>
    </PopupConfirm>
  )
}

export default React.memo(KeyPopup)