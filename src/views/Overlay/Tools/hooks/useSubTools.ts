import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Tool } from "../../../../atoms/toolState"
import { OAPMCPServer } from "../../../../../types/oap"
import { arrayEqual, isOapTool } from "../utils/toolHelpers"

interface UseSubToolsProps {
  tools: Tool[]
  setTools: (tools: any) => void
  mcpConfig: { mcpServers: Record<string, any> }
  setMcpConfig: (config: any) => void
  oapTools: OAPMCPServer[]
  mcpConfigRef: React.MutableRefObject<any>
  changingToolRef: React.MutableRefObject<Tool | null>
  loadingTools: string[]
  setLoadingTools: (tools: any) => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
  setShowUnsavedSubtoolsPopup: (show: boolean) => void
  showToast: (toast: { message: string; type: "success" | "error" | "info"; closable?: boolean }) => void
  updateMCPConfigNoAbort: (config: any, force?: boolean) => Promise<any>
  loadTools: () => Promise<any>
  toggleToolSection: (name: string) => void
}

export const useSubTools = ({
  tools,
  setTools,
  mcpConfig,
  setMcpConfig,
  oapTools,
  mcpConfigRef,
  changingToolRef,
  loadingTools,
  setLoadingTools,
  isLoading,
  setIsLoading,
  setShowUnsavedSubtoolsPopup,
  showToast,
  updateMCPConfigNoAbort,
  loadTools,
  toggleToolSection,
}: UseSubToolsProps) => {
  const { t } = useTranslation()

  const handleUnsavedSubtools = useCallback((toolName: string, event?: MouseEvent) => {
    // Check current changing tool is the same as the toolName
    if (changingToolRef.current?.name === toolName && !isLoading && !loadingTools.includes(changingToolRef.current?.name ?? "")) {
      event?.preventDefault()
      setShowUnsavedSubtoolsPopup(true)
    }
    return
  }, [changingToolRef, isLoading, loadingTools, setShowUnsavedSubtoolsPopup])

  const toggleSubTool = useCallback(async (_tool: Tool, subToolName: string, action: "add" | "remove") => {
    const toolName = _tool.name
    if (loadingTools.includes(toolName)) {
      return
    }
    const newTools = [...tools]
    const tool = newTools.find(tool => tool.name === toolName)
    const subToolIndex = tool?.tools?.findIndex(subTool => subTool.name === subToolName)

    if (tool?.enabled) {
      if (tool?.tools && subToolIndex !== undefined && subToolIndex > -1) {
        if (action === "add") {
          tool.tools[subToolIndex].enabled = false
        } else {
          tool.tools[subToolIndex].enabled = true
        }
      }

      if (tool?.tools?.filter(subTool => subTool.enabled).length === 0) {
        tool.enabled = false
        // If closing all subtools, make tool disabled, check if tool is disabled originally
        // Disabled originally: it means it still in draft, recover all subtools state
        if (!mcpConfig.mcpServers[toolName].enabled) {
          tool.tools?.map(subTool => {
            subTool.enabled = true
            if (mcpConfig.mcpServers[toolName].exclude_tools?.includes(subTool.name)) {
              subTool.enabled = false
            }
          })
        }
      } else {
        tool.enabled = true
      }
    } else if (tool) {
      tool.enabled = true
      tool.tools?.map(subTool => {
        subTool.enabled = false
        if (subTool.name === subToolName) {
          subTool.enabled = true
        }
      })
    }

    setTools(newTools)

    // Compare disabled tools of tools (temporary disabled tools) and mcpConfig.mcpServers[toolName].exclude_tools (actually disabled tools)
    const newDisabledSubTools = newTools.find(tool => tool.name === toolName)?.tools?.filter(subTool => !subTool.enabled).map(subTool => subTool.name)
    if (!arrayEqual(newDisabledSubTools ?? [], mcpConfig.mcpServers?.[toolName]?.exclude_tools ?? []) ||
      tool?.enabled !== mcpConfig.mcpServers[toolName].enabled) {
      changingToolRef.current = {
        ...tool,
        disabled: Boolean(tool?.error),
        type: isOapTool(toolName, oapTools) ? "oap" : "custom",
        plan: isOapTool(toolName, oapTools) ? oapTools?.find(oapTool => oapTool.name === toolName)?.plan : undefined,
        oapId: isOapTool(toolName, oapTools) ? oapTools?.find(oapTool => oapTool.name === toolName)?.id : undefined,
      } as Tool
    } else {
      changingToolRef.current = null
    }
  }, [
    tools,
    setTools,
    mcpConfig,
    oapTools,
    loadingTools,
    changingToolRef,
  ])

  const toggleSubToolConfirm = useCallback(async (e: React.MouseEvent<HTMLButtonElement>) => {
    e?.stopPropagation()
    if (changingToolRef.current === null) {
      return
    }
    try {
      setLoadingTools((prev: string[]) => [...prev, changingToolRef.current!.name])
      setShowUnsavedSubtoolsPopup(false)

      if (!mcpConfigRef.current) {
        mcpConfigRef.current = JSON.parse(JSON.stringify(mcpConfig))
      }
      const newConfig = JSON.parse(JSON.stringify(mcpConfigRef.current))
      const _tool = changingToolRef.current
      const newDisabledSubTools = _tool?.tools?.filter(subTool => !subTool.enabled).map(subTool => subTool.name)
      if (_tool?.tools?.length === newDisabledSubTools?.length) {
        newConfig.mcpServers[_tool.name].enabled = false
      } else {
        newConfig.mcpServers[_tool.name].enabled = _tool?.enabled
      }
      newConfig.mcpServers[_tool.name].exclude_tools = newDisabledSubTools

      mcpConfigRef.current = newConfig
      const data = await updateMCPConfigNoAbort(mcpConfigRef.current)
      if (data.errors && Array.isArray(data.errors) && data.errors.length) {
        data.errors
          .map((e: any) => e.serverName)
          .forEach((serverName: string) => {
            if (mcpConfigRef.current?.mcpServers[serverName]) {
              mcpConfigRef.current.mcpServers[serverName].disabled = true
            }
          })

        // Reset enable
        await updateMCPConfigNoAbort(mcpConfigRef.current)
      }
      if (data?.detail?.filter((item: any) => item.type.includes("error")).length > 0) {
        data?.detail?.filter((item: any) => item.type.includes("error"))
          .map((e: any) => [e.loc[2], e.msg])
          .forEach(([serverName, error]: [string, string]) => {
            showToast({
              message: t("tools.updateFailed", { serverName, error }),
              type: "error",
              closable: true
            })
          })
      }

      if (data.errors?.filter((error: any) => error.serverName === _tool.name).length === 0 &&
        (!data?.detail || data?.detail?.filter((item: any) => item.type.includes("error")).length === 0) &&
        loadingTools.filter(name => name !== _tool.name).length === 0) {
        showToast({
          message: t("tools.saveSuccess"),
          type: "success"
        })
      }

      if (data.success) {
        setMcpConfig(mcpConfigRef.current)
        await loadTools()
        toggleToolSection(_tool.name)
        setLoadingTools((prev: string[]) => prev.filter(name => name !== _tool.name))
        if (changingToolRef.current?.name === _tool.name) {
          changingToolRef.current = null
        }
      }
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : t("tools.toggleFailed"),
        type: "error"
      })
    } finally {
      if (changingToolRef.current) {
        setLoadingTools((prev: string[]) => prev.filter(name => name !== changingToolRef.current!.name))
      }
    }
  }, [
    changingToolRef,
    mcpConfig,
    mcpConfigRef,
    setLoadingTools,
    setShowUnsavedSubtoolsPopup,
    setMcpConfig,
    loadingTools,
    showToast,
    updateMCPConfigNoAbort,
    loadTools,
    toggleToolSection,
    t,
  ])

  const toggleSubToolCancel = useCallback(async () => {
    setShowUnsavedSubtoolsPopup(false)
    changingToolRef.current = null
    setIsLoading(true)
    await loadTools()
    setIsLoading(false)
  }, [setShowUnsavedSubtoolsPopup, changingToolRef, setIsLoading, loadTools])

  return {
    toggleSubTool,
    toggleSubToolConfirm,
    toggleSubToolCancel,
    handleUnsavedSubtools,
  }
}

