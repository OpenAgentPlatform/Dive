import { useCallback } from "react"
import { Tool } from "../../../../atoms/toolState"
import { OAPMCPServer } from "../../../../../types/oap"
import { ToolsCache } from "../utils/constants"
import { isConnector } from "../utils/toolHelpers"

interface UseToolsCacheProps {
  loadTools: () => Promise<any>
  mcpConfig: { mcpServers: Record<string, any> }
  setMcpConfig: (config: any) => void
  tools: Tool[]
  setTools: (tools: any) => void
  oapTools: OAPMCPServer[]
  setOapTools: (tools: any) => void
  toolsCache: ToolsCache
  setToolsCache: (cache: ToolsCache) => void
}

export const useToolsCache = ({
  loadTools,
  mcpConfig,
  setMcpConfig,
  tools,
  setTools,
  oapTools,
  setOapTools,
  toolsCache,
  setToolsCache,
}: UseToolsCacheProps) => {
  const getMcpConfig = useCallback(() => {
    return new Promise((resolve) => {
      setMcpConfig((prevConfig: any) => {
        resolve(prevConfig)
        return prevConfig
      })
    })
  }, [setMcpConfig])

  const updateToolsCache = useCallback(async () => {
    await loadTools()
    const _mcpConfig = await getMcpConfig() as { mcpServers: Record<string, any> }

    let _oapTools: OAPMCPServer[] = []
    setOapTools((oapTools: OAPMCPServer[]) => {
      _oapTools = oapTools
      return oapTools
    })

    const newCache: ToolsCache = {}
    let currentTools: Tool[] = []
    setTools((prevTools: Tool[]) => {
      currentTools = prevTools
      prevTools.forEach((tool: Tool) => {
        newCache[tool.name] = {
          toolType: isConnector(tool.name, _mcpConfig) ? "connector" : "tool",
          sourceType: _oapTools && _oapTools.find(oapTool => oapTool.name === tool.name) ? "oap" : "custom",
          plan: _oapTools && _oapTools.find(oapTool => oapTool.name === tool.name)?.plan,
          description: tool.description || "",
          icon: tool.icon,
          subTools: tool.tools?.map(subTool => ({
            name: subTool.name,
            description: subTool.description || "",
            enabled: subTool.enabled
          })) || [],
          disabled: tool.error ? true : false
        }
      })
      return prevTools
    })

    // Only update cache after collecting all new data
    setToolsCache({ ...toolsCache, ...newCache })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadTools, getMcpConfig, setOapTools, setTools, setToolsCache])

  return {
    updateToolsCache,
    getMcpConfig,
  }
}

