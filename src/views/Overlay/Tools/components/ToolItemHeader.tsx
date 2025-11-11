import React from "react"
import { useTranslation } from "react-i18next"
import { Tool } from "../../../../atoms/toolState"
import Switch from "../../../../components/Switch"
import Tooltip from "../../../../components/Tooltip"
import Dropdown from "../../../../components/DropDown"
import Button from "../../../../components/Button"
import { imgPrefix } from "../../../../ipc"
import { OAP_ROOT_URL } from "../../../../../shared/oap"
import { openUrl } from "../../../../ipc/util"

interface ToolItemHeaderProps {
  tool: Tool & { sourceType?: string; plan?: string; oapId?: string; toolType?: string }
  loadingTools: string[]
  toolMenu: any
  onToggle: () => void
  onConnectorConnect?: () => void
}

const ToolItemHeader: React.FC<ToolItemHeaderProps> = ({
  tool,
  loadingTools,
  toolMenu,
  onToggle,
  onConnectorConnect,
}) => {
  const { t } = useTranslation()

  return (
    <div className="tool-header-container">
      <div className="tool-header">
        <div className="tool-header-content">
          <div className="tool-status-light">
            {loadingTools.includes(tool.name) ? (
              <div className="loading-spinner" style={{ width: "16px", height: "16px" }}></div>
            ) : (
              <>
                {tool.enabled && !tool.disabled && (
                  <svg className="tool-status-light-icon success" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4" />
                    <circle cx="50" cy="50" r="25" fill="currentColor" />
                  </svg>
                )}
                {tool.enabled && tool.disabled && tool.status !== "unauthorized" && (
                  <svg className="tool-status-light-icon danger" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4" />
                    <circle cx="50" cy="50" r="25" fill="currentColor" />
                  </svg>
                )}
                {tool.enabled && tool.disabled && tool.status === "unauthorized" && (
                  <svg className="tool-status-light-icon warning" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4" />
                    <circle cx="50" cy="50" r="25" fill="currentColor" />
                  </svg>
                )}
              </>
            )}
          </div>
          {tool.sourceType === "oap" ? (
            <img className="tool-header-content-icon oap-logo" src={`${imgPrefix}logo_oap.png`} alt="info" />
          ) : (
            <svg className="tool-header-content-icon" width="20" height="20" viewBox="0 0 24 24">
              <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
            </svg>
          )}
          <span className="tool-name">{tool.name}</span>
          {tool.sourceType === "oap" && (
            <>
              <div className={`tool-tag ${tool.plan}`}>
                {tool.plan}
              </div>
              <Tooltip content={t("tools.oapStoreLinkAlt")}>
                <button className="oap-store-link" onClick={(e) => {
                  e.stopPropagation()
                  openUrl(`${OAP_ROOT_URL}/mcp/${tool.oapId}`)
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 17 16" fill="none">
                    <path d="M3.83333 14C3.46667 14 3.15278 13.8694 2.89167 13.6083C2.63056 13.3472 2.5 13.0333 2.5 12.6667V3.33333C2.5 2.96667 2.63056 2.65278 2.89167 2.39167C3.15278 2.13056 3.46667 2 3.83333 2H7.83333C8.02222 2 8.18056 2.06389 8.30833 2.19167C8.43611 2.31944 8.5 2.47778 8.5 2.66667C8.5 2.85556 8.43611 3.01389 8.30833 3.14167C8.18056 3.26944 8.02222 3.33333 7.83333 3.33333H3.83333V12.6667H13.1667V8.66667C13.1667 8.47778 13.2306 8.31944 13.3583 8.19167C13.4861 8.06389 13.6444 8 13.8333 8C14.0222 8 14.1806 8.06389 14.3083 8.19167C14.4361 8.31944 14.5 8.47778 14.5 8.66667V12.6667C14.5 13.0333 14.3694 13.3472 14.1083 13.6083C13.8472 13.8694 13.5333 14 13.1667 14H3.83333ZM13.1667 4.26667L7.43333 10C7.31111 10.1222 7.15556 10.1833 6.96667 10.1833C6.77778 10.1833 6.62222 10.1222 6.5 10C6.37778 9.87778 6.31667 9.72222 6.31667 9.53333C6.31667 9.34444 6.37778 9.18889 6.5 9.06667L12.2333 3.33333H10.5C10.3111 3.33333 10.1528 3.26944 10.025 3.14167C9.89722 3.01389 9.83333 2.85556 9.83333 2.66667C9.83333 2.47778 9.89722 2.31944 10.025 2.19167C10.1528 2.06389 10.3111 2 10.5 2H13.8333C14.0222 2 14.1806 2.06389 14.3083 2.19167C14.4361 2.31944 14.5 2.47778 14.5 2.66667V6C14.5 6.18889 14.4361 6.34722 14.3083 6.475C14.1806 6.60278 14.0222 6.66667 13.8333 6.66667C13.6444 6.66667 13.4861 6.60278 13.3583 6.475C13.2306 6.34722 13.1667 6.18889 13.1667 6V4.26667Z" fill="currentColor"/>
                  </svg>
                </button>
              </Tooltip>
            </>
          )}
          {tool.toolType === "connector" && tool.sourceType !== "oap" && (
            <div className="tool-tag">
              Connector
            </div>
          )}
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <Dropdown options={toolMenu}>
            <div className="tool-edit-menu">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 22 22" width="25" height="25">
                <path fill="currentColor" d="M19 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM11 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM3 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"></path>
              </svg>
            </div>
          </Dropdown>
        </div>
        {tool.disabled && tool.enabled && tool.status !== "unauthorized" && (
          <div className="tool-disabled-label">{t("tools.startFailed")}</div>
        )}
        {tool.disabled && !tool.enabled && (
          <div className="tool-disabled-label">{t("tools.installFailed")}</div>
        )}
        {tool.disabled && tool.enabled && tool.status === "unauthorized" && onConnectorConnect && (
          <Button
            theme="Color"
            color="neutralGray"
            size="medium"
            onClick={(e) => {
              e.stopPropagation()
              onConnectorConnect()
            }}
          >
            {t("tools.toolMenu.connect")}
          </Button>
        )}
        <div className="tool-switch-container">
          <Switch
            color={(tool.disabled && tool.status !== "unauthorized") ? "danger" : "primary"}
            checked={tool.enabled}
            onChange={onToggle}
          />
        </div>
        <span className="tool-toggle">
          {(tool.description || (tool.tools?.length ?? 0) > 0 || tool.error) && "▼"}
        </span>
      </div>
      {!tool.enabled && (
        <div className="tool-content-sub-title">
          {t("tools.disabledDescription")}
        </div>
      )}
      {tool.enabled && tool.toolType !== "connector" && (
        tool.status === "running" ? (
          tool.tools && tool.tools.length > 0 ? (
            <div className="tool-content-sub-title">
              <span>
                {t("tools.subToolsCount", {
                  count: tool.tools?.filter(subTool => subTool.enabled).length || 0,
                  total: tool.tools?.length || 0
                })}
              </span>
            </div>
          ) : null
        ) : (
          <div className="tool-content-sub-title danger">
            <span>{t("tools.subTitle.startFailed")}</span>
          </div>
        )
      )}
      {tool.enabled && tool.toolType === "connector" && (
        <div className={`tool-content-sub-title ${tool.status === "failed" && "danger"} ${tool.status === "unauthorized" && "warning"}`}>
          {tool.status === "running" && (
            <>
              <span>{tool.url}</span>
              {tool.tools && tool.tools.length > 0 && (
                <span>
                  {t("tools.subToolsCount", {
                    count: tool.tools?.filter(subTool => subTool.enabled).length || 0,
                    total: tool.tools?.length || 0
                  })}
                </span>
              )}
            </>
          )}
          {tool.status === "failed" && (
            <span>{t("tools.subTitle.startFailed")}</span>
          )}
          {tool.status === "unauthorized" && (
            <span>{t("tools.subTitle.notAuthorized")}</span>
          )}
        </div>
      )}
    </div>
  )
}

export default ToolItemHeader

