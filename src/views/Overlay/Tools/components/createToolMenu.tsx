import React from "react"
import { Tool } from "../../../../atoms/toolState"
import { OAP_ROOT_URL } from "../../../../../shared/oap"
import { openUrl } from "../../../../ipc/util"
import { isConnector } from "../utils/toolHelpers"
import { TFunction } from "i18next"

interface CreateToolMenuProps {
  tool: Tool & { sourceType?: string; plan?: string; oapId?: string }
  oapTools: any[]
  mcpConfig: any
  onReload: () => void
  onEdit: () => void
  onDisconnect: () => void
  onConnect: () => void
  onDelete: () => void
  t: TFunction
}

export const createToolMenu = ({
  tool,
  oapTools,
  mcpConfig,
  onReload,
  onEdit,
  onDisconnect,
  onConnect,
  onDelete,
  t,
}: CreateToolMenuProps) => {
  const isOapTool = oapTools?.find(oapTool => oapTool.name === tool.name) ? true : false

  return {
    "root": {
      subOptions: [
        {
          label: (
            <div className="tool-edit-menu-item">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 17 16" fill="none">
                <path d="M3.83333 14C3.46667 14 3.15278 13.8694 2.89167 13.6083C2.63056 13.3472 2.5 13.0333 2.5 12.6667V3.33333C2.5 2.96667 2.63056 2.65278 2.89167 2.39167C3.15278 2.13056 3.46667 2 3.83333 2H7.83333C8.02222 2 8.18056 2.06389 8.30833 2.19167C8.43611 2.31944 8.5 2.47778 8.5 2.66667C8.5 2.85556 8.43611 3.01389 8.30833 3.14167C8.18056 3.26944 8.02222 3.33333 7.83333 3.33333H3.83333V12.6667H13.1667V8.66667C13.1667 8.47778 13.2306 8.31944 13.3583 8.19167C13.4861 8.06389 13.6444 8 13.8333 8C14.0222 8 14.1806 8.06389 14.3083 8.19167C14.4361 8.31944 14.5 8.47778 14.5 8.66667V12.6667C14.5 13.0333 14.3694 13.3472 14.1083 13.6083C13.8472 13.8694 13.5333 14 13.1667 14H3.83333ZM13.1667 4.26667L7.43333 10C7.31111 10.1222 7.15556 10.1833 6.96667 10.1833C6.77778 10.1833 6.62222 10.1222 6.5 10C6.37778 9.87778 6.31667 9.72222 6.31667 9.53333C6.31667 9.34444 6.37778 9.18889 6.5 9.06667L12.2333 3.33333H10.5C10.3111 3.33333 10.1528 3.26944 10.025 3.14167C9.89722 3.01389 9.83333 2.85556 9.83333 2.66667C9.83333 2.47778 9.89722 2.31944 10.025 2.19167C10.1528 2.06389 10.3111 2 10.5 2H13.8333C14.0222 2 14.1806 2.06389 14.3083 2.19167C14.4361 2.31944 14.5 2.47778 14.5 2.66667V6C14.5 6.18889 14.4361 6.34722 14.3083 6.475C14.1806 6.60278 14.0222 6.66667 13.8333 6.66667C13.6444 6.66667 13.4861 6.60278 13.3583 6.475C13.2306 6.34722 13.1667 6.18889 13.1667 6V4.26667Z" fill="currentColor"/>
              </svg>
              {t("tools.toolMenu.detail")}
            </div>
          ),
          onClick: () => {
            openUrl(`${OAP_ROOT_URL}/mcp/${tool.oapId}`)
          },
          active: isOapTool
        },
        {
          label: (
            <div className="tool-edit-menu-item">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g clipPath="url(#clip0_6_586_reload)">
                  <path d="M11 5C9.41775 5 7.87103 5.46919 6.55544 6.34824C5.23985 7.22729 4.21446 8.47672 3.60896 9.93853C3.00346 11.4003 2.84504 13.0089 3.15372 14.5607C3.4624 16.1126 4.22433 17.538 5.34315 18.6569C6.46197 19.7757 7.88743 20.5376 9.43928 20.8463C10.9911 21.155 12.5997 20.9965 14.0615 20.391C15.5233 19.7855 16.7727 18.7602 17.6518 17.4446C18.5308 16.129 19 14.5823 19 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M16.4382 5.40544C16.7147 5.20587 16.7147 4.79413 16.4382 4.59456L11.7926 1.24188C11.4619 1.00323 11 1.23952 11 1.64733L11 8.35267C11 8.76048 11.4619 8.99676 11.7926 8.75812L16.4382 5.40544Z" fill="currentColor"/>
                </g>
                <defs>
                  <clipPath id="clip0_6_586_reload">
                    <rect width="22" height="22" fill="currentColor" transform="matrix(-1 0 0 1 22 0)"/>
                  </clipPath>
                </defs>
              </svg>
              {t("tools.toolMenu.reload")}
            </div>
          ),
          onClick: onReload,
          active: tool.enabled && tool.disabled
        },
        {
          label: (
            <div className="tool-edit-menu-item">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M3 13.6684V18.9998H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2.99991 13.5986L12.5235 4.12082C13.9997 2.65181 16.3929 2.65181 17.869 4.12082V4.12082C19.3452 5.58983 19.3452 7.97157 17.869 9.44058L8.34542 18.9183" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {t("tools.toolMenu.edit")}
            </div>
          ),
          onClick: onEdit,
          active: !isOapTool
        },
        {
          label: (
            <div className="tool-edit-menu-item">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M17.888 4.11123C16.0704 2.29365 13.1292 2.29365 11.3138 4.11123L9.23193 6.19307L10.3276 7.28877L12.4095 5.20693C13.5653 4.05107 15.5161 3.92861 16.7923 5.20693C18.0706 6.48525 17.9481 8.43389 16.7923 9.58975L14.7104 11.6716L15.8083 12.7694L17.8901 10.6876C19.7034 8.87002 19.7034 5.92881 17.888 4.11123ZM9.59287 16.7913C8.43701 17.9472 6.48623 18.0696 5.21006 16.7913C3.93174 15.513 4.0542 13.5644 5.21006 12.4085L7.29189 10.3267L6.19404 9.22881L4.11221 11.3106C2.29463 13.1282 2.29463 16.0694 4.11221 17.8849C5.92979 19.7003 8.871 19.7024 10.6864 17.8849L12.7683 15.803L11.6726 14.7073L9.59287 16.7913ZM5.59248 4.49795C5.56018 4.46596 5.51655 4.44802 5.47109 4.44802C5.42563 4.44802 5.38201 4.46596 5.34971 4.49795L4.49893 5.34873C4.46694 5.38103 4.449 5.42466 4.449 5.47012C4.449 5.51558 4.46694 5.5592 4.49893 5.5915L16.4099 17.5024C16.4765 17.569 16.586 17.569 16.6526 17.5024L17.5034 16.6517C17.57 16.5851 17.57 16.4755 17.5034 16.4089L5.59248 4.49795Z" fill="currentColor"/>
              </svg>
              {t("tools.toolMenu.disconnect")}
            </div>
          ),
          onClick: onDisconnect,
          active: tool.status === "running" && isConnector(tool.name, mcpConfig) && tool.has_credential
        },
        {
          label: (
            <div className="tool-edit-menu-item">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 18 18" fill="none">
                <path d="M16.6735 1.32098C14.9174 -0.435119 12.0404 -0.435119 10.2843 1.32098L6.83435 4.77091C8.01754 4.43463 9.3004 4.52181 10.4213 5.04491L12.2147 3.25144C12.9122 2.55399 14.0456 2.55399 14.743 3.25144C15.4405 3.9489 15.4405 5.08227 14.743 5.77973L12.4887 8.03401L11.0066 9.51611C10.3092 10.2136 9.17581 10.2136 8.47832 9.51611L6.54785 11.4466C6.99622 11.895 7.51931 12.2312 8.06731 12.4429C9.54945 13.0283 11.2682 12.8041 12.5635 11.7828C12.688 11.6832 12.825 11.5711 12.9371 11.4465L15.2661 9.11752L16.6735 7.71015C18.4421 5.95409 18.4421 3.08954 16.6735 1.32098Z" fill="currentColor"/>
                <path d="M7.49452 13.028L5.77578 14.7467C5.07832 15.4442 3.94496 15.4442 3.2475 14.7467C2.55004 14.0493 2.55004 12.916 3.2475 12.2185L6.98388 8.48211C7.68134 7.78465 8.81471 7.78465 9.51221 8.48211L11.4427 6.55165C10.9943 6.10328 10.4712 5.76701 9.92321 5.55528C8.36638 4.93255 6.53555 5.219 5.22782 6.38974C5.16555 6.43956 5.10327 6.50183 5.05346 6.55165L1.31707 10.288C-0.439025 12.0441 -0.439025 14.9211 1.31707 16.6772C3.07317 18.4333 5.95019 18.4333 7.70629 16.6772L11.0815 13.2646C9.36271 13.6631 8.96416 13.6134 7.49452 13.028Z" fill="currentColor"/>
              </svg>
              {t("tools.toolMenu.connect")}
            </div>
          ),
          onClick: onConnect,
          active: tool.enabled && tool.status === "unauthorized" && isConnector(tool.name, mcpConfig)
        },
        {
          label: (
            <div className="tool-edit-menu-item">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M3 5H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M17 7V18.2373C16.9764 18.7259 16.7527 19.1855 16.3778 19.5156C16.0029 19.8457 15.5075 20.0192 15 19.9983H7C6.49249 20.0192 5.99707 19.8457 5.62221 19.5156C5.24735 19.1855 5.02361 18.7259 5 18.2373V7" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                <path d="M8 10.04L14 16.04" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M14 10.04L8 16.04" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M13.5 2H8.5C8.22386 2 8 2.22386 8 2.5V4.5C8 4.77614 8.22386 5 8.5 5H13.5C13.7761 5 14 4.77614 14 4.5V2.5C14 2.22386 13.7761 2 13.5 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
              </svg>
              {t("tools.toolMenu.delete")}
            </div>
          ),
          onClick: onDelete,
          active: true
        },
      ].filter(option => option.active)
    }
  }
}

