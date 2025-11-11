import React from "react"
import { useTranslation } from "react-i18next"
import Tooltip from "../../../../components/Tooltip"
import Button from "../../../../components/Button"
import { imgPrefix } from "../../../../ipc"

interface ToolsHeaderProps {
  isLoggedInOAP: boolean
  onOapClick: () => void
  onConnectorClick: () => void
  onCustomClick: () => void
  onReloadClick: () => void
}

const ToolsHeader: React.FC<ToolsHeaderProps> = ({
  isLoggedInOAP,
  onOapClick,
  onConnectorClick,
  onCustomClick,
  onReloadClick,
}) => {
  const { t } = useTranslation()

  return (
    <div className="tools-header">
      <div>{t("tools.title")}</div>
      <div className="header-actions">
        {isLoggedInOAP && (
          <Tooltip content={t("tools.oap.headerBtnAlt")}>
            <Button
              theme="Color"
              color="primary"
              size="medium"
              onClick={onOapClick}
            >
              <img className="oap-logo" src={`${imgPrefix}logo_oap.png`} alt="info" />
              OAPhub
            </Button>
          </Tooltip>
        )}

        <Tooltip content={t("tools.connector.headerBtnAlt")}>
          <Button
            theme="Color"
            color="primary"
            size="medium"
            onClick={onConnectorClick}
          >
            {t("tools.connector.headerBtn")}
          </Button>
        </Tooltip>

        <Tooltip content={t("tools.custom.headerBtnAlt")}>
          <Button
            theme="Color"
            color="success"
            size="medium"
            onClick={onCustomClick}
          >
            {t("tools.custom.headerBtn")}
          </Button>
        </Tooltip>

        <Tooltip content={t("tools.reload.headerBtnAlt")}>
          <Button
            className="reload-btn"
            theme="Color"
            color="neutralGray"
            size="medium"
            onClick={onReloadClick}
          >
            <svg width="16" height="16" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g clipPath="url(#clip0_6_586)">
                <path d="M11 5C9.41775 5 7.87103 5.46919 6.55544 6.34824C5.23985 7.22729 4.21446 8.47672 3.60896 9.93853C3.00346 11.4003 2.84504 13.0089 3.15372 14.5607C3.4624 16.1126 4.22433 17.538 5.34315 18.6569C6.46197 19.7757 7.88743 20.5376 9.43928 20.8463C10.9911 21.155 12.5997 20.9965 14.0615 20.391C15.5233 19.7855 16.7727 18.7602 17.6518 17.4446C18.5308 16.129 19 14.5823 19 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
                <path d="M16.4382 5.40544C16.7147 5.20587 16.7147 4.79413 16.4382 4.59456L11.7926 1.24188C11.4619 1.00323 11 1.23952 11 1.64733L11 8.35267C11 8.76048 11.4619 8.99676 11.7926 8.75812L16.4382 5.40544Z" fill="currentColor"/>
              </g>
              <defs>
                <clipPath id="clip0_6_586">
                  <rect width="22" height="22" fill="currentColor" transform="matrix(-1 0 0 1 22 0)"/>
                </clipPath>
              </defs>
            </svg>
            {t("tools.reload.headerBtn")}
          </Button>
        </Tooltip>
      </div>
    </div>
  )
}

export default ToolsHeader

