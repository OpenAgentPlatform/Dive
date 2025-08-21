import { useAtom, useAtomValue, useSetAtom } from "jotai"
import React, { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { closeOverlayAtom } from "../../../atoms/layerState"
import PopupConfirm from "../../../components/PopupConfirm"
import { configAtom, modelVerifyListAtom, writeEmptyConfigAtom } from "../../../atoms/configState"
import GroupCreator from "./Popup/GroupCreator"
import ModelsEditor from "./Popup/ModelsEditor"
import ParameterPopup from "./ParameterPopup"
import { showToastAtom } from "../../../atoms/toastState"
import GroupEditor from "./Popup/GroupEditor"
import { modelGroupsAtom, modelSettingsAtom } from "../../../atoms/modelState"
import { LLMGroup, ModelGroupSetting } from "../../../../types/model"
import GroupItem from "./GroupItem"
import { useModelsProvider } from "./ModelsProvider"
import clone from "lodash/cloneDeep"
import { getGroupAndModel, getGroupTerm, getTermFromRawModelConfig, removeGroup } from "../../../helper/model"
import isMatch from "lodash/isMatch"
import { getVerifyKey } from "../../../helper/verify"
import { getVerifyStatus } from "./ModelVerify"
import { commonFlashAtom } from "../../../atoms/globalState"
import { isOAPUsageLimitAtom } from "../../../atoms/oapState"

const PageLayout = () => {
  const { t } = useTranslation()
  const closeOverlay = useSetAtom(closeOverlayAtom)

  const [showGroupCreator, setShowGroupCreator] = useState(false)
  const [showGrupEditor, setShowGroupEditor] = useState(false)
  const [showModelEditorPopup, setShowModelEditorPopup] = useState(false)
  const [showParameterPopup, setShowParameterPopup] = useState(false)
  const [showDeleteModel, setShowDeleteModel] = useState(false)
  const [showNoModelAfterDelete, setShowNoModelAfterDelete] = useState(false)
  const [showNoModelAfterToggle, setShowNoModelAfterToggle] = useState(false)

  const lastToggleGroup = useRef<LLMGroup | null>(null)
  const showToast = useSetAtom(showToastAtom)
  const allVerifiedList = useAtomValue(modelVerifyListAtom)
  const modelGroups = useAtomValue(modelGroupsAtom)
  const rawConfig = useAtomValue(configAtom)
  const writeEmptyConfig = useSetAtom(writeEmptyConfigAtom)
  const isOAPUsageLimit = useAtomValue(isOAPUsageLimitAtom)

  const [settings, setSettings] = useAtom(modelSettingsAtom)
  const { writeGroupBuffer, writeModelsBuffer, getLatestBuffer, pushModelBufferWithModelNames, flush } = useModelsProvider()
  const [commonFlash, setCommonFlash] = useAtom(commonFlashAtom)

  const isGroupNoModelAvailble = (groups: LLMGroup[]) => {
    return groups
      .filter(g => g.active)
      .map(group => {
        const currentVerifyList = allVerifiedList[getVerifyKey(group)] ?? {}
        return group.models.filter(model => getVerifyStatus(currentVerifyList[model.model]) !== "unSupportModel").length
      })
      .every(a => a === 0)
  }

  const getSettings = () => new Promise<ModelGroupSetting>((resolve) => {
    setSettings(prev => {
      resolve(prev)
      return prev
    })
  })

  useEffect(() => {
    if(commonFlash === "openPromtSetting") {
      setShowParameterPopup(true)
      setCommonFlash(null)
    }
  }, [])

  const handleNewGroupSubmit = () => {
    setShowGroupCreator(false)
    setShowModelEditorPopup(true)
  }

  const handleKeyPopupEditSubmit = (customModel?: string) => {
    setShowGroupEditor(false)
    if (customModel) {
      pushModelBufferWithModelNames([customModel])
    }
    flush()

    showToast({
      message: t("setup.saveSuccess"),
      type: "success"
    })
  }

  const openModelPopup = async (group: LLMGroup) => {
    writeGroupBuffer(group)
    writeModelsBuffer(group.models)
    setShowModelEditorPopup(true)
  }

  const handleModelSubmit = () => {
    handleActiveConfigNotInSettings()
    setShowModelEditorPopup(false)
  }

  const handleActiveConfigNotInSettings = async () => {
    const settings = await getSettings()
    const term = getTermFromRawModelConfig(rawConfig)
    if (!term) {
      return
    }

    const result = getGroupAndModel({ ...term.group, active: true }, { ...term.model, active: true }, settings.groups)
    if (result) {
      return
    }

    writeEmptyConfig()
  }

  const handleConfirmDelete = async () => {
    setShowDeleteModel(false)
    setShowNoModelAfterDelete(false)
    const group = clone(getLatestBuffer().group)
    setSettings(settings => {
      settings.groups = removeGroup(getGroupTerm(group), settings.groups)
      return clone(settings)
    })

    showToast({
      message: t("models.deleteToast", { name: group.modelProvider }),
      type: "success"
    })

    handleActiveConfigNotInSettings()
  }

  const handleDeleteGroup = (group: LLMGroup) => {
    const newGroups = removeGroup(getGroupTerm(group), settings.groups)
    if (isGroupNoModelAvailble(newGroups)) {
      setShowNoModelAfterDelete(true)
      return
    }

    writeGroupBuffer(group)
    setShowDeleteModel(true)
  }

  const handleGroupToggle = (group: LLMGroup, active?: boolean, force?: boolean) => {
    if (!group) {
      return
    }

    lastToggleGroup.current = group
    const newGroups = settings.groups.map(g => {
      if(isMatch(getGroupTerm(g), getGroupTerm(group))) {
        return {
          ...g,
          active: active ?? !g.active
        }
      }
      return g
    })

    if (!force && isGroupNoModelAvailble(newGroups)) {
      setShowNoModelAfterToggle(true)
      return
    }

    setShowNoModelAfterToggle(false)
    setSettings(settings => {
      return {
        ...settings,
        groups: newGroups
      }
    })

    handleActiveConfigNotInSettings()
  }

  const handleEditGroup = (group: LLMGroup) => {
    writeGroupBuffer(group)
    writeModelsBuffer(group.models)
    setShowGroupEditor(true)
  }

  return (
    <div className="models-page overlay-page">
      <div className="models-container">
        <div className="models-header">
          <div>{t("models.title")}</div>
        </div>
        <div className="models-content">
          <div className="models-content-header">
            <div className="left">
              <svg width="30px" height="30px" viewBox="0 0 46 46">
                <g>
                  <path d="M 18.433594 6.460938 C 12.210938 9.570312 12.851562 8.660156 12.851562 14.375 L 12.851562 19.246094 L 8.726562 21.375 L 4.566406 23.507812 L 4.566406 35.34375 L 9.300781 37.78125 C 11.90625 39.132812 14.238281 40.25 14.476562 40.25 C 14.714844 40.25 16.742188 39.304688 19.042969 38.1875 L 23.167969 36.089844 L 27.261719 38.1875 C 29.527344 39.304688 31.558594 40.25 31.761719 40.25 C 32.367188 40.25 40.757812 35.953125 41.195312 35.414062 C 41.5 35.042969 41.601562 33.351562 41.535156 29.222656 L 41.433594 23.507812 L 37.308594 21.375 L 33.148438 19.246094 L 33.148438 14.410156 C 33.148438 10.214844 33.078125 9.503906 32.570312 9.066406 C 31.660156 8.253906 23.777344 4.398438 23.101562 4.429688 C 22.761719 4.429688 20.667969 5.34375 18.433594 6.460938 Z M 26.042969 8.761719 L 28.582031 10.078125 L 25.808594 11.433594 L 23.066406 12.785156 L 20.394531 11.398438 L 17.691406 10.011719 L 20.261719 8.761719 C 21.679688 8.050781 23 7.476562 23.167969 7.476562 C 23.371094 7.476562 24.65625 8.050781 26.042969 8.761719 Z M 18.941406 13.867188 L 21.648438 15.21875 L 21.648438 18.601562 C 21.648438 20.464844 21.578125 21.984375 21.476562 21.984375 C 21.375 21.984375 20.089844 21.375 18.601562 20.632812 L 15.898438 19.28125 L 15.898438 15.898438 C 15.898438 14.035156 15.964844 12.515625 16.066406 12.515625 C 16.167969 12.515625 17.453125 13.125 18.941406 13.867188 Z M 30.101562 15.898438 L 30.101562 19.28125 L 27.398438 20.632812 C 25.910156 21.375 24.625 21.984375 24.523438 21.984375 C 24.421875 21.984375 24.351562 20.496094 24.351562 18.671875 L 24.351562 15.355469 L 27.160156 13.96875 C 28.683594 13.191406 29.96875 12.546875 30.035156 12.546875 C 30.070312 12.515625 30.101562 14.035156 30.101562 15.898438 Z M 17.082031 25.773438 L 14.410156 27.125 L 11.667969 25.808594 L 8.964844 24.453125 L 11.667969 23.066406 L 14.375 21.714844 L 17.082031 23.066406 L 19.785156 24.421875 Z M 34.332031 25.773438 L 31.660156 27.125 L 28.917969 25.808594 L 26.214844 24.453125 L 28.917969 23.066406 L 31.625 21.714844 L 34.332031 23.066406 L 37.035156 24.421875 Z M 12.851562 33.011719 L 12.851562 36.429688 L 7.101562 33.453125 L 7.101562 26.71875 L 12.851562 29.5625 Z M 21.511719 33.382812 C 21.410156 33.621094 20.089844 34.433594 18.601562 35.144531 L 15.898438 36.460938 L 15.898438 29.5625 L 18.703125 28.207031 L 21.476562 26.820312 L 21.578125 29.867188 C 21.613281 31.558594 21.613281 33.113281 21.511719 33.382812 Z M 30.101562 33.011719 L 30.101562 36.429688 L 24.351562 33.453125 L 24.351562 26.71875 L 30.101562 29.5625 Z M 38.761719 33.382812 C 38.660156 33.621094 37.339844 34.433594 35.851562 35.144531 L 33.148438 36.460938 L 33.148438 29.5625 L 35.953125 28.207031 L 38.726562 26.820312 L 38.828125 29.867188 C 38.863281 31.558594 38.863281 33.113281 38.761719 33.382812 Z M 38.761719 33.382812 "/>
                </g>
              </svg>
              {t("models.listTitle")}
            </div>
            <div className="right">
              <button
                className="models-new-key-btn"
                onClick={() => {
                  setShowGroupCreator(true)
                }}
              >
                {t("models.newProvider")}
              </button>
              <div
                className="models-parameter-btn"
                onClick={() => setShowParameterPopup(true)}
              >
                {t("modelConfig.customInstructions")}
              </div>
            </div>
          </div>
          <div className={`providers-list ${isOAPUsageLimit ? "oap-usage-limit" : ""}`}>
            <div className="providers-list-item head">
              <div className="provider-col-1"></div>
              <div className="provider-col-2">{t("Provider")}</div>
              <div className="provider-col-3">{t("Info")}</div>
              <div className="provider-col-4">{t("Models")}</div>
              <div className="provider-col-5"></div>
              <div className="provider-col-6">{t("Status")}</div>
              <div className="provider-col-7"></div>
              <div className="provider-col-8"></div>
            </div>
            {modelGroups.map((group: LLMGroup, index: number) => (
              <GroupItem
                key={`config-${index}-${group.models.length}`}
                group={group}
                onGroupToggle={handleGroupToggle}
                onOpenModelPopup={openModelPopup}
                onEditGroup={handleEditGroup}
                onDeleteGroup={handleDeleteGroup}
              />
            ))}
          </div>
        </div>
        {showGroupCreator && (
          <GroupCreator
            onClose={() => setShowGroupCreator(false)}
            onSuccess={handleNewGroupSubmit}
          />
        )}
        {showGrupEditor && (
          <GroupEditor
            onClose={() => setShowGroupEditor(false)}
            onSuccess={handleKeyPopupEditSubmit}
          />
        )}
        {showModelEditorPopup && (
          <ModelsEditor
            onClose={() => {
              setShowModelEditorPopup(false)
            }}
            onSuccess={handleModelSubmit}
          />
        )}
        {/* {showNoActiveModelAfterEditModel && (
          <PopupConfirm
            noBorder={true}
            zIndex={900}
            footerType="center"
            className="models-delete-confirm"
            onConfirm={() => setShowNoActiveModelAfterEditModel(false)}
            onClickOutside={() => setShowNoActiveModelAfterEditModel(false)}
          >
            <div className="models-delete-confirm-content">
              <div className="models-delete-confirm-title">{t("models.noModelAlertTitle")}</div>
              <div className="models-delete-confirm-description">{t("models.noModelAlertDescription")}</div>
            </div>
          </PopupConfirm>
        )} */}
        {showNoModelAfterToggle && (
          <PopupConfirm
            noBorder={true}
            zIndex={900}
            footerType="center"
            className="models-delete-confirm"
            onConfirm={() => {
              handleGroupToggle(lastToggleGroup.current!, false, true)
              lastToggleGroup.current = null
            }}
            onCancel={() => {
              setShowNoModelAfterToggle(false)
              lastToggleGroup.current = null
            }}
            onClickOutside={() => {
              setShowNoModelAfterToggle(false)
              lastToggleGroup.current = null
            }}
          >
            <div className="models-delete-confirm-content">
              <div className="models-delete-confirm-title">{t("models.closeAllTitle")}</div>
              <div className="models-delete-confirm-description">{t("models.closeAllDescription")}</div>
            </div>
          </PopupConfirm>
        )}
        {showDeleteModel && (
          <PopupConfirm
            noBorder={true}
            zIndex={900}
            footerType="center"
            className="models-delete-confirm"
            onConfirm={handleConfirmDelete}
            onCancel={() => setShowDeleteModel(false)}
            onClickOutside={() => setShowDeleteModel(false)}
          >
            <div className="models-delete-confirm-content">
              <div className="models-delete-confirm-title">
                {t("models.deleteTitle", { name: getLatestBuffer().group.modelProvider })}
              </div>
              <div className="models-delete-confirm-description">
                {t("models.deleteDescription") }
              </div>
            </div>
          </PopupConfirm>
        )}
        {showNoModelAfterDelete && (
          <PopupConfirm
            noBorder={true}
            zIndex={900}
            footerType="center"
            className="models-delete-confirm"
            onConfirm={handleConfirmDelete}
            onCancel={() => setShowNoModelAfterDelete(false)}
            onClickOutside={() => setShowNoModelAfterDelete(false)}
          >
            <div className="models-delete-confirm-content">
              <div className="models-delete-confirm-title">
                {t("models.deleteAllTitle")}
              </div>
              <div className="models-delete-confirm-description">
                {t("models.deleteAllDescription")}
              </div>
            </div>
          </PopupConfirm>
        )}
        {showParameterPopup && (
          <ParameterPopup
            onClose={() => setShowParameterPopup(false)}
          />
        )}
      </div>
    </div>
  )
}

export default React.memo(PageLayout)