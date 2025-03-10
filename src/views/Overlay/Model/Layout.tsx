import { useSetAtom } from "jotai"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import Switch from "../../../components/Switch"
import CheckBox from "../../../components/CheckBox"
import { closeOverlayAtom } from "../../../atoms/layerState"
import PopupConfirm from "../../../components/PopupConfirm"
import { MultiModelConfig } from "../../../atoms/configState"
import KeyPopup from "./KeyPopup"
import ModelPopup from "./ModelPopup"
import ParameterPopup from "./ParameterPopup"
import { useModelsProvider } from "./ModelsProvider"
import { showToastAtom } from "../../../atoms/toastState"
import { ModelProvider } from "../../../atoms/interfaceState"
import { getModelPrefix } from "../../../util"

const PageLayout = () => {
  const { t } = useTranslation()
  const closeOverlay = useSetAtom(closeOverlayAtom)
  const [showDelete, setShowDelete] = useState(false)
  const [showKeyPopup, setShowKeyPopup] = useState(false)
  const [showModelPopup, setShowModelPopup] = useState(false)
  const [showDeleteAll, setShowDeleteAll] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [showNoModelAlert, setShowNoModelAlert] = useState(false)
  const [stopAlert, setStopAlert] = useState(false)
  const [showParameterPopup, setShowParameterPopup] = useState(false)
  const [checkboxState, setCheckboxState] = useState("")
  const showToast = useSetAtom(showToastAtom)

  const { multiModelConfigList, setMultiModelConfigList,
          currentIndex, setCurrentIndex, saveConfig
        } = useModelsProvider()

  const onClose = () => {
    closeOverlay("Model")
  }

  useEffect(() => {
    if(!showModelPopup) {
      sessionStorage.removeItem(`model-list-${multiModelConfigList?.[currentIndex]?.apiKey || multiModelConfigList?.[currentIndex]?.baseURL}`)
    }
  }, [showModelPopup])

  const handleActiveAll = async (active: boolean, targetIndex: number = -1) => {
    const _multiModelConfigList = JSON.parse(JSON.stringify(multiModelConfigList))
    const newMultiModelConfigList = multiModelConfigList ?? []
    newMultiModelConfigList.map((multiModelConfig: MultiModelConfig, index: number) => {
      if((!active && targetIndex > -1 && index == targetIndex) || targetIndex == -1) {
        newMultiModelConfigList[index].active = active
      }
    })
    setMultiModelConfigList(newMultiModelConfigList)

    try {
      const _activeProvider = newMultiModelConfigList.filter(config => config.active && config.models.length > 0).length === 0 ? "none" : undefined
      const data = await saveConfig(_activeProvider as ModelProvider)
      if (data.success) {
        showToast({
          message: t("setup.saveSuccess"),
          type: "success"
        })
      }
    } catch (error) {
      console.error("Failed to save config:", error)
      setMultiModelConfigList(_multiModelConfigList)
    }
  }

  const handleGroupClick = () => {
    let State: "" | "all" | "-" = ""
    if (checkboxState == "") {
      State = "all"
    } else {
      State = ""
    }
    setCheckboxState(State)

    const newMultiModelConfigList = multiModelConfigList ?? []
    newMultiModelConfigList.map((multiModelConfig: MultiModelConfig, index: number) => {
      newMultiModelConfigList[index].checked = !!State
    })
    setMultiModelConfigList(newMultiModelConfigList)
  }

  const changeConfirm = async (newMultiModelConfigList: MultiModelConfig[], ifSave: boolean = true) => {
    const _multiModelConfigList = JSON.parse(JSON.stringify(multiModelConfigList))

    setMultiModelConfigList(newMultiModelConfigList)

    if (ifSave) {
      try {
        const _activeProvider = newMultiModelConfigList.filter(config => config.active && config.models.length > 0).length === 0 ? "none" : undefined
        const data = await saveConfig(_activeProvider as ModelProvider)
        if (data.success) {
          showToast({
            message: t("setup.saveSuccess"),
            type: "success"
          })
        } else {
          showToast({
            message: data.error ?? t("setup.saveFailed"),
            type: "error"
          })
          setMultiModelConfigList(_multiModelConfigList)
        }
      } catch (error) {
        console.error("Failed to save config:", error)
        setMultiModelConfigList(_multiModelConfigList)
      }
    }

    if (newMultiModelConfigList.every(multiModelConfig => multiModelConfig.checked)) {
      setCheckboxState("all")
    } else if (newMultiModelConfigList.some(multiModelConfig => multiModelConfig.checked)) {
      setCheckboxState("-")
    } else {
      setCheckboxState("")
    }
  }

  const handleMultiModelConfigChange = async (index: number, key: keyof MultiModelConfig, value: MultiModelConfig[keyof MultiModelConfig], ifSave: boolean = true) => {
    const newMultiModelConfigList = JSON.parse(JSON.stringify(multiModelConfigList)) ?? []
    newMultiModelConfigList[index][key] = value

    if(key !== "checked" && !value && newMultiModelConfigList.filter((config: MultiModelConfig) => config.active && config.models.length > 0).length === 0) {
      setCurrentIndex(index)
      newMultiModelConfigList[index][key] = !value
      setShowCloseConfirm(true)
    }else{
      changeConfirm(newMultiModelConfigList, ifSave)
    }
  }

  const handleNewKeySubmit = () => {
    setShowKeyPopup(false)
    setShowModelPopup(true)
    setStopAlert(true)
  }

  const openModelPopup = async (index: number) => {
    setCurrentIndex(index)
    setShowModelPopup(true)
  }

  const handleModelSubmit = () => {
    setShowModelPopup(false)
    if(!stopAlert && multiModelConfigList?.filter(config => config.active && config.models.length > 0).length === 0) {
      setShowNoModelAlert(true)
    }
    setStopAlert(false)
  }

  const deleteConfig = async () => {
    const _multiModelConfigList = multiModelConfigList ?? []
    try {
      const newMultiModelConfigList = multiModelConfigList?.filter(config => !config.checked) ?? []
      setMultiModelConfigList(newMultiModelConfigList)
      const _activeProvider = newMultiModelConfigList.filter(config => config.active && config.models.length > 0).length === 0 ? "none" : undefined
      const data = await saveConfig(_activeProvider as ModelProvider)
      if (data.success) {
        showToast({
          message: t("models.deleteToast", { count: multiModelConfigList?.filter(config => config.checked).length ?? 0 }),
          type: "success"
        })
        setShowDelete(false)
      } else {
        showToast({
          message: data.error ?? t("models.deleteFailed"),
          type: "error"
        })
        setMultiModelConfigList(_multiModelConfigList)
      }
      setCheckboxState("")
    } catch (error) {
      console.error("Failed to save config:", error)
      setMultiModelConfigList(_multiModelConfigList)
    }
  }

  const handleDeleteConfirm = () => {
    const newMultiModelConfigList = multiModelConfigList?.filter(config => !config.checked) ?? []
    if(newMultiModelConfigList.filter(config => config.active && config.models.length > 0).length === 0) {
      setShowDeleteAll(true)
    } else {
      setShowDelete(true)
    }
  }

  const handleDelete = async () => {
    await deleteConfig()
    setShowDelete(false)
  }

  const handleDeleteAll = async () => {
    await deleteConfig()
    setShowDeleteAll(false)
  }

  return (
    <div className="models-page overlay-page">
      <button
        className="close-btn"
        onClick={onClose}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <div className="models-container">
        <div className="models-header">
          <div>{t("models.title")}</div>
          <div
            className="models-parameter-btn"
            onClick={() => setShowParameterPopup(true)}
          >
            {t("models.parameters")}
          </div>
          {showParameterPopup && (
            <ParameterPopup
              onClose={() => setShowParameterPopup(false)}
            />
          )}
        </div>
        <div className="models-content">
          <div className="models-content-header">
            <div className="left">
              <svg width="40px" height="40px" viewBox="0 0 46 46">
                <g>
                  <path d="M 18.433594 6.460938 C 12.210938 9.570312 12.851562 8.660156 12.851562 14.375 L 12.851562 19.246094 L 8.726562 21.375 L 4.566406 23.507812 L 4.566406 35.34375 L 9.300781 37.78125 C 11.90625 39.132812 14.238281 40.25 14.476562 40.25 C 14.714844 40.25 16.742188 39.304688 19.042969 38.1875 L 23.167969 36.089844 L 27.261719 38.1875 C 29.527344 39.304688 31.558594 40.25 31.761719 40.25 C 32.367188 40.25 40.757812 35.953125 41.195312 35.414062 C 41.5 35.042969 41.601562 33.351562 41.535156 29.222656 L 41.433594 23.507812 L 37.308594 21.375 L 33.148438 19.246094 L 33.148438 14.410156 C 33.148438 10.214844 33.078125 9.503906 32.570312 9.066406 C 31.660156 8.253906 23.777344 4.398438 23.101562 4.429688 C 22.761719 4.429688 20.667969 5.34375 18.433594 6.460938 Z M 26.042969 8.761719 L 28.582031 10.078125 L 25.808594 11.433594 L 23.066406 12.785156 L 20.394531 11.398438 L 17.691406 10.011719 L 20.261719 8.761719 C 21.679688 8.050781 23 7.476562 23.167969 7.476562 C 23.371094 7.476562 24.65625 8.050781 26.042969 8.761719 Z M 18.941406 13.867188 L 21.648438 15.21875 L 21.648438 18.601562 C 21.648438 20.464844 21.578125 21.984375 21.476562 21.984375 C 21.375 21.984375 20.089844 21.375 18.601562 20.632812 L 15.898438 19.28125 L 15.898438 15.898438 C 15.898438 14.035156 15.964844 12.515625 16.066406 12.515625 C 16.167969 12.515625 17.453125 13.125 18.941406 13.867188 Z M 30.101562 15.898438 L 30.101562 19.28125 L 27.398438 20.632812 C 25.910156 21.375 24.625 21.984375 24.523438 21.984375 C 24.421875 21.984375 24.351562 20.496094 24.351562 18.671875 L 24.351562 15.355469 L 27.160156 13.96875 C 28.683594 13.191406 29.96875 12.546875 30.035156 12.546875 C 30.070312 12.515625 30.101562 14.035156 30.101562 15.898438 Z M 17.082031 25.773438 L 14.410156 27.125 L 11.667969 25.808594 L 8.964844 24.453125 L 11.667969 23.066406 L 14.375 21.714844 L 17.082031 23.066406 L 19.785156 24.421875 Z M 34.332031 25.773438 L 31.660156 27.125 L 28.917969 25.808594 L 26.214844 24.453125 L 28.917969 23.066406 L 31.625 21.714844 L 34.332031 23.066406 L 37.035156 24.421875 Z M 12.851562 33.011719 L 12.851562 36.429688 L 7.101562 33.453125 L 7.101562 26.71875 L 12.851562 29.5625 Z M 21.511719 33.382812 C 21.410156 33.621094 20.089844 34.433594 18.601562 35.144531 L 15.898438 36.460938 L 15.898438 29.5625 L 18.703125 28.207031 L 21.476562 26.820312 L 21.578125 29.867188 C 21.613281 31.558594 21.613281 33.113281 21.511719 33.382812 Z M 30.101562 33.011719 L 30.101562 36.429688 L 24.351562 33.453125 L 24.351562 26.71875 L 30.101562 29.5625 Z M 38.761719 33.382812 C 38.660156 33.621094 37.339844 34.433594 35.851562 35.144531 L 33.148438 36.460938 L 33.148438 29.5625 L 35.953125 28.207031 L 38.726562 26.820312 L 38.828125 29.867188 C 38.863281 31.558594 38.863281 33.113281 38.761719 33.382812 Z M 38.761719 33.382812 "/>
                </g>
              </svg>
              {t("models.listTitle")}
            </div>
            <div className="right">
              <button
                className="models-add-btn"
                onClick={() => handleActiveAll(true)}
              >
                All On
              </button>
              <button
                className="models-add-btn"
                onClick={() => {
                  setCurrentIndex(-1)
                  setShowCloseConfirm(true)
                }}
                disabled={multiModelConfigList?.filter(config => config.active).length == 0}
              >
                All Off
              </button>
              <button
                className="models-add-btn"
                onClick={handleDeleteConfirm}
                disabled={multiModelConfigList?.filter(config => config.checked).length == 0}
              >
                <svg width="20" height="20" viewBox="0 0 28 28" fill="none" stroke="currentColor">
                  <path d="M3.81812 6.36328H24.1818" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M21.6363 8.90918V23.2112C21.6062 23.833 21.3214 24.418 20.8444 24.8381C20.3673 25.2582 19.7367 25.4791 19.0908 25.4525H8.90898C8.26306 25.4791 7.63252 25.2582 7.15543 24.8381C6.67833 24.418 6.39358 23.833 6.36353 23.2112V8.90918" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                  <path d="M10.1819 12.7783L17.8182 20.4147" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                  <path d="M17.8182 12.7783L10.1819 20.4147" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                  <path d="M17.3182 2.5459H10.6819C10.4057 2.5459 10.1819 2.76976 10.1819 3.0459V5.86408C10.1819 6.14022 10.4057 6.36408 10.6819 6.36408H17.3182C17.5944 6.36408 17.8182 6.14022 17.8182 5.86408V3.0459C17.8182 2.76976 17.5944 2.5459 17.3182 2.5459Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                </svg>
              </button>
              {showCloseConfirm && (
                <PopupConfirm
                  noBorder={true}
                  zIndex={900}
                  footerType="center"
                  className="models-delete-confirm"
                  onConfirm={() => {
                    handleActiveAll(false, currentIndex)
                    setShowCloseConfirm(false)
                  }}
                  onCancel={() => {
                    setShowCloseConfirm(false)
                  }}
                  onClickOutside={() => {
                    setShowCloseConfirm(false)
                  }}
                >
                  <div className="models-delete-confirm-content">
                    <div className="models-delete-confirm-title">{t("models.closeAllTitle")}</div>
                    <div className="models-delete-confirm-description">{t("models.closeAllDescription")}</div>
                  </div>
                </PopupConfirm>
              )}
              {showDelete && (
                <PopupConfirm
                  noBorder={true}
                  zIndex={900}
                  footerType="center"
                  className="models-delete-confirm"
                  onConfirm={handleDelete}
                  onCancel={() => {
                    setShowDelete(false)
                  }}
                  onClickOutside={() => {
                    setShowDelete(false)
                  }}
                >
                  <div className="models-delete-confirm-content">
                    <div className="models-delete-confirm-title">{t("models.deleteTitle", { count: multiModelConfigList?.filter(config => config.checked).length ?? 0 })}</div>
                    <div className="models-delete-confirm-description">{t("models.deleteDescription")}</div>
                  </div>
                </PopupConfirm>
              )}
              {showDeleteAll && (
                <PopupConfirm
                  noBorder={true}
                  zIndex={900}
                  footerType="center"
                  className="models-delete-confirm"
                  onConfirm={handleDeleteAll}
                  onCancel={() => {
                    setShowDeleteAll(false)
                  }}
                  onClickOutside={() => {
                    setShowDeleteAll(false)
                  }}
                >
                  <div className="models-delete-confirm-content">
                    <div className="models-delete-confirm-title">{t("models.deleteAllTitle")}</div>
                    <div className="models-delete-confirm-description">{t("models.deleteAllDescription")}</div>
                  </div>
                </PopupConfirm>
              )}
              <button
                className="models-new-key-btn"
                onClick={() => {
                  setShowKeyPopup(true)
                  setCurrentIndex(-1)
                }}
              >
                + New Key
              </button>
            </div>
          </div>
          <div className="providers-list">
            <div className="providers-list-item head">
              <div>
                <CheckBox
                  checked={!!checkboxState}
                  indeterminate={checkboxState == "-"}
                  onChange={handleGroupClick}
                />
              </div>
              <div>{t("Provider")}</div>
              <div>{t("Authentication")}</div>
              <div>{t("Status")}</div>
              <div>{t("Models")}</div>
            </div>
            <div className="providers-list-container">
              {multiModelConfigList?.map((multiModelConfig: MultiModelConfig, index: number) => (
                <div className="providers-list-item" key={`multiModelConfig-${index}`}>
                  <div className="checkbox">
                    <CheckBox
                      checked={multiModelConfig.checked}
                      onChange={(e) => {
                        handleMultiModelConfigChange(index, "checked" as keyof MultiModelConfig, e.target.checked, false)
                      }}
                    />
                  </div>
                  <div>
                    <div className="provider">
                      {multiModelConfig.name}
                    </div>
                  </div>
                  <div className="api-key">
                    ...{multiModelConfig ? getModelPrefix(multiModelConfig as any, 5) : ""}
                  </div>
                  <div>
                    <Switch
                      checked={multiModelConfig.active}
                      onChange={(e) => {
                        handleMultiModelConfigChange(index, "active" as keyof MultiModelConfig, !multiModelConfig.active)
                      }}
                    />
                  </div>
                  <div className="models-popup-btn-container">
                    <div
                      className="models-popup-btn"
                      onClick={() => openModelPopup(index)}
                    >
                      {multiModelConfig.models?.length ?? 0}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {showKeyPopup && (
          <KeyPopup
            onClose={() => setShowKeyPopup(false)}
            onSuccess={handleNewKeySubmit}
          />
        )}
        {showModelPopup && (
          <ModelPopup
            onClose={() => {
              setShowModelPopup(false)
              setStopAlert(false)
            }}
            onSuccess={handleModelSubmit}
          />
        )}
        {showNoModelAlert && (
          <PopupConfirm
            noBorder={true}
            zIndex={900}
            footerType="center"
            className="models-delete-confirm"
            onConfirm={() => {
              setShowNoModelAlert(false)
            }}
            onClickOutside={() => {
              setShowNoModelAlert(false)
            }}
          >
            <div className="models-delete-confirm-content">
              <div className="models-delete-confirm-title">{t("models.noModelAlertTitle")}</div>
              <div className="models-delete-confirm-description">{t("models.noModelAlertDescription")}</div>
            </div>
          </PopupConfirm>
        )}
      </div>
    </div>
  )
}

export default React.memo(PageLayout)