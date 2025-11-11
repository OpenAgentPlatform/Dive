import { useMemo } from "react"
import { Tool } from "../../../../atoms/toolState"
import { OAPMCPServer } from "../../../../../types/oap"
import { ToolsCache } from "../utils/constants"
import { isOapTool, isConnector } from "../utils/toolHelpers"

interface UseToolsSortingProps {
  tools: Tool[]
  oapTools: OAPMCPServer[]
  mcpConfig: { mcpServers: Record<string, any> }
  toolsCache: ToolsCache
  toolType: "all" | "oap" | "custom"
  isResort: boolean
  setIsResort: (resort: boolean) => void
  sortedConfigOrderRef: React.MutableRefObject<string[]>
  isLoggedInOAP: boolean
}

export const useToolsSorting = ({
  tools,
  oapTools,
  mcpConfig,
  toolsCache,
  toolType,
  isResort,
  setIsResort,
  sortedConfigOrderRef,
  isLoggedInOAP,
}: UseToolsSortingProps) => {
  const sortedTools = useMemo(() => {
    const configOrder = mcpConfig.mcpServers ? Object.keys(mcpConfig.mcpServers) : []
    const toolSort = (a: string, b: string) => {
      const aIsOap = oapTools?.find(oapTool => oapTool.name === a)
      const aEnabled = tools.find(tool => tool.name === a)?.enabled
      const bEnabled = tools.find(tool => tool.name === b)?.enabled
      if (isResort) {
        if (aEnabled && !bEnabled)
          return -1
        if (!aEnabled && bEnabled)
          return 1
        return aIsOap ? -1 : 1
      } else {
        const aIndex = sortedConfigOrderRef.current.indexOf(a)
        const bIndex = sortedConfigOrderRef.current.indexOf(b)
        return aIndex - bIndex
      }
    }

    const sortedConfigOrder = configOrder.sort(toolSort)
    if (isResort) {
      sortedConfigOrderRef.current = sortedConfigOrder
    }
    setIsResort(false)
    const toolMap = new Map(
      tools.filter(tool => !(isOapTool(tool.name, oapTools) && !isLoggedInOAP))
        .map(tool => [tool.name, tool])
    )

    const configTools = sortedConfigOrder.map(name => {
      if (toolMap.has(name)) {
        const tool = toolMap.get(name)!
        return {
          ...tool,
          disabled: Boolean(tool?.error),
          toolType: isConnector(name, mcpConfig) ? "connector" : "tool",
          sourceType: isOapTool(name, oapTools) && oapTools.find(oapTool => oapTool.name === name) ? "oap" : "custom",
          plan: isOapTool(name, oapTools) ? oapTools?.find(oapTool => oapTool.name === name)?.plan : undefined,
          oapId: isOapTool(name, oapTools) ? oapTools?.find(oapTool => oapTool.name === name)?.id : undefined,
        }
      }

      const cachedTool = toolsCache[name]
      const mcpServers = mcpConfig.mcpServers
      if (cachedTool) {
        return {
          name,
          description: cachedTool.description,
          icon: cachedTool.icon,
          enabled: false,
          tools: cachedTool.subTools.map(subTool => ({
            name: subTool.name,
            description: subTool.description,
            enabled: subTool.enabled,
          })),
          url: mcpServers[name]?.url,
          error: mcpServers[name]?.error,
          disabled: Boolean(mcpServers[name]?.disabled || mcpServers[name]?.error),
          toolType: isConnector(name, mcpConfig) ? "connector" : "tool",
          sourceType: isOapTool(name, oapTools) && oapTools.find(oapTool => oapTool.name === name) ? "oap" : "custom",
          plan: isOapTool(name, oapTools) ? oapTools?.find(oapTool => oapTool.name === name)?.plan : undefined,
          oapId: isOapTool(name, oapTools) ? oapTools?.find(oapTool => oapTool.name === name)?.id : undefined
        }
      }

      return {
        name,
        description: "",
        enabled: false,
        url: mcpServers[name]?.url,
        disabled: Boolean(mcpServers[name]?.disabled || mcpServers[name]?.error),
        toolType: isConnector(name, mcpConfig) ? "connector" : "tool",
        sourceType: isOapTool(name, oapTools) && oapTools.find(oapTool => oapTool.name === name) ? "oap" : "custom",
        plan: isOapTool(name, oapTools) ? oapTools?.find(oapTool => oapTool.name === name)?.plan : undefined,
        oapId: isOapTool(name, oapTools) ? oapTools?.find(oapTool => oapTool.name === name)?.id : undefined
      }
    })

    return [...configTools].filter(tool => toolType === "all" || toolType === tool.sourceType)
  }, [tools, oapTools, mcpConfig.mcpServers, toolType, isResort, setIsResort, sortedConfigOrderRef, toolsCache, isLoggedInOAP])

  return {
    sortedTools,
  }
}
