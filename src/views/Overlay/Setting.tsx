import React, { useEffect } from "react"
import PopupWindow from "../../components/PopupWindow"
import "../../styles/overlay/_Setting.scss"
import Model from "./Model"
import Tools from "./Tools"
import System from "./System"
import Account from "./Account"
import { useAtomValue, useSetAtom } from "jotai"
import { openOverlayAtom } from "../../atoms/layerState"
import { useTranslation } from "react-i18next"
import { imgPrefix } from "../../ipc"
import { OAP_ROOT_URL } from "../../../shared/oap"
import { openUrl } from "../../ipc/util"
import { isLoggedInOAPAtom } from "../../atoms/oapState"
import { version } from "../../../package.json"
import { settingTabAtom } from "../../atoms/globalState"

const tabs = ["Tools", "Model", "Account", "System"] as const
export type Tab = (typeof tabs)[number]
export type Subtab = "Connector" | "Custom"

const Setting = ({ _tab, _subtab, _tabdata }: { _tab: Tab, _subtab?: Subtab, _tabdata?: any }) => {
  const { t } = useTranslation()
  const openOverlay = useSetAtom(openOverlayAtom)
  const isLoggedInOAP = useAtomValue(isLoggedInOAPAtom)
  const setSettingTab = useSetAtom(settingTabAtom)

  useEffect(() => {
    setSettingTab(_tab)
  }, [_tab])

  const handleOAP = () => {
    openUrl(`${OAP_ROOT_URL}/u/dashboard`)
  }

  return (
    <PopupWindow overlay>
      <div className="setting-container-wrapper">
        <div className="setting-container">
          <div className="setting-sidebar">
            <div className="setting-sidebar-items">
              <div className="setting-sidebar-category">
                <div className="setting-sidebar-category-left">
                  <span>{t("sidebar.manageAndSettings")}</span>
                </div>
              </div>
              {tabs.map((__tab) => (
                <div
                  key={__tab}
                  className="setting-sidebar-item-wrap"
                >
                  <div
                    className={`setting-sidebar-item ${__tab === _tab ? "active" : ""}`}
                    onClick={() => openOverlay({ page: "Setting", tab: __tab })}
                  >
                    {t(`setting.tabs.${__tab}`)}
                  </div>
                </div>
              ))}
              {isLoggedInOAP && (
                <div className="setting-sidebar-item-wrap setting-sidebar-link" onClick={handleOAP}>
                  <div className="setting-sidebar-item link">
                    <div className="setting-sidebar-item-left">
                      <img src={`${imgPrefix}logo_oap.png`} alt="oap" className="provider-icon no-filter" />
                      {t("sidebar.OAPhub")}
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 17 16" fill="none">
                      <path d="M3.83333 14C3.46667 14 3.15278 13.8694 2.89167 13.6083C2.63056 13.3472 2.5 13.0333 2.5 12.6667V3.33333C2.5 2.96667 2.63056 2.65278 2.89167 2.39167C3.15278 2.13056 3.46667 2 3.83333 2H7.83333C8.02222 2 8.18056 2.06389 8.30833 2.19167C8.43611 2.31944 8.5 2.47778 8.5 2.66667C8.5 2.85556 8.43611 3.01389 8.30833 3.14167C8.18056 3.26944 8.02222 3.33333 7.83333 3.33333H3.83333V12.6667H13.1667V8.66667C13.1667 8.47778 13.2306 8.31944 13.3583 8.19167C13.4861 8.06389 13.6444 8 13.8333 8C14.0222 8 14.1806 8.06389 14.3083 8.19167C14.4361 8.31944 14.5 8.47778 14.5 8.66667V12.6667C14.5 13.0333 14.3694 13.3472 14.1083 13.6083C13.8472 13.8694 13.5333 14 13.1667 14H3.83333ZM13.1667 4.26667L7.43333 10C7.31111 10.1222 7.15556 10.1833 6.96667 10.1833C6.77778 10.1833 6.62222 10.1222 6.5 10C6.37778 9.87778 6.31667 9.72222 6.31667 9.53333C6.31667 9.34444 6.37778 9.18889 6.5 9.06667L12.2333 3.33333H10.5C10.3111 3.33333 10.1528 3.26944 10.025 3.14167C9.89722 3.01389 9.83333 2.85556 9.83333 2.66667C9.83333 2.47778 9.89722 2.31944 10.025 2.19167C10.1528 2.06389 10.3111 2 10.5 2H13.8333C14.0222 2 14.1806 2.06389 14.3083 2.19167C14.4361 2.31944 14.5 2.47778 14.5 2.66667V6C14.5 6.18889 14.4361 6.34722 14.3083 6.475C14.1806 6.60278 14.0222 6.66667 13.8333 6.66667C13.6444 6.66667 13.4861 6.60278 13.3583 6.475C13.2306 6.34722 13.1667 6.18889 13.1667 6V4.26667Z" fill="currentColor"/>
                    </svg>
                  </div>
                </div>
              )}
              <div className="setting-sidebar-version">
                ver:v{version}
              </div>
            </div>
          </div>
          <div className="setting-content">
            {(() => {
              switch (_tab) {
                case "Model":
                  return <Model />
                case "Tools":
                  return <Tools _subtab={_subtab as Subtab} _tabdata={_tabdata} />
                case "Account":
                  return <Account />
                case "System":
                  return <System />
                default:
                  return null
              }
            })()}
          </div>
        </div>
      </div>
    </PopupWindow>
  )
}

export default React.memo(Setting)