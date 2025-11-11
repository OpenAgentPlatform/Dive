import React from "react"
import { Tool } from "../../../../atoms/toolState"
import ToolItemHeader from "./ToolItemHeader"
import ToolItemContent from "./ToolItemContent"

interface ToolItemProps {
  tool: Tool & { sourceType?: string; plan?: string; oapId?: string; toolType?: string }
  index: number
  expandedSections: string[]
  loadingTools: string[]
  changingToolRef: React.MutableRefObject<Tool | null>
  isLoading: boolean
  toolMenu: any
  onToggleSection: (name: string) => void
  onToggleTool: () => void
  onConnectorConnect?: () => void
  onSubToolToggle: (tool: Tool, subToolName: string, action: "add" | "remove") => void
  onSaveClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  onClickOutside: (event?: MouseEvent) => void
}

const ToolItem: React.FC<ToolItemProps> = ({
  tool,
  index,
  expandedSections,
  loadingTools,
  changingToolRef,
  isLoading,
  toolMenu,
  onToggleSection,
  onToggleTool,
  onConnectorConnect,
  onSubToolToggle,
  onSaveClick,
  onClickOutside,
}) => {
  // Use changingToolRef.current if this tool is being edited
  const displayTool = (changingToolRef.current?.name === tool.name ? changingToolRef.current : tool) as typeof tool

  return (
    <div
      key={displayTool.name}
      id={`tool-${index}`}
      onClick={() => onToggleSection(displayTool.name)}
      className={`tool-section
        ${displayTool.disabled ? "disabled" : ""}
        ${displayTool.enabled ? "enabled" : ""}
        ${expandedSections.includes(displayTool.name) ? "expanded" : ""}
        ${loadingTools.includes(displayTool.name) ? "loading" : ""}
      `}
    >
      <ToolItemHeader
        tool={displayTool}
        loadingTools={loadingTools}
        toolMenu={toolMenu}
        onToggle={onToggleTool}
        onConnectorConnect={onConnectorConnect}
      />
      {(displayTool.description || (displayTool.tools?.length ?? 0) > 0 || displayTool.error) && (
        <ToolItemContent
          tool={displayTool}
          changingToolRef={changingToolRef}
          isLoading={isLoading}
          loadingTools={loadingTools}
          onSubToolToggle={onSubToolToggle}
          onSaveClick={onSaveClick}
          onClickOutside={onClickOutside}
        />
      )}
    </div>
  )
}

export default ToolItem

