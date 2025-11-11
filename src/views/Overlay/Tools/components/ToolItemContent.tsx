import React from "react"
import { Tool } from "../../../../atoms/toolState"
import SubToolsList from "./SubToolsList"

interface ToolItemContentProps {
  tool: Tool
  changingToolRef: React.MutableRefObject<Tool | null>
  isLoading: boolean
  loadingTools: string[]
  onSubToolToggle: (tool: Tool, subToolName: string, action: "add" | "remove") => void
  onSaveClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  onClickOutside: (event?: MouseEvent) => void
}

const ToolItemContent: React.FC<ToolItemContentProps> = ({
  tool,
  changingToolRef,
  isLoading,
  loadingTools,
  onSubToolToggle,
  onSaveClick,
  onClickOutside,
}) => {
  if (!tool.description && !tool.tools?.length && !tool.error) {
    return null
  }

  return (
    <div
      onClick={(e) => {
        if (changingToolRef.current?.name === tool.name) {
          e.stopPropagation()
        }
      }}
    >
      <div className="tool-content-container">
        {tool.error ? (
          <div className="tool-content">
            <div className="sub-tool-error" onClick={e => e.stopPropagation()}>
              <svg width="18px" height="18px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
                <line x1="12" y1="6" x2="12" y2="14" stroke="currentColor" strokeWidth="2"/>
                <circle cx="12" cy="17" r="1.5" fill="currentColor"/>
              </svg>
              <div className="sub-tool-error-text">
                <div className="sub-tool-error-text-title">Error Message</div>
                <div className="sub-tool-error-text-content">{tool.error}</div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {tool.description && (
              <div className="tool-content">
                <div className="tool-description">{tool.description}</div>
              </div>
            )}
            {tool.tools && tool.tools.length > 0 && (
              <SubToolsList
                tool={tool}
                changingToolRef={changingToolRef}
                isLoading={isLoading}
                loadingTools={loadingTools}
                onSubToolToggle={onSubToolToggle}
                onSaveClick={onSaveClick}
                onClickOutside={onClickOutside}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default ToolItemContent

