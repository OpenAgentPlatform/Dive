import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { openUrl } from "../../../../ipc/util"
import { LogType } from "../utils/constants"

interface ConnectorListProps {
  name: string
  [key: string]: any
}

interface UseConnectorProps {
  showToast: (toast: { message: string; type: "success" | "error" | "info"; closable?: boolean }) => void
  abortControllerConnectorRef: React.MutableRefObject<AbortController | null>
  abortDisConnectorRef: React.MutableRefObject<AbortController | null>
  abortControllerRef: React.MutableRefObject<AbortController | null>
  setIsConnectorLoading: (loading: boolean) => void
  setIsDisConnectorLoading: (loading: boolean) => void
  setCurrentTool: (tool: string) => void
  setToolLog: (log: LogType[]) => void
  setShowConfirmCancelConnector: (show: boolean) => void
  setShowConfirmDisConnector: (show: boolean) => void
  setShowConnectorPopup: (show: boolean) => void
  loadMcpConfig: () => Promise<any>
  loadTools: () => Promise<any>
  updateToolsCache: () => Promise<void>
  handleReAuthorizeFinish: () => Promise<void>
  handleReloadMCPServers: (type?: "all" | "connector", showToast?: boolean) => Promise<void>
  isReAuthorizing: () => boolean
  updateMCPConfig: (config: any, force?: boolean) => Promise<any>
  handleUpdateConfigResponse: (data: any, mcpConfig: any, setMcpConfig: any, tools: any[], isShowToast?: boolean) => void
  mcpConfig: { mcpServers: Record<string, any> }
  setMcpConfig: (config: any) => void
  tools: any[]
}

export const useConnector = ({
  showToast,
  abortControllerConnectorRef,
  abortDisConnectorRef,
  abortControllerRef,
  setIsConnectorLoading,
  setIsDisConnectorLoading,
  setCurrentTool,
  setToolLog,
  setShowConfirmCancelConnector,
  setShowConfirmDisConnector,
  setShowConnectorPopup,
  loadMcpConfig,
  loadTools,
  updateToolsCache,
  handleReAuthorizeFinish,
  handleReloadMCPServers,
  isReAuthorizing,
  updateMCPConfig,
  handleUpdateConfigResponse,
  mcpConfig,
  setMcpConfig,
  tools,
}: UseConnectorProps) => {
  const { t } = useTranslation()

  const onConnector = useCallback(async (connector: ConnectorListProps) => {
    setIsConnectorLoading(true)
    try {
      if (abortControllerConnectorRef.current) {
        abortControllerConnectorRef.current.abort()
      }

      abortControllerConnectorRef.current = new AbortController()

      const response = await fetch("/api/tools/login/oauth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          server_name: connector.name
        }),
        signal: abortControllerConnectorRef.current.signal
      })

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let chunkBuf = ""

      while (true) {
        const { value, done } = await reader.read()
        if (done) {
          break
        }

        const chunk = decoder.decode(value)
        const lines = (chunkBuf + chunk).split("\n")
        chunkBuf = lines.pop() || ""

        for (const line of lines) {
          if (line.trim() === "" || !line.startsWith("data: "))
            continue

          const dataStr = line.slice(5)
          if (dataStr.trim() === "[DONE]")
            break

          try {
            const dataObj = JSON.parse(dataStr)
            if (dataObj.error) {
              showToast({
                message: t("tools.connector.connectFailed", { error: dataObj.error }),
                type: "error"
              })
              break
            }
            if (dataObj.success && dataObj.auth_url) {
              openUrl(dataObj.auth_url)
            }
          } catch (error) {
            console.warn(error)
          }
        }
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        abortControllerConnectorRef.current = null
        showToast({
          message: t("tools.connector.aborted"),
          type: "error"
        })
        return {}
      } else {
        showToast({
          message: error instanceof Error ? error.message : t("tools.connector.connectFailed", { error: error.message }),
          type: "error"
        })
      }
    } finally {
      await loadMcpConfig()
      await loadTools()
      await updateToolsCache()
      setCurrentTool(connector.name)
      await handleReAuthorizeFinish()
      if (!isReAuthorizing()) {
        await handleReloadMCPServers("connector")
      }
      setIsConnectorLoading(false)
    }
  }, [
    t,
    showToast,
    abortControllerConnectorRef,
    setIsConnectorLoading,
    setCurrentTool,
    loadMcpConfig,
    loadTools,
    updateToolsCache,
    handleReAuthorizeFinish,
    handleReloadMCPServers,
    isReAuthorizing,
  ])

  const cancelConnector = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    if (abortControllerConnectorRef.current) {
      abortControllerConnectorRef.current.abort()
    }
    setShowConfirmCancelConnector(false)
    setIsConnectorLoading(false)
    setToolLog([])
    await handleReAuthorizeFinish()
  }, [
    abortControllerRef,
    abortControllerConnectorRef,
    setShowConfirmCancelConnector,
    setIsConnectorLoading,
    setToolLog,
    handleReAuthorizeFinish,
  ])

  const cancelDisConnector = useCallback(() => {
    if (abortDisConnectorRef.current) {
      abortDisConnectorRef.current.abort()
    }
    setShowConfirmDisConnector(false)
    setIsConnectorLoading(false)
    setToolLog([])
  }, [abortDisConnectorRef, setShowConfirmDisConnector, setIsConnectorLoading, setToolLog])

  const onDisconnectConnector = useCallback(async (connectorName?: string, currentTool?: string) => {
    setIsDisConnectorLoading(true)
    if (!connectorName) {
      connectorName = currentTool
    }
    if (abortDisConnectorRef.current) {
      abortDisConnectorRef.current.abort()
    }
    abortDisConnectorRef.current = new AbortController()

    try {
      const response = await fetch("/api/tools/login/oauth/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          server_name: connectorName
        }),
        signal: abortDisConnectorRef.current.signal
      })
      const data = await response.json()
      if (data?.success) {
        showToast({
          message: t("tools.connector.disconnectSuccess", { connector: connectorName }),
          type: "success"
        })
      } else {
        showToast({
          message: t("tools.connector.disconnectFailed", { connector: connectorName }),
          type: "error"
        })
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        showToast({
          message: t("tools.connector.disconnectFailed", { connector: connectorName }),
          type: "error"
        })
      }
    }
    await handleReloadMCPServers("connector")
    setShowConfirmDisConnector(false)
    setIsConnectorLoading(false)
    setShowConnectorPopup(false)
    setToolLog([])
    setCurrentTool("")
    abortDisConnectorRef.current = null
    setIsDisConnectorLoading(false)
  }, [
    t,
    showToast,
    abortDisConnectorRef,
    setIsDisConnectorLoading,
    setShowConfirmDisConnector,
    setIsConnectorLoading,
    setShowConnectorPopup,
    setToolLog,
    setCurrentTool,
    handleReloadMCPServers,
  ])

  const onConnectorSubmit = useCallback(async (
    newConfig: { mcpServers: Record<string, any> },
    connector: ConnectorListProps,
    setIsResort: (resort: boolean) => void
  ) => {
    // Disconnect all the connectors which are in currentConfig but not in newConfig
    const connectorsToDisconnect = Object.entries(mcpConfig.mcpServers).filter(
      ([_key, value]) => value.toolType === "connector" && !newConfig.mcpServers[_key]
    )
    for (const [key] of connectorsToDisconnect) {
      await onDisconnectConnector(key)
    }
    try {
      const filledConfig: any = {}
      // Fill transport with "streamable" for connector
      Object.entries(newConfig.mcpServers).forEach(([key, value]) => {
        if (value.toolType === "connector") {
          filledConfig[key] = {
            ...value,
            transport: "streamable"
          }
        }
      })
      const customAndOapList = Object.entries(mcpConfig.mcpServers).filter(
        ([_key, value]) => value.transport !== "streamable"
      ).reduce((acc, [key, value]) => {
        acc[key] = value
        return acc
      }, {} as any)

      filledConfig.mcpServers = {
        ...newConfig.mcpServers,
        ...customAndOapList,
      }

      const data = await updateMCPConfig(filledConfig)
      if (data?.errors && Array.isArray(data.errors) && data.errors.length) {
        data.errors
          .map((e: any) => e.serverName)
          .forEach((serverName: string) => {
            if (filledConfig.mcpServers[serverName]) {
              filledConfig.mcpServers[serverName].disabled = true
            }
          })

        // Reset enable
        await updateMCPConfig(filledConfig)
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
      if (data?.success) {
        setMcpConfig(filledConfig)
        handleUpdateConfigResponse(data, mcpConfig, setMcpConfig, tools)
        await loadMcpConfig()
        await loadTools()
        await updateToolsCache()
        await handleReAuthorizeFinish()
        setCurrentTool(connector.name)
        setShowConnectorPopup(false)
        cancelConnector()
        setIsResort(true)
      }
    } catch (error) {
      console.log(error)
      console.error("Failed to update MCP config:", error)
      showToast({
        message: t("tools.saveFailed"),
        type: "error"
      })
      await loadMcpConfig()
      await loadTools()
      await updateToolsCache()
      setCurrentTool(connector.name)
      cancelConnector()
      setIsResort(true)
    }
  }, [
    t,
    showToast,
    mcpConfig,
    setMcpConfig,
    tools,
    onDisconnectConnector,
    updateMCPConfig,
    handleUpdateConfigResponse,
    loadMcpConfig,
    loadTools,
    updateToolsCache,
    handleReAuthorizeFinish,
    setCurrentTool,
    setShowConnectorPopup,
    cancelConnector,
  ])

  return {
    onConnector,
    cancelConnector,
    cancelDisConnector,
    onDisconnectConnector,
    onConnectorSubmit,
  }
}

