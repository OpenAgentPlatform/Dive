import React from "react"
import { useTranslation } from "react-i18next"

export interface ActiveToolCall {
  toolCallId: string
  name: string
  args: any
  startTime: number
}

interface Props {
  toolCalls: Map<string, ActiveToolCall>
}

const ActiveToolsPanel: React.FC<Props> = ({ toolCalls }) => {
  const { t } = useTranslation()

  if (toolCalls.size === 0) {
    return null
  }

  const toolCallsArray = Array.from(toolCalls.values())

  return (
    <div className="active-tools-panel">
      <div className="active-tools-list">
        {toolCallsArray.map((tool) => (
          <div key={tool.toolCallId} className="active-tool-item">
            <div className="active-tool-spinner" />
            <span className="active-tool-name">{tool.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default React.memo(ActiveToolsPanel)
