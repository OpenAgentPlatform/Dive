import { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useAtom } from "jotai"
import { showToastAtom } from "../../../atoms/toastState"
import PopupConfirm from "../../../components/PopupConfirm"
import CheckBox from "../../../components/CheckBox"
import { ListOption, useModelsProvider } from "./ModelsProvider"
import { defaultInterface } from "../../../atoms/interfaceState"
import React from "react"
import { useModelVerify, ModelVerifyDetail, ModelVerifyStatus } from "./ModelVerify"
import WrappedInput from "../../../components/WrappedInput"
import { InterfaceModelConfig, MultiModelConfig } from "../../../atoms/configState"
import Tooltip from "../../../components/Tooltip"
import Dropdown from "../../../components/DropDown"

const ModelPopup = ({
  defaultModel,
  onClose,
  onSuccess,
}: {
  defaultModel: string
  onClose: () => void
  onSuccess: () => void
}) => {
  const { t } = useTranslation()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [, showToast] = useAtom(showToastAtom)
  const [checkboxState, setCheckboxState] = useState<"" | "all" | "-">("")
  const [searchText, setSearchText] = useState("")
  const [isFetching, setIsFetching] = useState(false)
  const isVerifying = useRef(false)
  const [verifyingCnt, setVerifyingCnt] = useState(0)
  const [verifiedCnt, setVerifiedCnt] = useState(0)
  const [showConfirmVerify, setShowConfirmVerify] = useState(false)
  const localListOptions = localStorage.getItem("modelVerify")
  const allVerifiedList = localListOptions ? JSON.parse(localListOptions) : {}
  const { verify, abort } = useModelVerify()

  const { fetchListOptions, listOptions, setListOptions,
          multiModelConfigList, setMultiModelConfigList,
          currentIndex, saveConfig
        } = useModelsProvider()

  const multiModelConfig = (multiModelConfigList?.[currentIndex] ?? {}) as MultiModelConfig
  const currentVerifyList = multiModelConfig ? allVerifiedList[multiModelConfig?.apiKey || multiModelConfig?.baseURL] ?? {} : {}

  const searchListOptions = useMemo(() => {
    let result = listOptions
    if(searchText.length > 0) {
      result = result?.filter(option => option.name.includes(searchText))
    }
    let state = "-"
    if(listOptions?.filter(option => option.checked).length === 0)
      state = ""
    else if(result?.length > 0 && result?.every(option => option.checked))
      state = "all"
    setCheckboxState(state as "" | "all" | "-")
    return result
  }, [listOptions, searchText])

  useEffect(() => {
    ;(async () => {
      await reloadModelList(defaultModel)
    })()

    return () => {
      setIsFetching(false)
      setShowConfirmVerify(false)
      setVerifiedCnt(0)
      isVerifying.current = false
    }
  }, [multiModelConfig])

  const reloadModelList = async (_defaultModel?: string) => {
    if(!multiModelConfig)
      return
    setListOptions([])
    setIsFetching(true)
    let options = await fetchListOptions(multiModelConfig, defaultInterface[multiModelConfig.name])
    options = options.map(option => ({
      ...option,
      checked: _defaultModel ? option.name === _defaultModel : multiModelConfig.models.includes(option.name),
      verifyStatus: option.verifyStatus ?? "unVerified"
    })).sort((a, b) => {
      if (a.checked === b.checked) {
        return (a as any).originalIndex - (b as any).originalIndex
      }
      return a.checked ? -1 : 1
    })
    setListOptions(options)
    setCheckboxState(options.every(option => option.checked) ? "all" : options.some(option => option.checked) ? "-" : "")
    setIsFetching(false)
  }

  const handleGroupClick = () => {
    let State: "" | "all" | "-" = ""
    if (checkboxState == "") {
      State = "all"
    } else {
      State = ""
    }
    setCheckboxState(State)

    const _newModelList = listOptions?.map((model: ListOption) => {
      if(searchText.length > 0 && !model.name.includes(searchText))
        return { ...model, "checked": false }
      return { ...model, "checked": !!State }
    })
    setListOptions(_newModelList)
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

  const saveModel = async () => {
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

      // save custom model list to local storage
      const key = `${multiModelConfig.apiKey || multiModelConfig.baseURL}`
      const customModelList = localStorage.getItem("customModelList")
      const allCustomModelList = customModelList ? JSON.parse(customModelList) : {}
      const newCustomModelList = listOptions.filter(option => option.isCustom).map(option => option.name)
      if(newCustomModelList.length > 0){
        localStorage.setItem("customModelList", JSON.stringify({
          ...allCustomModelList,
          [key as string]: newCustomModelList
        }))
      } else {
        delete allCustomModelList[key]
        localStorage.setItem("customModelList", JSON.stringify(allCustomModelList))
      }

      // if model is not in current listOptions, remove it from verifiedList
      const localListOptions = localStorage.getItem("modelVerify")
      const allVerifiedList = localListOptions ? JSON.parse(localListOptions) : {}
      const verifiedList = allVerifiedList[key] ?? {}
      const cleanedVerifiedList = {} as Record<string, ModelVerifyStatus>
      Object.keys(verifiedList).forEach(modelName => {
        if (listOptions.some(option => option.name === modelName)) {
          cleanedVerifiedList[modelName] = verifiedList[modelName]
        }
      })
      localStorage.setItem("modelVerify", JSON.stringify({
        ...allVerifiedList,
        [key as string]: cleanedVerifiedList
      }))

      await handleSubmit(data)
    } catch (error) {
      setMultiModelConfigList(_multiModelConfigList)
    } finally {
      setIsSubmitting(false)
    }
  }

  const onConfirm = async () => {
    // If there are unverified models, show the verification confirmation popup
    if(listOptions?.filter(option => option.checked).some(option => option.verifyStatus == "unVerified")){
      setShowConfirmVerify(true)
    } else {
      await saveModel()
    }
  }

  const handleDeleteCustomModelID = (name: string) => {
    setListOptions((prev: ListOption[]) => {
      return prev.filter(option => option.name !== name)
    })
  }

  const onVerifyConfirm = (needVerifyList?: Record<string, InterfaceModelConfig>, ifSave: boolean = true) => {
    setShowConfirmVerify(false)
    setVerifiedCnt(0)
    isVerifying.current = true
    const _listOptions = JSON.parse(JSON.stringify(listOptions))
    const _needVerifyList = needVerifyList ? needVerifyList : _listOptions.filter((option: ListOption) => {
      return multiModelConfig && option.checked && option.verifyStatus === "unVerified"
    }).reduce((acc: Record<string, InterfaceModelConfig>, value: ListOption) => {
      acc[value.name] = {
        apiKey: multiModelConfig?.apiKey,
        baseURL: multiModelConfig?.baseURL,
        model: value.name,
      } as InterfaceModelConfig
      return acc
    }, {} as Record<string, InterfaceModelConfig>)
    setVerifyingCnt(needVerifyList ? Object.keys(needVerifyList).length : _listOptions.filter((option: ListOption) => option.checked).length)

    const onComplete = async () => {
      if(ifSave){
        await saveModel()
      }
      isVerifying.current = false
    }

    const onUpdate = (detail: ModelVerifyDetail[]) => {
      listOptions.forEach((option: ListOption) => {
        const _detail = detail.find(item => item.name == option.name)
        if(_detail){
          option.verifyStatus = _detail.status
        }
      })
      setListOptions(listOptions)
      setVerifiedCnt(detail.filter(item => item.status !== "verifying").length)
    }

    const onAbort = () => {
      setListOptions((prev: ListOption[]) => {
        const _prev = JSON.parse(JSON.stringify(prev))
        return _prev.map((option: ListOption) => {
          if (option.verifyStatus === "verifying") {
            return _listOptions.find((item: ListOption) => item.name == option.name)
          }
          return {
            ...option
          }
        })
      })
      isVerifying.current = false
    }
    verify(_needVerifyList, onComplete, onUpdate, onAbort)
  }

  const onVerifyIgnore = async (ignoreVerifyList?: ListOption[], ifSave: boolean = true) => {
    const _listOptions = JSON.parse(JSON.stringify(listOptions))
    const _ignoreVerifyList = ignoreVerifyList ? ignoreVerifyList : _listOptions.filter((option: ListOption) => option.checked && option.verifyStatus == "unVerified")
    _ignoreVerifyList.forEach((option: ListOption) => {
      currentVerifyList[option.name] = "ignore"
      if (_listOptions.find((item: ListOption) => item.name == option.name)) {
        _listOptions.find((item: ListOption) => item.name == option.name).verifyStatus = "ignore"
      }
    })
    setListOptions(_listOptions)
    allVerifiedList[multiModelConfig?.apiKey || multiModelConfig?.baseURL] = currentVerifyList
    localStorage.setItem("modelVerify", JSON.stringify(allVerifiedList))
    setShowConfirmVerify(false)
    if(ifSave){
      await saveModel()
    }
  }

  const onVerifyNextTime = () => {
    setShowConfirmVerify(false)
    saveModel()
  }

  const verifyStatusNode = (option: ListOption) => {
    switch(option.verifyStatus) {
      case "unSupportModel":
        return (
          <div className="verify-status">
            <div className="verify-status-text">
              {t("models.unSupportModel")}
            </div>
          </div>
        )
      case "unSupportTool":
        return (
          <div className="verify-status">
            <div className="verify-status-text">
              {t("models.unToolCallsSupport")}
            </div>
          </div>
        )
      case "unVerified":
        return
      case "verifying":
        return (
          <div className="verify-status">
            <div className="loading-spinner"></div>
          </div>
        )
      case "success":
        return (
          <div className="verify-status-icon-wrapper">
            <svg className="correct-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 22 22" width="22" height="22">
              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="m4.67 10.424 4.374 4.748 8.478-7.678"></path>
            </svg>
          </div>
        )
      case "ignore":
        return (
          <div className="verify-status">
            <div className="verify-status-text">
              {t("models.ignored")}
            </div>
          </div>
        )
    }
  }

  const verifyMenu = (option: ListOption) => {
    const status = option.verifyStatus ?? "unVerified"
    const menu = []

    // verify model
    if(status !== "success"){
      const _option: Record<string, InterfaceModelConfig> = {}
      _option[option.name] = {
        apiKey: multiModelConfig?.apiKey,
        baseURL: multiModelConfig?.baseURL,
        model: option.name
      } as InterfaceModelConfig
      menu.push({
        label:
          <div className="model-option-verify-menu-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M7 2.5L1.06389 4.79879C1.02538 4.8137 1 4.85075 1 4.89204V11.9315C1 11.9728 1.02538 12.0098 1.06389 12.0247L7 14.3235" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M7.5 10.5V7.5L12.8521 4.58066C12.9188 4.54432 13 4.59255 13 4.66845V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M1 5L7.5 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M7 2.5L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="15.5" cy="15.5" r="5.5" stroke="currentColor" strokeWidth="2"/>
              <path d="M13 15.1448L14.7014 17L18 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t("models.verifyMenu1")}
          </div>,
        onClick: () => {
          onVerifyConfirm(_option, false)
        }
      })
    }

    // ignore verify model
    if(status !== "ignore" && status !== "success"){
      menu.push({
        label:
          <div className="model-option-verify-menu-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
              <circle cx="15.5" cy="15.5" r="5.5" stroke="currentColor" strokeWidth="2"/>
              <path d="M17.5 15.5H13.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M7 2.5L1.06389 4.79879C1.02538 4.8137 1 4.85075 1 4.89204V11.9315C1 11.9728 1.02538 12.0098 1.06389 12.0247L7 14.3235" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M7.5 10.5V7.5L12.8521 4.58066C12.9188 4.54432 13 4.59255 13 4.66845V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M1 5L7.5 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M7 2.5L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            {t("models.verifyMenu2")}
          </div>,
        onClick: () => {
          onVerifyIgnore([{
            ...option,
            apiKey: multiModelConfig?.apiKey,
            baseURL: multiModelConfig?.baseURL,
            model: option.name
          } as ListOption], false)
        }
      })
    }

    // delete custom model id
    if(option.isCustom){
      menu.push({
        label:
          <div className="model-option-verify-menu-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M3 5H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M17 7V18.2373C16.9764 18.7259 16.7527 19.1855 16.3778 19.5156C16.0029 19.8457 15.5075 20.0192 15 19.9983H7C6.49249 20.0192 5.99707 19.8457 5.62221 19.5156C5.24735 19.1855 5.02361 18.7259 5 18.2373V7" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M8 10.04L14 16.04" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M14 10.04L8 16.04" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M13.5 2H8.5C8.22386 2 8 2.22386 8 2.5V4.5C8 4.77614 8.22386 5 8.5 5H13.5C13.7761 5 14 4.77614 14 4.5V2.5C14 2.22386 13.7761 2 13.5 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
            </svg>
            {t("models.verifyMenu3")}
          </div>,
        onClick: () => handleDeleteCustomModelID(option.name)
      })
    }

    return menu
  }

  const handleClose = () => {
    if(isVerifying.current){
      abort()
    }
    onClose()
  }

  return (
    <PopupConfirm
      zIndex={900}
      className="model-popup"
      disabled={isFetching || isVerifying.current || isSubmitting}
      confirmText={(isVerifying.current || isSubmitting) ? (
        <div className="loading-spinner"></div>
      ) : t("tools.save")}
      onConfirm={onConfirm}
      onCancel={handleClose}
      onClickOutside={handleClose}
      footerHint={
        isVerifying.current && (
          <div className="models-progress-wrapper">
            <div className="models-progress-text">
              {t("models.progressVerifying")}
              <div className="models-progress-text-right">
                <div className="abort-button" onClick={abort}>
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path d="M8 6h2v12H8zm6 0h2v12h-2z" fill="currentColor"/>
                  </svg>
                </div>
                <span>{`${verifiedCnt} / ${verifyingCnt}`}</span>
              </div>
            </div>
            <div className="models-progress-container">
              <div
                className="models-progress"
                style={{
                  width: `${(verifiedCnt / verifyingCnt) * 100}%`
                }}
              >
              </div>
            </div>
          </div>
        )
      }
    >
      <div className="model-popup-content">
        <div className="model-list-header">
          <div className="model-list-title">
            <CheckBox
              checked={!!checkboxState}
              indeterminate={checkboxState == "-"}
              onChange={handleGroupClick}
            />
            {t("models.popupTitle")}
          </div>
          <div className="model-list-tools">
            <div className="model-list-search-wrapper">
              <WrappedInput
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={t("models.searchPlaceholder")}
                className="model-list-search"
              />
              {searchText.length > 0 &&
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 18 18"
                  width="22"
                  height="22"
                  className="model-list-search-clear"
                  onClick={() => setSearchText("")}
                >
                  <path stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="m13.91 4.09-9.82 9.82M13.91 13.91 4.09 4.09"></path>
                </svg>
              }
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 22 22" width="22" height="22">
                <path stroke="currentColor" strokeLinecap="round" strokeMiterlimit="10" strokeWidth="2" d="m15 15 5 5"></path>
                <path stroke="currentColor" strokeMiterlimit="10" strokeWidth="2" d="M9.5 17a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z">
                </path>
              </svg>
            </div>
            <div
              className="models-reload-btn"
              onClick={() => reloadModelList()}
            >
              {t("models.reloadModelList")}
            </div>
            <CustomIdPopup
              listOptions={listOptions}
              setListOptions={setListOptions}
            />
          </div>
        </div>
        <div className="model-list">
          {isFetching ? (
              <div className="loading-spinner-wrapper">
                <div className="loading-spinner"></div>
              </div>
            ) : (
              searchListOptions?.length == 0 ?
                <div className="model-list-empty">
                  {t("models.noResult")}
                </div> :
                <>
                  {searchListOptions?.map((option: ListOption) => (
                    <label
                      key={option.name}
                      onClick={(e) => {
                        e.stopPropagation()
                        if(isVerifying.current){
                          e.preventDefault()
                        }
                      }}
                    >
                      <div className={`model-option ${option.verifyStatus}`}>
                        <CheckBox
                          checked={option.checked}
                          onChange={() => handleModelChange(option.name, "checked", !option.checked)}
                        />
                        <div className="model-option-name">
                          {option.name}
                        </div>
                        <div className="model-option-hint">
                          {verifyStatusNode(option)}
                          {verifyMenu(option)?.length > 0 && option.verifyStatus !== "verifying" &&
                            <div className="model-option-verify-menu-wrapper">
                              {!isVerifying.current &&
                                <Dropdown
                                  options={verifyMenu(option)}
                                >
                                  <div className="model-option-verify-menu">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 22 22" width="18" height="18">
                                      <path fill="currentColor" d="M19 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM11 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM3 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"></path>
                                    </svg>
                                  </div>
                                </Dropdown>
                              }
                            </div>
                          }
                        </div>
                      </div>
                    </label>
                  ))}
                </>
            )
          }
          {showConfirmVerify &&
            <PopupConfirm
              zIndex={900}
              className="model-list-verify-popup"
              onConfirm={() => onVerifyConfirm()}
              confirmText={t("models.verify")}
              onCancel={() => onVerifyIgnore()}
              cancelText={t("models.verifyIgnore")}
              cancelTooltip={t("models.verifyIgnoreAlt")}
              footerHint={
                <Tooltip
                  content={t("models.verifyNextTimeAlt")}
                >
                  <div
                    className="verify-next-time-button"
                    onClick={onVerifyNextTime}
                  >
                    {t("models.verifyNextTime")}
                  </div>
                </Tooltip>
              }
            >
              <h4 className="model-list-verify-title">
                {t("models.verifyTitle", { count: listOptions?.filter(option => option.checked && option.verifyStatus == "unVerified").length })}
              </h4>
              <div className="model-list-verify-desc">
                <div className="model-list-unverify-list">
                  <span>{t("models.verifyDesc")}</span>
                  <div className="model-list-unverify-ul-wrapper">
                    <ul>
                      {listOptions?.filter(option => option.checked && option.verifyStatus == "unVerified").map(option => (
                        <li key={option.name}>{option.name}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </PopupConfirm>
          }
        </div>
      </div>
    </PopupConfirm>
  )
}

export default React.memo(ModelPopup)

const CustomIdPopup = ({
  listOptions,
  setListOptions,
}: {
  listOptions: ListOption[]
  setListOptions: Dispatch<SetStateAction<ListOption[]>>
}) => {
  const { t } = useTranslation()
  const [showCustomModelID, setShowCustomModelID] = useState(false)
  const [customModelID, setCustomModelID] = useState("")
  const [customModelIDError, setCustomModelIDError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    autoFocus()
  }, [showCustomModelID])

  const autoFocus = async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
    inputRef.current?.focus()
  }

  const addCustomModelID = (name: string) => {
    setCustomModelIDError("")
    if(name.length == 0) {
      // check if the model id is empty
      setCustomModelIDError(t("models.customModelIDError1"))
      return
    } else if(listOptions.find(option => option.name === name)) {
      // check if the model id is already in the list
      setCustomModelIDError(t("models.customModelIDError2"))
      return
    }

    setListOptions((prev: ListOption[]) => {
      return [
        {
          name,
          checked: true,
          verifyStatus: "unVerified",
          isCustom: true
        },
        ...prev
      ]
    })
    setShowCustomModelID(false)
    setCustomModelID("")
    setCustomModelIDError("")
  }

  const handleCustomModelIDChange = (name: string) => {
    setCustomModelID(name)
    setCustomModelIDError("")
  }

  const handleCustomModelIDClose = () => {
    setShowCustomModelID(false)
    setCustomModelID("")
    setCustomModelIDError("")
  }
  return (
    <>
      <button
        className="model-list-add-key"
        onClick={() => setShowCustomModelID(true)}
      >
        {t("models.addCustomModelID")}
      </button>
      {showCustomModelID && (
        <PopupConfirm
          zIndex={900}
          className="model-customID-popup"
          onConfirm={() => addCustomModelID(customModelID)}
          onCancel={handleCustomModelIDClose}
          onClickOutside={handleCustomModelIDClose}
          footerType="center"
          noBorder={true}
        >
          <div className="model-popup-content">
            <div className="model-option-name-input-content">
              <div className="model-popup-title">
                {t("models.customModelIDTitle")}
              </div>
              <div className="model-option-name-input-wrapper">
                <WrappedInput
                  ref={inputRef}
                  value={customModelID}
                  onChange={(e) => handleCustomModelIDChange(e.target.value)}
                  placeholder={t("models.customModelIDPlaceholder")}
                  className="model-option-name-input"
                  autoFocus={true}
                />
                {customModelIDError && (
                  <div className="model-option-edit-error">
                    {customModelIDError}
                  </div>
                )}
              </div>
            </div>
          </div>
        </PopupConfirm>
      )}
    </>
  )
}