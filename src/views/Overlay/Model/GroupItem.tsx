import { memo, useMemo } from "react"
import { LLMGroup } from "../../../../types/model"
import { isProviderIconNoFilter, PROVIDER_ICONS, PROVIDER_LABELS } from "../../../atoms/interfaceState"
import { systemThemeAtom, userThemeAtom } from "../../../atoms/themeState"
import { useAtomValue } from "jotai"
import { isOAPUsageLimitAtom, OAPLevelAtom } from "../../../atoms/oapState"
import Tooltip from "../../../components/Tooltip"
import Switch from "../../../components/Switch"
import Dropdown from "../../../components/DropDown"
import { useTranslation } from "react-i18next"
import { getGroupDisplayDetail } from "../../../helper/model"
import { modelVerifyListAtom } from "../../../atoms/configState"
import { getVerifyStatus } from "./ModelVerify"
import { getVerifyKey } from "../../../helper/verify"

type Props = {
  group: LLMGroup
  onGroupToggle: (group: LLMGroup, active: boolean) => void
  onOpenModelPopup: (group: LLMGroup) => void
  onEditGroup: (group: LLMGroup) => void
  onDeleteGroup: (group: LLMGroup) => void
}

const GroupItem = ({ group, onGroupToggle, onOpenModelPopup, onEditGroup, onDeleteGroup }: Props) => {
  const { t } = useTranslation()
  const userTheme = useAtomValue(userThemeAtom)
  const systemTheme = useAtomValue(systemThemeAtom)
  const OAPLevel = useAtomValue(OAPLevelAtom)
  const allVerifiedList = useAtomValue(modelVerifyListAtom)
  const isOAP = group.modelProvider === "oap"
  const isOAPUsageLimit = useAtomValue(isOAPUsageLimitAtom)

  const activeModelCount = useMemo(() => {
    return group.models.filter(model => model.active).length
  }, [group])

  const unSupportModelCount = useMemo(() => {
    const key: string = getVerifyKey(group)
    const currentVerifyList = allVerifiedList[key] ?? {}
    return group.models.filter(model => model.active && getVerifyStatus(currentVerifyList[model.model]) === "unSupportModel").length
  }, [group, allVerifiedList])

  const openModelPopup = () => onOpenModelPopup(group)
  const editGroup = () => onEditGroup(group)
  const handleGroupToggle = (active: boolean) => onGroupToggle(group, active)

  const imageClassName = isProviderIconNoFilter(group.modelProvider, userTheme, systemTheme) ? "no-filter" : ""

  return (<div className={`providers-list-item ${isOAP ? "oap" : ""}`}>
      <div className="provider-col-1"></div>
      <div className="provider-col-2">
        <img
          src={PROVIDER_ICONS[group.modelProvider]}
          alt={group.modelProvider}
          className={`provider-icon ${imageClassName}`}
        />
        <div className="provider-name">
          {PROVIDER_LABELS[group.modelProvider]}
        </div>
      </div>
      <div className="provider-col-3">
        {isOAP ?
          <div className="oap-level">
            {OAPLevel}
          </div>
        :
          <div>
            {getGroupDisplayDetail(group).map((d, i) => <div key={i}>{d}</div>)}
          </div>
        }
      </div>
      <div className="provider-col-4">
        <div className="models-popup-btn-container">
          <div
            className="models-popup-btn"
            onClick={openModelPopup}
          >
            {activeModelCount - unSupportModelCount}
          </div>
          {unSupportModelCount > 0 &&
          <Tooltip
            content={t("models.unSupportModelCount", { count: unSupportModelCount })}
          >
            <svg className="models-unsupport-count-tooltip" width="16px" height="16px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"></circle>
              <line x1="12" y1="6" x2="12" y2="14" stroke="currentColor" strokeWidth="2"></line>
              <circle cx="12" cy="17" r="1.5" fill="currentColor"></circle>
            </svg>
          </Tooltip>}
        </div>
      </div>
      <div className="provider-col-5">
          {(isOAP && isOAPUsageLimit) &&
          <div className="providers-hint-item-text">
            {t("models.oapUsageLimit")}
          </div>}
      </div>
      <div className="provider-col-6">
        <Switch
          size="medium"
          checked={group.active}
          onChange={(e) => handleGroupToggle(e.target.checked)}
        />
      </div>
      <div className="provider-col-7">
        <Dropdown
          options={{
            "root": {
              subOptions: [
                { label:
                    <div className="provider-edit-menu-item">
                      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
                        <path d="M3 13.6684V18.9998H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M2.99991 13.5986L12.5235 4.12082C13.9997 2.65181 16.3929 2.65181 17.869 4.12082V4.12082C19.3452 5.58983 19.3452 7.97157 17.869 9.44058L8.34542 18.9183" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {t("models.providerMenu1")}
                    </div>,
                  onClick: editGroup,
                  active: !isOAP,
                },
                { label:
                    <div className="provider-edit-menu-item">
                      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
                        <path d="M11 15C13.2091 15 15 13.2091 15 11C15 8.79086 13.2091 7 11 7C8.79086 7 7 8.79086 7 11C7 13.2091 8.79086 15 11 15Z" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10"/>
                        <path d="M13.5404 2.49103L12.4441 3.94267C11.3699 3.71161 10.2572 3.72873 9.19062 3.99275L8.04466 2.58391C6.85499 2.99056 5.76529 3.64532 4.84772 4.50483L5.55365 6.17806C4.82035 6.99581 4.28318 7.97002 3.98299 9.02659L2.19116 9.31422C1.94616 10.5476 1.96542 11.8188 2.24768 13.0442L4.05324 13.2691C4.38773 14.3157 4.96116 15.27 5.72815 16.0567L5.07906 17.7564C6.02859 18.5807 7.14198 19.1945 8.34591 19.5574L9.44108 18.1104C10.5154 18.3413 11.6283 18.3245 12.6951 18.0613L13.8405 19.4692C15.0302 19.0626 16.12 18.4079 17.0375 17.5483L16.3321 15.876C17.0654 15.0576 17.6027 14.0829 17.9031 13.0259L19.6949 12.7382C19.9396 11.5049 19.9203 10.2337 19.6384 9.00827L17.8291 8.77918C17.4946 7.73265 16.9211 6.77831 16.1541 5.99166L16.8023 4.29248C15.8544 3.46841 14.7427 2.85442 13.5404 2.49103Z" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10"/>
                      </svg>
                      {t("models.providerMenu2")}
                    </div>,
                  onClick: openModelPopup,
                },
                { label:
                    <div className="provider-edit-menu-item">
                      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
                        <path d="M3 5H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M17 7V18.2373C16.9764 18.7259 16.7527 19.1855 16.3778 19.5156C16.0029 19.8457 15.5075 20.0192 15 19.9983H7C6.49249 20.0192 5.99707 19.8457 5.62221 19.5156C5.24735 19.1855 5.02361 18.7259 5 18.2373V7" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                        <path d="M8 10.04L14 16.04" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                        <path d="M14 10.04L8 16.04" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                      <path d="M13.5 2H8.5C8.22386 2 8 2.22386 8 2.5V4.5C8 4.77614 8.22386 5 8.5 5H13.5C13.7761 5 14 4.77614 14 4.5V2.5C14 2.22386 13.7761 2 13.5 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                      </svg>
                      {t("models.providerMenu3")}
                    </div>,
                  onClick: () => onDeleteGroup(group),
                  active: !isOAP,
                },
              ].filter(option => option.active !== undefined ? option.active : true)
            }
          }}
        >
          <div className="provider-edit-menu">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 22 22" width="25" height="25">
              <path fill="currentColor" d="M19 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM11 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM3 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"></path>
            </svg>
          </div>
        </Dropdown>
      </div>
      <div className="provider-col-8"></div>
    </div>
  )
}

export default memo(GroupItem)