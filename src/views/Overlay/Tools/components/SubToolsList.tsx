import React from "react"
import { useTranslation } from "react-i18next"
import { ClickOutside } from "../../../../components/ClickOutside"
import Button from "../../../../components/Button"
import Tooltip from "../../../../components/Tooltip"
import { Tool } from "../../../../atoms/toolState"

interface SubToolsListProps {
  tool: Tool
  changingToolRef: React.MutableRefObject<Tool | null>
  isLoading: boolean
  loadingTools: string[]
  onSubToolToggle: (tool: Tool, subToolName: string, action: "add" | "remove") => void
  onSaveClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  onClickOutside: (event?: MouseEvent) => void
}

const SubToolsList: React.FC<SubToolsListProps> = ({
  tool,
  changingToolRef,
  isLoading,
  loadingTools,
  onSubToolToggle,
  onSaveClick,
  onClickOutside,
}) => {
  const { t } = useTranslation()

  if (!tool.tools || tool.tools.length === 0) {
    return null
  }

  return (
    <ClickOutside onClickOutside={onClickOutside}>
      <div className="tool-content">
        <div className="sub-tools">
          {tool.tools.map((subTool, subIndex) => (
            <Tooltip
              key={subIndex}
              content={subTool.description}
              disabled={!subTool.description}
              align="start"
            >
              <Button
                theme="Color"
                color="neutralGray"
                size="medium"
                active={subTool.enabled && tool.enabled}
                onClick={(e) => {
                  e.stopPropagation()
                  onSubToolToggle(
                    tool,
                    subTool.name,
                    (!subTool.enabled || !tool.enabled) ? "remove" : "add"
                  )
                }}
              >
                <div className="sub-tool-name">{subTool.name}</div>
              </Button>
            </Tooltip>
          ))}
        </div>
      </div>
      <div className="sub-tools-footer">
        <Button
          theme="Color"
          color="neutralGray"
          size="medium"
          active={changingToolRef.current?.name === tool.name}
          disabled={
            changingToolRef.current === null ||
            changingToolRef.current.name !== tool.name ||
            isLoading ||
            loadingTools.includes(changingToolRef.current?.name ?? "")
          }
          onClick={onSaveClick}
        >
          {t("common.save")}
        </Button>
      </div>
    </ClickOutside>
  )
}

export default SubToolsList

