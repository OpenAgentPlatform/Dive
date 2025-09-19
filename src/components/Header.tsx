import React from "react"
import { useAtom, useSetAtom } from "jotai"
import { sidebarVisibleAtom, toggleSidebarAtom } from "../atoms/sidebarState"
import { useTranslation } from "react-i18next"
import { keymapModalVisibleAtom } from "../atoms/modalState"
import ModelSelect from "./ModelSelect"
import Tooltip from "./Tooltip"
import UpdateButton from "./UpdateButton"

type Props = {
  showHelpButton?: boolean
  showModelSelect?: boolean
}

const Header = ({ showHelpButton = false, showModelSelect = false }: Props) => {
  const toggleSidebar = useSetAtom(toggleSidebarAtom)
  const { t } = useTranslation()
  const setKeymapModalVisible = useSetAtom(keymapModalVisibleAtom)
  const [isSidebarVisible] = useAtom(sidebarVisibleAtom)

  const onClose = () => {
    toggleSidebar()
  }

  return (
    <div className={`app-header ${isSidebarVisible ? "sidebar-visible" : ""}`}>
      <div className="header-content">
        <div className="left-side">
          <div className="menu-container">
            <Tooltip
              content={isSidebarVisible ? t("header.closeSidebar") : t("header.openSidebar")}
            >
              <button
                className={`menu-btn ${isSidebarVisible ? "close-sidebar-btn" : ""}`}
                onClick={onClose}
              >
                <svg className="open-sidebar-btn-icon" width="24" height="24" viewBox="0 0 24 24">
                  <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
                </svg>
                <svg className="close-sidebar-btn-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 30 30" fill="none">
                  <path d="M8 22L8 7.27273" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M25 15.75C25.4142 15.75 25.75 15.4142 25.75 15C25.75 14.5858 25.4142 14.25 25 14.25V15V15.75ZM11.4697 14.4697C11.1768 14.7626 11.1768 15.2374 11.4697 15.5303L16.2426 20.3033C16.5355 20.5962 17.0104 20.5962 17.3033 20.3033C17.5962 20.0104 17.5962 19.5355 17.3033 19.2426L13.0607 15L17.3033 10.7574C17.5962 10.4645 17.5962 9.98959 17.3033 9.6967C17.0104 9.40381 16.5355 9.40381 16.2426 9.6967L11.4697 14.4697ZM25 15V14.25L12 14.25V15V15.75L25 15.75V15Z" fill="currentColor"/>
                </svg>
              </button>
            </Tooltip>
            <h1>{t("header.title")}</h1>
            {showModelSelect && <ModelSelect />}
          </div>
        </div>
        {showHelpButton && (
          <div className="right-side">
            <UpdateButton />
            <button
              className="help-btn"
              onMouseEnter={() => setKeymapModalVisible(true)}
              onMouseLeave={() => setKeymapModalVisible(false)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default React.memo(Header)