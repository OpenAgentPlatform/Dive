import React from "react"
import { useTranslation } from "react-i18next"
import { Tool } from "../../../../atoms/toolState"
import Tabs from "../../../../components/Tabs"
import ToolItem from "./ToolItem"

interface ToolsListProps {
  isLoggedInOAP: boolean
  toolType: "all" | "oap" | "custom"
  setToolType: (type: "all" | "oap" | "custom") => void
  sortedTools: any[]
  isLoading: boolean
  expandedSections: string[]
  loadingTools: string[]
  changingToolRef: React.MutableRefObject<Tool | null>
  onToggleSection: (name: string) => void
  onToggleTool: (tool: Tool) => void
  onConnectorConnect: (tool: Tool) => void
  getToolMenu: (tool: any) => any
  onSubToolToggle: (tool: Tool, subToolName: string, action: "add" | "remove") => void
  onSaveClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  onClickOutside: (toolName: string, event?: MouseEvent) => void
}

const ToolsList: React.FC<ToolsListProps> = ({
  isLoggedInOAP,
  toolType,
  setToolType,
  sortedTools,
  isLoading,
  expandedSections,
  loadingTools,
  changingToolRef,
  onToggleSection,
  onToggleTool,
  onConnectorConnect,
  getToolMenu,
  onSubToolToggle,
  onSaveClick,
  onClickOutside,
}) => {
  const { t } = useTranslation()

  return (
    <div className="tools-list">
      {isLoggedInOAP && (
        <Tabs
          className="tools-type-tabs"
          tabs={[
            { label: t("tools.tab.all"), value: "all" },
            { label: t("tools.tab.oap"), value: "oap" },
            { label: t("tools.tab.custom"), value: "custom" }
          ]}
          value={toolType}
          onChange={setToolType}
        />
      )}
      {sortedTools.length === 0 && !isLoading && (
        <div className="no-oap-result-container">
          <div className="cloud-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="41" height="41" viewBox="0 0 41 41" fill="none">
              <path d="M24.4 40.3C23.9 40.5667 23.3917 40.6083 22.875 40.425C22.3583 40.2417 21.9667 39.9 21.7 39.4L18.7 33.4C18.4333 32.9 18.3917 32.3917 18.575 31.875C18.7583 31.3583 19.1 30.9667 19.6 30.7C20.1 30.4333 20.6083 30.3917 21.125 30.575C21.6417 30.7583 22.0333 31.1 22.3 31.6L25.3 37.6C25.5667 38.1 25.6083 38.6083 25.425 39.125C25.2417 39.6417 24.9 40.0333 24.4 40.3ZM36.4 40.3C35.9 40.5667 35.3917 40.6083 34.875 40.425C34.3583 40.2417 33.9667 39.9 33.7 39.4L30.7 33.4C30.4333 32.9 30.3917 32.3917 30.575 31.875C30.7583 31.3583 31.1 30.9667 31.6 30.7C32.1 30.4333 32.6083 30.3917 33.125 30.575C33.6417 30.7583 34.0333 31.1 34.3 31.6L37.3 37.6C37.5667 38.1 37.6083 38.6083 37.425 39.125C37.2417 39.6417 36.9 40.0333 36.4 40.3ZM12.4 40.3C11.9 40.5667 11.3917 40.6083 10.875 40.425C10.3583 40.2417 9.96667 39.9 9.7 39.4L6.7 33.4C6.43333 32.9 6.39167 32.3917 6.575 31.875C6.75833 31.3583 7.1 30.9667 7.6 30.7C8.1 30.4333 8.60833 30.3917 9.125 30.575C9.64167 30.7583 10.0333 31.1 10.3 31.6L13.3 37.6C13.5667 38.1 13.6083 38.6083 13.425 39.125C13.2417 39.6417 12.9 40.0333 12.4 40.3ZM11.5 28.5C8.46667 28.5 5.875 27.425 3.725 25.275C1.575 23.125 0.5 20.5333 0.5 17.5C0.5 14.7333 1.41667 12.3167 3.25 10.25C5.08333 8.18333 7.35 6.96667 10.05 6.6C11.1167 4.7 12.575 3.20833 14.425 2.125C16.275 1.04167 18.3 0.5 20.5 0.5C23.5 0.5 26.1083 1.45833 28.325 3.375C30.5417 5.29167 31.8833 7.68333 32.35 10.55C34.65 10.75 36.5833 11.7 38.15 13.4C39.7167 15.1 40.5 17.1333 40.5 19.5C40.5 22 39.625 24.125 37.875 25.875C36.125 27.625 34 28.5 31.5 28.5H11.5ZM11.5 24.5H31.5C32.9 24.5 34.0833 24.0167 35.05 23.05C36.0167 22.0833 36.5 20.9 36.5 19.5C36.5 18.1 36.0167 16.9167 35.05 15.95C34.0833 14.9833 32.9 14.5 31.5 14.5H28.5V12.5C28.5 10.3 27.7167 8.41667 26.15 6.85C24.5833 5.28333 22.7 4.5 20.5 4.5C18.9 4.5 17.4417 4.93333 16.125 5.8C14.8083 6.66667 13.8167 7.83333 13.15 9.3L12.65 10.5H11.4C9.5 10.5667 7.875 11.275 6.525 12.625C5.175 13.975 4.5 15.6 4.5 17.5C4.5 19.4333 5.18333 21.0833 6.55 22.45C7.91667 23.8167 9.56667 24.5 11.5 24.5Z" fill="currentColor"/>
            </svg>
          </div>
          <div>
            <div className="no-oap-result-title">
              {t("tools.no_tool_title")}
            </div>
            <div className="no-oap-result-message">
              {isLoggedInOAP ? t(`tools.no_oap_tool_message.${toolType}`) : t("tools.no_tool_message")}
            </div>
          </div>
        </div>
      )}
      {sortedTools.map((tool, index) => (
        <ToolItem
          key={tool.name}
          tool={tool}
          index={index}
          expandedSections={expandedSections}
          loadingTools={loadingTools}
          changingToolRef={changingToolRef}
          isLoading={isLoading}
          toolMenu={getToolMenu(tool)}
          onToggleSection={onToggleSection}
          onToggleTool={() => onToggleTool(tool)}
          onConnectorConnect={() => onConnectorConnect(tool)}
          onSubToolToggle={onSubToolToggle}
          onSaveClick={onSaveClick}
          onClickOutside={(event) => onClickOutside(tool.name, event)}
        />
      ))}
    </div>
  )
}

export default ToolsList

