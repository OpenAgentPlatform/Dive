import { useTranslation } from "react-i18next"
import { ModelConfig } from "../../../../atoms/configState"
import { defaultInterface, FieldDefinition, PROVIDER_LABELS, PROVIDERS } from "../../../../atoms/interfaceState"
import PopupConfirm from "../../../../components/PopupConfirm"
import { useEffect, useMemo, useRef, useState } from "react"
import { showToastAtom } from "../../../../atoms/toastState"
import { useAtomValue, useSetAtom } from "jotai"
import React from "react"
import CheckBox from "../../../../components/CheckBox"
import Tooltip from "../../../../components/Tooltip"
import SelectSearch from "../../../../components/SelectSearch"
import { ModelProvider } from "../../../../../types/model"
import { useModelsProvider } from "../ModelsProvider"
import useModelInterface from "../../../../hooks/useModelInterface"
import { fieldsToLLMGroup, getGroupTerm, queryGroup } from "../../../../helper/model"
import { modelSettingsAtom } from "../../../../atoms/modelState"
import Input from "../../../../components/Input"

type Props = {
  onClose: () => void
  onSuccess: () => void
}

const GroupCreator = ({ onClose, onSuccess }: Props) => {
  const { t } = useTranslation()
  const [provider, setProvider] = useState<ModelProvider>(PROVIDERS[0])
  const [fields, setFields] = useState<Record<string, FieldDefinition>>(defaultInterface[provider])

  const [formData, setFormData] = useState<Record<string, any>>({active: true})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [customModelId, setCustomModelId] = useState<string>("")
  const [verifyError, setVerifyError] = useState<string>("")
  const isVerifying = useRef(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showToast = useSetAtom(showToastAtom)
  const [showOptional, setShowOptional] = useState<Record<string, Record<string, boolean>>>({})
  const settings = useAtomValue(modelSettingsAtom)

  const providerList = useMemo(() => {
    return PROVIDERS.filter(p => p !== "default" && !(p === "oap" && !window.isDev))
  }, [])

  const {
    isGroupExist,
    writeGroupBufferWithFields: writeGroupBuffer,
    writeModelsBufferWithModelNames,
    writeModelsBuffer,
    reset: resetModelGroup,
  } = useModelsProvider()
  const { fetchListField } = useModelInterface()

  useEffect(() => {
    return () => {
      isVerifying.current = false
    }
  }, [])

  const handleProviderChange = (value: ModelProvider) => {
    setProvider(value)
    setFormData({active: true})
    setCustomModelId("")
    Object.entries(defaultInterface[value]).forEach(([key, field]) => {
      if (Object.keys(field).includes("value") && field.value) {
        setFormData(prev => ({ ...prev, [key]: field.value }))

        if(key === "customModelId"){
          setCustomModelId(field.value)
        }
      }

      if (field.getValue) {
        field.getValue().then(value => {
          setFormData(prev => ({ ...prev, [key]: value }))
        })
      }
    })
    setFields(defaultInterface[value])
    setErrors({})
    setVerifyError("")
  }

  const handleChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    Object.entries(fields).forEach(([key, field]) => {
      if (field.required && !formData[key] && key !== "customModelId") {
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

  const onConfirm = async () => {
    if (!validateForm()) {
      return
    }

    const isFillOptionalBaseURL = !defaultInterface[provider]["baseURL"]?.required && !showOptional[provider]?.["baseURL"]
    const fields: Record<string, any> = {
      ...formData,
      baseURL: isFillOptionalBaseURL ? "" : formData.baseURL
    }

    const fieldsGroup = fieldsToLLMGroup(provider, fields)
    if(isGroupExist(fieldsGroup)) {
      const existingGroup = queryGroup(getGroupTerm(fieldsGroup), settings.groups)[0]
      writeGroupBuffer(provider, fields)
      writeModelsBuffer(existingGroup.models)
      onSuccess()
      return
    }

    try {
      setErrors({})
      setVerifyError("")
      setIsSubmitting(true)
      isVerifying.current = true

      let isCustomIdEmpty = !customModelId
      const isCustomModelIdRequired = fields["customModelId"]?.required
      if(!isCustomModelIdRequired && !showOptional[provider]?.["customModelId"]) {
        isCustomIdEmpty = true
        setCustomModelId("")
      }

      let models: string[] = []
      try {
        models = await fetchListField(defaultInterface[provider]["model"], fields)
      } catch (e) {
        if (isCustomIdEmpty) {
          setVerifyError((e as Error).message)
          return
        }
      }

      //if custom model id is required, still need to check if the key is valid
      if(isCustomIdEmpty && isCustomModelIdRequired) {
        //if custom model id is required, it doesn't need to check if listOptions is empty
        //because fetchListOptions in pre step will throw error if the key is invalid
        if (!models?.length && !isCustomModelIdRequired){
          const newErrors: Record<string, string> = {}
          newErrors["apiKey"] = t("models.apiKeyError")
          setErrors(newErrors)
          return
        }
      }

      if(!isCustomIdEmpty) {
        // save custom model list to local storage
        const customModelList = localStorage.getItem("customModelList")
        const allCustomModelList = customModelList ? JSON.parse(customModelList) : {}
        localStorage.setItem("customModelList", JSON.stringify({
          ...allCustomModelList,
          [formData.accessKeyId || fields.apiKey || fields.baseURL || ""]: [customModelId]
        }))
      }

      writeGroupBuffer(provider, fields)
      writeModelsBufferWithModelNames(models, !isCustomIdEmpty ? [customModelId] : [])
      onSuccess()
    } catch (error) {
      setVerifyError((error as Error).message)
      resetModelGroup()
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
    resetModelGroup()
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
      confirmText={(isVerifying.current || isSubmitting) ? (<div className="loading-spinner"></div>) : t("tools.save")}
      disabled={isVerifying.current || isSubmitting}
      onCancel={handleClose}
      onClickOutside={handleClose}
    >
      <div className="models-key-popup">
        <div className="models-key-form-group">
          <div className="models-key-field-title">
            API Provider
          </div>
          <SelectSearch
            fullWidth
            options={providerList.map(p => ({ value: p, label: PROVIDER_LABELS[p] }))}
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
          key !== "model" && key !== "customModelId" && key !== "skip_tls_verify" && (
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
                <Input
                  type="text"
                  value={formData[key as keyof ModelConfig] as string || ""}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange(key, e.target.value)}
                  placeholder={field.placeholder?.toString()}
                  error={errors[key] ? true : false}
                  information={errors[key] ? errors[key] : ""}
                  disabled={field.readonly}
                />
              )}
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
                {"Custom Model ID"}<span className="required">*</span>
              </>
            )}
          </label>
          {(showOptional[provider]?.["customModelId"] || fields["customModelId"]?.required) && (
            <Input
              type="text"
              value={customModelId as string || ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomModelId(e.target.value)}
              placeholder={"YOUR_MODEL_ID"}
              error={errors["customModelId"] ? true : false}
              information={errors["customModelId"] ? errors["customModelId"] : ""}
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

export default React.memo(GroupCreator)