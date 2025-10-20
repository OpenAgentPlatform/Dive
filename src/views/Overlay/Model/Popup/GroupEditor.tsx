import { useSetAtom } from "jotai"
import React, { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { ModelConfig } from "../../../../atoms/configState"
import { ModelProvider } from "../../../../../types/model"
import useModelInterface from "../../../../hooks/useModelInterface"
import { fieldsToLLMGroup } from "../../../../helper/model"
import { defaultInterface, FieldDefinition, PROVIDER_LABELS, PROVIDERS } from "../../../../atoms/interfaceState"
import { showToastAtom } from "../../../../atoms/toastState"
import { useModelsProvider } from "../ModelsProvider"
import PopupConfirm from "../../../../components/PopupConfirm"
import CheckBox from "../../../../components/CheckBox"
import { imgPrefix } from "../../../../ipc"
import Input from "../../../../components/Input"

type Props = {
  onClose: () => void
  onSuccess: (customModelID?: string) => void
}

const KeyPopupEdit = ({ onClose, onSuccess }: Props) => {
  const { t } = useTranslation()
  const [provider, setProvider] = useState<ModelProvider>(PROVIDERS[0])
  const [fields, setFields] = useState<Record<string, FieldDefinition>>(defaultInterface[provider])

  const [formData, setFormData] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [customModelID, setCustomModelID] = useState<string>("")
  const isVerifying = useRef(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showToast = useSetAtom(showToastAtom)
  const [showOptional, setShowOptional] = useState<Record<string, Record<string, boolean>>>({})
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)

  const { fetchListField } = useModelInterface()
  const { getLatestBuffer, groupToFields, writeGroupBuffer } = useModelsProvider()

  useEffect(() => {
    const group = getLatestBuffer().group
    const modelProvider = group.modelProvider
    setProvider(modelProvider)

    const fileds = defaultInterface[modelProvider]
    delete fileds.customModelId
    setFields(fileds)

    const formData = groupToFields(group)
    setFormData(formData)

    if (
      formData.baseURL &&
      defaultInterface[modelProvider]?.baseURL &&
      !defaultInterface[modelProvider].baseURL.required
    ) {
      setShowOptional((prev) => ({ ...prev, [modelProvider]: { ...showOptional[modelProvider], baseURL: true } }))
    }

    isVerifying.current = false
  }, [])

  const handleChange = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    Object.entries(fields).forEach(([key, field]) => {
      if (field.required && !formData[key]) {
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
        type: "error",
      })
    }
  }

  const onConfirm = async () => {
    if (!validateForm()) {
      return
    }

    const data = {
      ...formData,
      baseURL:
        !fields?.baseURL?.required && !showOptional[provider]?.baseURL
          ? ""
          : formData.baseURL,
    }

    const group = fieldsToLLMGroup(provider, data)

    try {
      setErrors({})
      setIsSubmitting(true)
      isVerifying.current = true

      // for both adding and editing, perform API key verification, but skip if editing and there is a custom model ID
      if (!customModelID && fields["model"]) {
        const listOptions = await fetchListField(fields["model"], formData).catch(e => {
          console.error(e)
          return []
        })

        if (!listOptions.length) {
          const newErrors: Record<string, string> = {}
          const keyFiled = group.modelProvider === "bedrock" ? "accessKeyId" : "apiKey"
          newErrors[keyFiled] = t("models.apiKeyError")
          setErrors(newErrors)
          return
        }
      }

      // save custom model list
      if (customModelID) {
        const customModelList = localStorage.getItem("customModelList")
        const allCustomModelList = customModelList ? JSON.parse(customModelList) : {}
        allCustomModelList[formData.apiKey || formData.baseURL || ""] = [...(allCustomModelList[formData.apiKey || formData.baseURL || ""] || []), customModelID]
        localStorage.setItem(
          "customModelList",
          JSON.stringify(allCustomModelList)
        )
      }

      writeGroupBuffer(group)
      await handleSubmit({ success: true })
    } catch (_error) {
      const newErrors: Record<string, string> = {}
      newErrors["apiKey"] = t("models.apiKeyError")
      setErrors(newErrors)
    } finally {
      setIsSubmitting(false)
      isVerifying.current = false
    }
  }

  const handleClose = () => {
    if (isVerifying.current) {
      showToast({
        message: t("models.verifyingAbort"),
        type: "error",
      })
    }
    onClose()
  }

  const toggleApiKeyVisibility = () => {
    setIsApiKeyVisible(!isApiKeyVisible)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true)
      showToast({
        message: t("toast.copiedToClipboard"),
        type: "success",
      })
      setTimeout(() => {
        setCopySuccess(false)
      }, 3000)
    })
  }

  return (
    <>
      <PopupConfirm
        noBorder={true}
        zIndex={900}
        footerType="center"
        onConfirm={onConfirm}
        confirmText={
          isVerifying.current || isSubmitting ? (
            <div className="loading-spinner"></div>
          ) : (
            t("tools.save")
          )
        }
        disabled={isVerifying.current || isSubmitting}
        onCancel={handleClose}
        onClickOutside={handleClose}
      >
        <div className="models-key-popup edit">
          <div className="models-key-form-group">
            <div className="title">
              {t("models.editProviderTitle", { provider: PROVIDER_LABELS[provider] })}
            </div>
          </div>
          {Object.entries(fields).map(
            ([key, field]) =>
              key !== "model" && key !== "skip_tls_verify" && (
                <div key={key} className="models-key-form-group">
                  <label className="models-key-field-title">
                    <>
                      {key === "baseURL" && !field.required ? (
                        <div className="models-key-field-optional">
                          <CheckBox
                            checked={showOptional[provider]?.baseURL}
                            onChange={() =>
                              setShowOptional((prev) => ({
                                ...prev,
                                [provider]: { ...prev[provider], baseURL: !prev[provider]?.baseURL },
                              }))
                            }
                          ></CheckBox>
                          {`${field.label}${t("models.optional")}`}
                        </div>
                      ) : (
                        field.label
                      )}
                      {field.required && key !== "model" && <span className="required">*</span>}
                    </>
                    <div className="models-key-field-description">
                      {field.description}
                    </div>
                  </label>
                  {(showOptional[provider]?.[key] ||
                    key !== "baseURL" ||
                    field.required) && (
                    <>
                      <div className="api-key-input-wrapper">
                        <Input
                          type={
                            key === "apiKey" && !isApiKeyVisible
                              ? "password"
                              : "text"
                          }
                          value={
                            (formData[key as keyof ModelConfig] as string) || ""
                          }
                          onChange={(e) => handleChange(key, e.target.value)}
                          placeholder={field.placeholder?.toString()}
                          error={errors[key] ? true : false}
                          information={errors[key]}
                          icon2={
                            key === "apiKey" && (
                              <button
                                type="button"
                                className="icon-button show-hide-button"
                                onClick={toggleApiKeyVisibility}
                                title={
                                  isApiKeyVisible
                                    ? t("models.hide")
                                    : t("models.display")
                                }
                              >
                                <img
                                  src={
                                    isApiKeyVisible
                                      ? `${imgPrefix}Hide.svg`
                                      : `${imgPrefix}Show.svg`
                                  }
                                  alt={
                                    isApiKeyVisible
                                      ? t("models.hide")
                                      : t("models.display")
                                  }
                                  width="20"
                                  height="20"
                                />
                              </button>
                            )
                          }
                          icon3={
                            key === "apiKey" && (
                              <button
                                type="button"
                                className="icon-button copy-button"
                                onClick={() =>
                                  copyToClipboard(formData.apiKey || "")
                                }
                                title={t("models.copy")}
                              >
                                {copySuccess ? (
                                  <svg
                                    className="correct-icon"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 22 22"
                                    width="20"
                                    height="20"
                                  >
                                    <path
                                      stroke="currentColor"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="3"
                                      d="m4.67 10.424 4.374 4.748 8.478-7.678"
                                    ></path>
                                  </svg>
                                ) : (
                                  <img
                                    src={`${imgPrefix}Copy.svg`}
                                    alt={t("models.copy")}
                                    width="20"
                                    height="20"
                                  />
                                )}
                              </button>
                            )
                          }
                        />
                      </div>
                    </>
                  )}
                </div>
              )
          )}
          <div className="models-key-form-group">
            <label className="models-key-field-title">
              <>
                <div className="models-key-field-optional">
                  <CheckBox
                    checked={showOptional[provider]?.customModelID}
                    onChange={() =>
                      setShowOptional((prev) => ({
                        ...prev,
                        [provider]: { ...prev[provider], customModelID: !prev[provider]?.customModelID },
                      }))
                    }
                  ></CheckBox>
                  <>{`Custom Model ID${t("models.optional")}`}</>
                </div>
              </>
            </label>
            {showOptional[provider]?.customModelID && (
              <Input
                type="text"
                value={customModelID}
                onChange={(e) => setCustomModelID(e.target.value)}
                placeholder={"YOUR_MODEL_ID"}
                error={errors["customModelID"] ? true : false}
              />
            )}
          </div>
          {fields["skip_tls_verify"] && (
            <div className="models-key-form-group">
              <label className="models-key-field-title">
                <div className="models-key-field-optional">
                  <CheckBox
                    checked={formData?.skip_tls_verify as boolean || false}
                    onChange={e => handleChange("skip_tls_verify", e.target.checked)}
                  ></CheckBox>
                  {`TLS/SSL non-certificate ${t("models.selfOptional")}`}
                </div>
              </label>
              {(formData?.skip_tls_verify as boolean || false) && (
                <div className="warning-text">
                  <svg className="warning-icon" width="20px" height="20px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"></circle>
                    <line x1="12" y1="6" x2="12" y2="14" stroke="currentColor" strokeWidth="2"></line>
                    <circle cx="12" cy="17" r="1.5" fill="currentColor"></circle>
                  </svg>
                  <div className="warning-text-description">
                    {t("system.skipTlsVerifyWarning")}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </PopupConfirm>
    </>
  )
}
export default React.memo(KeyPopupEdit)
