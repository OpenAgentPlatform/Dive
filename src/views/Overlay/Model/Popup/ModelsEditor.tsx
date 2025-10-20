import { useAtom, useAtomValue, useSetAtom } from "jotai"
import React, { memo, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { modelVerifyListAtom } from "../../../../atoms/configState"
import { showToastAtom } from "../../../../atoms/toastState"
import CheckBox from "../../../../components/CheckBox"
import Dropdown from "../../../../components/DropDown"
import PopupConfirm from "../../../../components/PopupConfirm"
import Tooltip from "../../../../components/Tooltip"
import { useModelsProvider } from "../ModelsProvider"
import { getVerifyStatus, ModelVerifyDetail, useModelVerify } from "../ModelVerify"
import AdvancedSettingPopup from "./AdvancedSetting"
import CustomIdPopup from "./CustomId"
import { BaseModel, ModelProvider, ModelVerifyStatus } from "../../../../../types/model"
import { isDefaultModelGroup } from "../../../../helper/model"
import InfoTooltip from "../../../../components/InfoTooltip"
import { OAP_ROOT_URL } from "../../../../../shared/oap"
import { OAPModelDescription } from "../../../../../types/oap"
import { oapModelDescription } from "../../../../ipc"
import { isProviderIconNoFilter } from "../../../../atoms/interfaceState"
import { systemThemeAtom, userThemeAtom } from "../../../../atoms/themeState"
import Input from "../../../../components/Input"
import Button from "../../../../components/Button"

type Props = {
  onClose: () => void
  onSuccess: () => void
}

const ModelDescription = memo(({ data }: { data?: OAPModelDescription }) => {
  const userTheme = useAtomValue(userThemeAtom)
  const systemTheme = useAtomValue(systemThemeAtom)

  if (!data) {
    return null
  }

  return (
    <div className="model-option-description">
      <div className="model-option-description-header">
        <div className="header-row">
          <div className="title-section">
            <div className="model-option-description-name-wrapper">
              <img
                src={`${data.icon.startsWith("http") ? data.icon : `${OAP_ROOT_URL}/${data.icon}`}`}
                alt={data.provider}
                className={`oap-model-icon ${isProviderIconNoFilter(data.provider as ModelProvider, userTheme, systemTheme) ? "no-filter" : ""}`}
              />
              <div className="model-option-description-name">
                {data.name}
              </div>
            </div>
            <button className="oap-store-link" onClick={() => window.open(`${OAP_ROOT_URL}/llm/${data.id}`, "_blank")}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 17 16" fill="none">
                <path d="M3.83333 14C3.46667 14 3.15278 13.8694 2.89167 13.6083C2.63056 13.3472 2.5 13.0333 2.5 12.6667V3.33333C2.5 2.96667 2.63056 2.65278 2.89167 2.39167C3.15278 2.13056 3.46667 2 3.83333 2H7.83333C8.02222 2 8.18056 2.06389 8.30833 2.19167C8.43611 2.31944 8.5 2.47778 8.5 2.66667C8.5 2.85556 8.43611 3.01389 8.30833 3.14167C8.18056 3.26944 8.02222 3.33333 7.83333 3.33333H3.83333V12.6667H13.1667V8.66667C13.1667 8.47778 13.2306 8.31944 13.3583 8.19167C13.4861 8.06389 13.6444 8 13.8333 8C14.0222 8 14.1806 8.06389 14.3083 8.19167C14.4361 8.31944 14.5 8.47778 14.5 8.66667V12.6667C14.5 13.0333 14.3694 13.3472 14.1083 13.6083C13.8472 13.8694 13.5333 14 13.1667 14H3.83333ZM13.1667 4.26667L7.43333 10C7.31111 10.1222 7.15556 10.1833 6.96667 10.1833C6.77778 10.1833 6.62222 10.1222 6.5 10C6.37778 9.87778 6.31667 9.72222 6.31667 9.53333C6.31667 9.34444 6.37778 9.18889 6.5 9.06667L12.2333 3.33333H10.5C10.3111 3.33333 10.1528 3.26944 10.025 3.14167C9.89722 3.01389 9.83333 2.85556 9.83333 2.66667C9.83333 2.47778 9.89722 2.31944 10.025 2.19167C10.1528 2.06389 10.3111 2 10.5 2H13.8333C14.0222 2 14.1806 2.06389 14.3083 2.19167C14.4361 2.31944 14.5 2.47778 14.5 2.66667V6C14.5 6.18889 14.4361 6.34722 14.3083 6.475C14.1806 6.60278 14.0222 6.66667 13.8333 6.66667C13.6444 6.66667 13.4861 6.60278 13.3583 6.475C13.2306 6.34722 13.1667 6.18889 13.1667 6V4.26667Z" fill="currentColor"/>
              </svg>
            </button>
          </div>
          <div className="model-option-description-cost">
            {data.token_cost} / million token
          </div>
          {data.extra?.feature && (
            <div className="model-option-description-feature">
              {data.extra?.feature}
            </div>
          )}
        </div>
      </div>
      {data.extra?.special && (
        <div className="model-option-description-special">
          <ul>
            {data.extra?.special.map((item: any, index: number) => {
              return (
                <li key={index}>
                  {item}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
})

const ModelPopup = ({ onClose, onSuccess }: Props) => {
  const { t } = useTranslation()
  const userTheme = useAtomValue(userThemeAtom)
  const systemTheme = useAtomValue(systemThemeAtom)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [checkboxState, setCheckboxState] = useState<"" | "all" | "-">("")
  const [searchText, setSearchText] = useState("")
  const [isFetching, setIsFetching] = useState(false)
  const isVerifying = useRef(false)
  const [verifyingCnt, setVerifyingCnt] = useState(0)
  const [verifiedCnt, setVerifiedCnt] = useState(0)
  const [showUnSupportInfo, setShowUnSupportInfo] = useState(false)
  const [unSupportInfo, setUnSupportInfo] = useState("")
  const [showConfirmVerify, setShowConfirmVerify] = useState(false)
  const [allVerifiedList, setAllVerifiedList] = useAtom(modelVerifyListAtom)
  const { verify, abort } = useModelVerify()
  const showToast = useSetAtom(showToastAtom)
  const [descriptionList, setDescriptionList] = useState<OAPModelDescription[]>([])
  const sortOrderRef = useRef<Map<string, number>>(new Map())
  const [selectedModel, setSelectedModel] = useState<BaseModel | null>(null)

  const { verifyKey, fetchModels, modelToBaseModel, flush, writeModelsBuffer, getLatestBuffer, isGroupExist } = useModelsProvider()

  useEffect(() => {
    reloadModelList()
  }, [])

  const getDescriptionList = async (models: BaseModel[]) => {
    const params = {
      models: models.map((model: any) => model.model),
    }
    const res = await oapModelDescription(params)
    if (res && res.status === "success" && res.data && res.data.length > 0) {
      setDescriptionList(res.data)
    }
  }

  const latestModelsWithVerifyStatus = useMemo(() => {
    const models = getLatestBuffer().models
    return models.map(model => {
      return { ...model, verifyStatus: getVerifyStatus(allVerifiedList[verifyKey()]?.[model.model]) ?? model.verifyStatus ?? "unVerified" }
    })
  }, [])
  const [innerModelBuffer, setInnerModelBuffer] = useState<BaseModel[]>(latestModelsWithVerifyStatus)
  const [currentProviderFilter, setCurrentProviderFilter] = useState<string[]>([])
  const [providerFilter, setProviderFilter] = useState<{
    provider: string
    model: string
  }[]>([])
  const [loadedIcons, setLoadedIcons] = useState<Set<string>>(new Set())

  // Extract provider prefixes from model names when provider is openrouter
  useEffect(() => {
    const currentProvider = getLatestBuffer().group?.modelProvider

    if (currentProvider === "openrouter") {
      // Count models per provider
      const providerCounts = new Map<string, { count: number, model: string }>()

      innerModelBuffer.forEach(model => {
        if (model.model.includes("/")) {
          const prefix = model.model.split("/")[0]
          const existing = providerCounts.get(prefix)
          if (existing) {
            existing.count++
          } else {
            providerCounts.set(prefix, { count: 1, model: model.model })
          }
        }
      })

      // Helper function to check if image exists
      const checkImageExists = (provider: string): Promise<boolean> => {
        return new Promise((resolve) => {
          const svgImg = new Image()
          const pngImg = new Image()
          let svgChecked = false
          let pngChecked = false

          const checkComplete = () => {
            if (svgChecked && pngChecked) {
              resolve(false)
            }
          }

          svgImg.onload = () => resolve(true)
          svgImg.onerror = () => {
            svgChecked = true
            checkComplete()
          }

          pngImg.onload = () => resolve(true)
          pngImg.onerror = () => {
            pngChecked = true
            checkComplete()
          }

          svgImg.src = `/image/model_filter/model_${provider}.svg`
          pngImg.src = `/image/model_filter/model_${provider}.png`
        })
      }

      // Sort by count (descending) and filter providers with icons
      const sortedProviders = Array.from(providerCounts.entries())
        .sort((a, b) => b[1].count - a[1].count)

      // Check which providers have icons and take top 8
      Promise.all(
        sortedProviders.map(async ([provider, data]) => ({
          provider,
          model: data.model,
          hasIcon: await checkImageExists(provider)
        }))
      ).then(results => {
        const providersWithIcons = results
          .filter(item => item.hasIcon)
          .slice(0, 8)
          .map(({ provider, model }) => ({ provider, model }))

        setProviderFilter(providersWithIcons)
      })
    } else {
      setProviderFilter([])
    }
  }, [innerModelBuffer, getLatestBuffer])

  const currentVerifyList = (allVerifiedList ?? {})[verifyKey()] ?? {}

  const updateCheckboxState = (result: BaseModel[]) => {
    const checkedCnt = result.filter(option => option.active).length
    const state: "" | "all" | "-" = checkedCnt === 0 ? "" : checkedCnt === result.length ? "all" : "-"
    setCheckboxState(state)
  }

  const searchListOptions = useMemo(() => {
    // Create a copy for sorting - innerModelBuffer itself is never modified
    // This ensures innerModelBuffer always maintains the original API order
    let result = searchText
      ? [...innerModelBuffer].filter(option => option.model.includes(searchText))
      : [...innerModelBuffer]

    // Sort by stored order for display
    if (sortOrderRef.current.size > 0) {
      result = result.sort((a, b) => {
        const orderA = sortOrderRef.current.get(a.model) ?? Infinity
        const orderB = sortOrderRef.current.get(b.model) ?? Infinity
        return orderA - orderB
      })
    } else {
      // First time: sort by active status and store the order
      result = result.sort((a, b) => {
        if(a.active && !b.active){
          return -1
        }
        if(!a.active && b.active){
          return 1
        }
        return 0
      })
      // Store the display order (for UI only, doesn't affect innerModelBuffer)
      result.forEach((model, index) => {
        sortOrderRef.current.set(model.model, index)
      })
    }

    if(currentProviderFilter.length > 0){
      result = result.filter(option => currentProviderFilter.includes(option.model.split("/")[0]))
    }

    updateCheckboxState(result)
    return result
  }, [innerModelBuffer, searchText, currentProviderFilter])

  const reloadModelList = async () => {
    const customModels = innerModelBuffer.filter(option => option.isCustomModel)

    setIsFetching(true)
    const reloadModels = await fetchModels()
    if(getLatestBuffer().group?.modelProvider === "oap") {
      await getDescriptionList(innerModelBuffer)
    }
    setIsFetching(false)
    if (!reloadModels.length) {
      return
    }

    setInnerModelBuffer(models => {
      const ms = [
        ...customModels,
        ...reloadModels.map(m => {
          const existModel = models.find(model => model.model === m.model)
          return {
            ...m,
            active: existModel?.active ?? false,
            verifyStatus: existModel?.verifyStatus ?? "unVerified"
          }
        }),
      ]

      updateCheckboxState(ms)
      return ms
    })
  }

  const handleGroupClick = () => {
    const state: "" | "all" | "-" = checkboxState == "" ? "all" : ""
    setCheckboxState(state)
    setInnerModelBuffer(ms => {
      return ms.map(m => {
        return { ...m, active: state == "all" }
      })
    })
  }

  const checkedModel = (modelName: string) => {
    setInnerModelBuffer(model => {
      const ms = model.map(m => {
        return { ...m, active: m.model === modelName ? !m.active : m.active }
      })
      updateCheckboxState(ms)
      return ms
    })
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

  const onAddCustomModelID = (name: string) => {
    setInnerModelBuffer(model => {
      return [
        modelToBaseModel(name, true),
        ...model
      ]
    })
  }

  const saveModel = async () => {
    try {
      setIsSubmitting(true)
      const newInnerModelBuffer = await new Promise<BaseModel[]>(resolve => {
        setInnerModelBuffer(innerModelBuffer => {
          resolve(innerModelBuffer)
          return innerModelBuffer
        })
      })
      writeModelsBuffer(newInnerModelBuffer)
      const data = await flush().then(() => ({ success: true })).catch(() => ({ success: false }))

      // save custom model list to local storage
      const key = verifyKey()
      const customModelList = localStorage.getItem("customModelList")
      const allCustomModelList = customModelList ? JSON.parse(customModelList) : {}
      const newCustomModelList = newInnerModelBuffer.filter(option => option.isCustomModel).map(option => option.model)
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
      const verifiedList = allVerifiedList[key] ?? {}
      const cleanedVerifiedList = {} as Record<string, ModelVerifyStatus>
      Object.keys(verifiedList).forEach(modelName => {
        if (newInnerModelBuffer.some(model => model.model === modelName)) {
          cleanedVerifiedList[modelName] = verifiedList[modelName]
        }
      })
      setAllVerifiedList({
        ...allVerifiedList,
        [key as string]: cleanedVerifiedList
      })

      await handleSubmit(data)
    } catch (error) {
      console.error("Failed to save config:", error)
      setInnerModelBuffer(getLatestBuffer().models)
    } finally {
      setIsSubmitting(false)
    }
  }

  const onConfirm = async () => {
    // If there are unverified models, show the verification confirmation popup
    const hasUnVerifiedInChecked = innerModelBuffer
      .filter(model => model.active)
      .some(model => model.verifyStatus == "unVerified")

    if(hasUnVerifiedInChecked){
      return setShowConfirmVerify(true)
    }

    await saveModel()
  }

  const deleteModel = (modelName: string) => {
    setInnerModelBuffer(model => model.filter(m => m.model !== modelName))
  }

  const onVerifyConfirm = (models?: BaseModel[]) => {
    setShowConfirmVerify(false)
    setVerifiedCnt(0)
    isVerifying.current = true

    const _models = models ?? innerModelBuffer
    const needVerifyList = _models.length == 1 ? _models : _models.filter(model =>
        model.verifyStatus === "unVerified" ||
        model.verifyStatus === "error" ||
        !model.verifyStatus
      )
    setVerifyingCnt(needVerifyList.length)

    const onComplete = async () => {
      isVerifying.current = false
    }

    const onUpdate = (detail: ModelVerifyDetail[]) => {
      setVerifiedCnt(detail.filter(item => item.status !== "verifying").length)
      setInnerModelBuffer(model => {
        return model.map(m => {
          const _detail = detail.find(item => item.name == m.model)
          return _detail ? { ...m, verifyStatus: _detail.status } : m
        })
      })
    }

    const onAbort = () => {
      setInnerModelBuffer(model => {
        return model.map(m => {
          return m.verifyStatus === "verifying" ? { ...m, verifyStatus: "unVerified" } : m
        })
      })
      isVerifying.current = false
    }
    verify(getLatestBuffer().group, needVerifyList, onComplete, onUpdate, onAbort)
  }

  const onVerifyIgnore = async (ignoreVerifyList?: BaseModel[]) => {
    const ignoredModels = ignoreVerifyList ?? innerModelBuffer.filter((model: BaseModel) => model.active && model.verifyStatus == "unVerified")
    ignoredModels.forEach((model: BaseModel) => {
      currentVerifyList[model.model] = "ignore"
      setInnerModelBuffer(ms => {
        return ms.map(m => {
          return m.model == model.model ? { ...m, verifyStatus: "ignore" } : m
        })
      })
    })
    allVerifiedList[verifyKey()] = currentVerifyList
    setAllVerifiedList({...allVerifiedList})
    setShowConfirmVerify(false)
  }

  const onVerifyNextTime = () => {
    setShowConfirmVerify(false)
    saveModel()
  }

  const verifyStatusNode = (model: BaseModel) => {
    switch(model.verifyStatus) {
      case "unSupportModel":
      case "unSupportTool":
        return (
          <div className="verify-status">
            <div className="verify-status-text verify-status-error">
              <div
                className="verify-status-error-btn"
                onClick={(e) => {
                  e.preventDefault()
                  setShowUnSupportInfo(true)
                  const current = currentVerifyList[model.model]
                  let error_msg = ""
                  if(current.success) {
                    const key = !current?.connecting?.success ? "connecting" : "supportToolsInPrompt"
                    error_msg = current?.[key]?.error_msg ?? t("models.verifyErrorMsg")
                  } else {
                    error_msg = t("models.verifyUnexpectedFailed")
                  }
                  setUnSupportInfo(error_msg)
                }}
              >
                {t("models.verifyErrorInfo")}
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"></circle>
                <line x1="12" y1="6" x2="12" y2="14" stroke="currentColor" strokeWidth="2"></line>
                <circle cx="12" cy="17" r="1.5" fill="currentColor"></circle>
              </svg>
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
          <Tooltip
            content={t("models.verifyStatusSuccess")}
            disabled={getLatestBuffer().group?.modelProvider === "oap"}
          >
            <div className="verify-status-icon-wrapper">
              <svg className="correct-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 22 22" width="20" height="20">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="m4.67 10.424 4.374 4.748 8.478-7.678"></path>
              </svg>
            </div>
          </Tooltip>
        )
      case "successInPrompt":
        return (
          <Tooltip
            content={t("models.verifyStatusSuccessInPrompt")}
          >
            <div className="verify-status-icon-wrapper success-in-prompt">
              <svg className="correct-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 22 22" width="20" height="20">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="m4.67 10.424 4.374 4.748 8.478-7.678"></path>
              </svg>
            </div>
          </Tooltip>
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

  const ModelMenu = (model: BaseModel) => {
    const status = model.verifyStatus ?? "unVerified"
    const menu = []

    // advanced setting
    menu.push({
      label: (
        <div className="model-option-verify-menu-item">
          <svg
            width="22"
            height="22"
            viewBox="0 0 22 22"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M12 6H2C1.44772 6 1 6.44772 1 7C1 7.55228 1.44772 8 2 8H12V6ZM16 8H20C20.5523 8 21 7.55228 21 7C21 6.44772 20.5523 6 20 6H16V8Z"
              fill="currentColor"
            />
            <circle cx="14" cy="7" r="3" stroke="currentColor" strokeWidth="2" />
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M10 14H20C20.5523 14 21 14.4477 21 15C21 15.5523 20.5523 16 20 16H10V14ZM6 16H2C1.44772 16 1 15.5523 1 15C1 14.4477 1.44772 14 2 14H6V16Z"
              fill="currentColor"
            />
            <circle cx="8" cy="15" r="3" stroke="currentColor" strokeWidth="2" />
          </svg>
          {t("models.verifyMenu.advanced")}
        </div>
      ),
      onClick: () => {
        setSelectedModel(model)
      },
    })

    if(getLatestBuffer().group?.modelProvider === "oap") {
      return menu
    }

    // verify model
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
          {t("models.verifyMenu.verify")}
        </div>,
      onClick: () => {
        onVerifyConfirm([model])
      }
    })

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
            {t("models.verifyMenu.ignore")}
          </div>,
        onClick: () => {
          onVerifyIgnore([model])
        }
      })
    }

    // delete custom model id
    if(model.isCustomModel){
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
            {t("models.verifyMenu.delete")}
          </div>,
        onClick: () => deleteModel(model.model)
      })
    }

    return menu
  }

  const copyInfo = () => {
    navigator.clipboard.writeText(unSupportInfo)
    showToast({
      message: t("common.copySuccess"),
      type: "success"
    })
  }

  const handleClose = () => {
    if(isVerifying.current){
      abort()
    }

    const group = getLatestBuffer().group
    if(!isGroupExist(group) && !isDefaultModelGroup(group)){
      flush()
    }

    onClose()
  }

  const handleAdvancedSettingSave = (model: BaseModel) => {
    model.disableStreaming = model.custom?.disable_streaming ?? model.disableStreaming
    delete model.custom?.disable_streaming

    setInnerModelBuffer(ms => {
      return ms.map(m => {
        return m.model == model.model ? model : m
      })
    })

    setSelectedModel(null)
  }

  // Helper function to get provider icon path
  const getProviderIconPath = (provider: string): { svg: string; png: string } => {
    return {
      svg: `/image/model_filter/model_${provider}.svg`,
      png: `/image/model_filter/model_${provider}.png`
    }
  }

  const isModelFilterIconNoFilter = (provider: string, userTheme: string, systemTheme: string) => {
    const isLightMode = userTheme === "system" ? systemTheme === "light" : userTheme === "light"
    switch (provider) {
      case "openai":
      case "perplexity":
      case "openrouter":
      case "z-ai":
      case "liquid":
      case "mistralai":
        return isLightMode
      default:
        return true
    }
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
      {selectedModel && (
        <AdvancedSettingPopup
          model={selectedModel}
          currentProvider={getLatestBuffer().group?.modelProvider}
          onClose={() => setSelectedModel(null)}
          onSave={handleAdvancedSettingSave}
        />
      )}
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
            <Input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={t("models.searchPlaceholder")}
              size="small"
              className="model-list-search"
              icon2={providerFilter.length === 0 && searchText.length > 0 &&
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
              icon3={
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 22 22" width="22" height="22">
                  <path stroke="currentColor" strokeLinecap="round" strokeMiterlimit="10" strokeWidth="2" d="m15 15 5 5"></path>
                  <path stroke="currentColor" strokeMiterlimit="10" strokeWidth="2" d="M9.5 17a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z">
                  </path>
                </svg>
              }
            />
            {
              getLatestBuffer().group?.modelProvider !== "oap" && (
                <>
                  <div
                    className="models-reload-btn"
                    onClick={() => reloadModelList()}
                  >
                    {t("models.reloadModelList")}
                  </div>
                  <CustomIdPopup onAddCustomModelID={onAddCustomModelID} />
                </>
              )
            }
          </div>
        </div>
        {providerFilter.length > 0 && (
          <div className="model-list-provider-filter">
            <div className="model-list-provider-filter-left">
              <div className="model-list-provider-filter-title">
                Popular
                <Tooltip
                  content={t("models.providerFilter.Alt")}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <g clipPath="url(#clip0_2878_6745)">
                      <circle cx="8" cy="8" r="7.25" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M6.85679 9.88793C7.61485 9.88793 8.39906 9.88793 9.17019 9.88793C9.0787 8.38818 11 7.97575 11 6.12606C11 4.6638 9.83676 3.4515 7.92853 3.50149C6.30784 3.53899 4.96163 4.43884 5.00084 6.33852C5.7589 6.33852 6.22942 6.33852 6.97442 6.33852C6.97442 5.73862 7.40573 5.48866 7.86318 5.47617C8.29449 5.47617 8.77809 5.71363 8.75195 6.17605C8.64739 7.58832 6.63459 7.91326 6.85679 9.88793ZM8.00695 12.5C8.72581 12.5 9.30089 12.0501 9.30089 11.3627C9.30089 10.6628 8.72581 10.2129 8.00695 10.2129C7.30117 10.2129 6.72609 10.6628 6.72609 11.3627C6.72609 12.0501 7.30117 12.5 8.00695 12.5Z" fill="currentColor"/>
                    </g>
                    <defs>
                      <clipPath id="clip0_2878_6745">
                        <rect width="16" height="16" fill="white"/>
                      </clipPath>
                    </defs>
                  </svg>
                </Tooltip>
              </div>
              <div className="model-list-provider-filter-list">
                {providerFilter.map(item => {
                  const iconPaths = getProviderIconPath(item.provider)
                  return (
                    <Tooltip
                      key={item.provider}
                      content={item.provider}
                      side="bottom"
                    >
                      <div
                        className={`provider-filter-item ${currentProviderFilter.includes(item.provider) ? "active" : ""}`}
                        onClick={() => setCurrentProviderFilter(currentProviderFilter.includes(item.provider) ? currentProviderFilter.filter(p => p !== item.provider) : [...currentProviderFilter, item.provider])}
                      >
                        <img
                          src={iconPaths.svg}
                          alt={item.provider}
                          className={`provider-filter-icon ${loadedIcons.has(item.provider) ? "loaded" : ""} ${isModelFilterIconNoFilter(item.provider, userTheme, systemTheme) ? "no-filter" : ""}`}
                          onLoad={(_e) => {
                            setLoadedIcons(prev => new Set(prev).add(item.provider))
                          }}
                          onError={(e) => {
                            // Try PNG if SVG fails
                            if (e.currentTarget.src.endsWith(".svg")) {
                              e.currentTarget.src = iconPaths.png
                            } else {
                              // Hide if both fail
                              e.currentTarget.style.display = "none"
                              setLoadedIcons(prev => new Set(prev).add(item.provider))
                            }
                          }}
                        />
                      </div>
                    </Tooltip>
                  )
                })}
              </div>
            </div>
            <div
              className={`model-list-provider-filter-right ${(currentProviderFilter.length > 0 || (providerFilter.length > 0 && searchText.length > 0)) ? "show" : ""}`}
            >
              <Button
                theme="Outline"
                color="neutral"
                size="medium"
                onClick={() => {
                  setCurrentProviderFilter([])
                  setSearchText("")
                }}
              >
                {t("models.providerFilter.Clear")}
              </Button>
            </div>
          </div>
        )}
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
                  {searchListOptions?.map((model: BaseModel) => (
                    <label
                      key={model.model}
                      onClick={(e) => {
                        e.stopPropagation()
                        if(isVerifying.current){
                          e.preventDefault()
                        }
                      }}
                    >
                      <div className={`model-option ${model.verifyStatus}`}>
                        <CheckBox
                          checked={model.active}
                          onChange={() => checkedModel(model.model)}
                        />
                        <div className="model-option-name-wrapper">
                          <div className="model-option-name">
                            {model.model}
                          </div>
                          {getLatestBuffer().group?.modelProvider === "oap" && descriptionList.find(d => d.model_id === model.model) && (
                            <InfoTooltip
                              side="bottom"
                              className="model-option-description-tooltip"
                              content={<ModelDescription data={descriptionList.find(d => d.model_id === model.model)} />}
                            >
                              <div className="model-option-name-hint">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 23 22" width="18" height="18">
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
                          )}
                        </div>
                        <div className="model-option-hint">
                          {verifyStatusNode(model)}
                          {ModelMenu(model)?.length > 0 && model.verifyStatus !== "verifying" &&
                            <div className="model-option-verify-menu-wrapper">
                              {!isVerifying.current &&
                                <Dropdown
                                  options={ModelMenu(model)}
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
              onConfirm={() => onVerifyConfirm(searchListOptions?.filter(model => model.active && model.verifyStatus == "unVerified"))}
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
                {t("models.verifyTitle", { count: searchListOptions?.filter(model => model.active && model.verifyStatus == "unVerified").length })}
              </h4>
              <div className="model-list-verify-desc">
                <div className="model-list-unverify-list">
                  <span>{t("models.verifyDesc")}</span>
                  <div className="model-list-unverify-ul-wrapper">
                    <ul>
                      {searchListOptions?.filter(model => model.active && model.verifyStatus == "unVerified").map(model => (
                        <li key={model.model}>{model.model}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </PopupConfirm>
          }
          {showUnSupportInfo &&
            <PopupConfirm
              zIndex={900}
              footerType="center"
              className="model-list-unsupport-info"
              onCancel={() => setShowUnSupportInfo(false)}
              cancelText={t("common.close")}
              onClickOutside={() => setShowUnSupportInfo(false)}
            >
              <div className="model-list-unsupport-info-wrapper">
                <div className="model-list-unsupport-info-title">
                  <svg width="22px" height="22px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"></circle>
                    <line x1="12" y1="6" x2="12" y2="14" stroke="currentColor" strokeWidth="2"></line>
                    <circle cx="12" cy="17" r="1.5" fill="currentColor"></circle>
                  </svg>
                  {t("models.verifyErrorInfo")}
                </div>
                <div className="model-list-unsupport-info-content">
                  {unSupportInfo}
                </div>
                <Tooltip
                  content={t("common.copy")}
                  side="bottom"
                >
                  <div className="model-list-unsupport-info-copy" onClick={copyInfo}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18px" height="18px" viewBox="0 0 22 22" fill="transparent">
                      <path d="M13 20H2V6H10.2498L13 8.80032V20Z" fill="transparent" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinejoin="round"/>
                      <path d="M13 9H10V6L13 9Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M9 3.5V2H17.2498L20 4.80032V16H16" fill="transparent" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinejoin="round"/>
                      <path d="M20 5H17V2L20 5Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </Tooltip>
              </div>
            </PopupConfirm>
          }
        </div>
      </div>
    </PopupConfirm>
  )
}

export default React.memo(ModelPopup)