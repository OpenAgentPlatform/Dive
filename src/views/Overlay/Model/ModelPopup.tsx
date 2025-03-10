import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useAtom } from "jotai"
import { showToastAtom } from "../../../atoms/toastState"
import PopupConfirm from "../../../components/PopupConfirm"
import CheckBox from "../../../components/CheckBox"
import { ListOption, useModelsProvider } from "./ModelsProvider"
import { defaultInterface } from "../../../atoms/interfaceState"
import React from "react"

const ModelPopup = ({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) => {
  const { t } = useTranslation()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isVerifyingNoTool, setIsVerifyingNoTool] = useState(false)
  const [, showToast] = useAtom(showToastAtom)
  const [checkboxState, setCheckboxState] = useState<"" | "all" | "-">("")
  const isVerifying = useRef(false)
  const [originalListOptions, setOriginalListOptions] = useState<ListOption[]>([])

  const { fetchListOptions, listOptions, setListOptions,
          multiModelConfigList, setMultiModelConfigList,
          currentIndex, verifyModel,
          saveConfig
        } = useModelsProvider()

  const multiModelConfig = multiModelConfigList?.[currentIndex]

  useEffect(() => {
    ;(async () => {
      if(!multiModelConfig)
        return
      setListOptions([])
      setOriginalListOptions([])
      const text = sessionStorage.getItem(`model-list-${multiModelConfig.apiKey || multiModelConfig.baseURL}`)
      let verifiedList: ListOption[] = []
      if(text){
        verifiedList = JSON.parse(text)
      } else {
        isVerifying.current = true
        const options = await fetchListOptions(multiModelConfig, defaultInterface[multiModelConfig.name])
        for(const index in options){
          const option = JSON.parse(JSON.stringify(options[index]))
          const verifyResult = await verifyModel(multiModelConfig, option.name)
          if(!isVerifying.current)
            return
          if(verifyResult && verifyResult.success){
            option.supportTools = verifyResult.supportTools
            verifiedList.push(option)
          }
        }
        // sessionStorage.setItem(`model-list-${multiModelConfig.apiKey || multiModelConfig.baseURL}`, JSON.stringify(verifiedList))
      }
      verifiedList = verifiedList.map(option => ({
        ...option,
        checked: multiModelConfig.models.includes(option.name)
      }))
      setOriginalListOptions(verifiedList)
      setListOptions(verifiedList)
      setCheckboxState(verifiedList.every(option => option.checked) ? "all" : verifiedList.some(option => option.checked) ? "-" : "")
      isVerifying.current = false
    })()

    return () => {
      isVerifying.current = false
    }
  }, [])

  const handleGroupClick = () => {
    let State: "" | "all" | "-" = ""
    if (checkboxState == "") {
      State = "all"
    } else {
      State = ""
    }
    setCheckboxState(State)

    const newModelList = listOptions?.map((model: ListOption) => {
      return { ...model, "checked": !!State }
    })
    setListOptions(newModelList)
  }

  const handleModelChange = (name: string, key: string, value: any) => {
    const newModelList = listOptions?.map((model: ListOption) => {
      if (model.name === name) {
        return { ...model, [key]: value }
      }
      return model
    })
    if (newModelList.every((model: ListOption) => model.checked)) {
      setCheckboxState("all");
    } else if (newModelList.some((model: ListOption) => model.checked)) {
      setCheckboxState("-");
    } else {
      setCheckboxState("");
    }
    setListOptions(newModelList)
  }

  const handleSubmit = async (data: Record<string, any>) => {
    try {
      if (data.success) {
        showToast({
          message: t("models.modelSaved"),
          type: "success"
        })
        onSuccess()
      }
    } catch (error) {
      console.error("Failed to save config:", error)
      showToast({
        message: t("models.modelSaveFailed"),
        type: "error"
      })
    }
  }

  const onConfirm = async () => {
    const _multiModelConfigList = JSON.parse(JSON.stringify(multiModelConfigList))
    if(!multiModelConfigList){
      handleSubmit({ success: true })
      return
    }
    try {
      setIsSubmitting(true)
      const newModelConfigList = multiModelConfigList
      newModelConfigList[currentIndex].models = listOptions.filter(option => option.checked).map(option => option.name)
      setMultiModelConfigList([...newModelConfigList])
      const data = await saveConfig()
      await handleSubmit(data)
    } catch (error) {
      setMultiModelConfigList(_multiModelConfigList)
    } finally {
      setIsSubmitting(false)
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
      zIndex={900}
      className="model-popup"
      disabled={isVerifying.current || isSubmitting || JSON.stringify(originalListOptions) === JSON.stringify(listOptions)}
      confirmText={(isVerifying.current || isSubmitting) ? (
        <div className="loading-spinner"></div>
      ) : t("tools.save")}
      onConfirm={onConfirm}
      onCancel={handleClose}
      onClickOutside={handleClose}
    >
      {isVerifying.current ?
        <div className="loading-spinner"></div> :
        <div className="model-popup-content">
          <div className="model-popup-title">
            <CheckBox
              checked={!!checkboxState}
              indeterminate={checkboxState == "-"}
              onChange={handleGroupClick}
            />
            Available Models
          </div>
          <div className="model-list">
            {listOptions?.map((option: ListOption) => (
              <label key={option.name} className="model-option">
                <CheckBox
                  checked={option.checked}
                    onChange={() => handleModelChange(option.name, "checked", !option.checked)}
                  />
                  <div className="model-option-name">
                    {option.name}
                  </div>
                  <div className="model-option-hint">
                    {!option.supportTools ? t("models.unToolCallsSupport") : ""}
                  </div>
              </label>
            ))}
          </div>
        </div>
      }
    </PopupConfirm>
  )
}

export default React.memo(ModelPopup)