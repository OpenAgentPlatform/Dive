// @ts-nocheck
import React, { useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import cloneDeep from "lodash/cloneDeep"
import PopupConfirm from "../../../components/PopupConfirm"
import OAPServerList from "./Popup/OAPServerList"
import CustomEdit from "./Popup/CustomEdit"
import ConnectorEdit from "./Popup/ConnectorEdit"
import ToolsHeader from "./components/ToolsHeader"
import ToolsList from "./components/ToolsList"
import LoadingOverlay from "./components/LoadingOverlay"
import { oapApplyMCPServer } from "../../../ipc"
import "../../../styles/overlay/_Tools.scss"
import { Subtab } from "../Setting"
import { useToolsState } from "./hooks/useToolsState"
import { useToolsCache } from "./hooks/useToolsCache"
import { useToolsConfig } from "./hooks/useToolsConfig"
import { useConnector } from "./hooks/useConnector"
import { useSubTools } from "./hooks/useSubTools"
import { useToolsSorting } from "./hooks/useToolsSorting"
import { createToolMenu } from "./components/createToolMenu"
import { isOapTool, isConnector } from "./utils/toolHelpers"

const Tools = ({ _subtab, _tabdata }: { _subtab?: Subtab, _tabdata?: any }) => {
  const { t } = useTranslation()

  // Initialize all state and refs
  const state = useToolsState()
  const {
    tools,
    setTools,
    oapTools,
    mcpConfig,
    setMcpConfig,
    toolsCache,
    installToolBuffer,
    setInstallToolBuffer,
    authorizeState,
    setAuthorizeState,
    isLoggedInOAP,
    showToast,
    loadTools,
    loadMcpConfig,
    loadOapTools,
    closeAllOverlays,
    isLoading,
    setIsLoading,
    isConnectorLoading,
    setIsConnectorLoading,
    isDisConnectorLoading,
    setIsDisConnectorLoading,
    loadingTools,
    setLoadingTools,
    currentTool,
    setCurrentTool,
    toolLog,
    setToolLog,
    toolType,
    setToolType,
    isResort,
    setIsResort,
    expandedSections,
    setExpandedSections,
    showDeletePopup,
    setShowDeletePopup,
    showCustomEditPopup,
    setShowCustomEditPopup,
    showDeleteConnectorPopup,
    setShowDeleteConnectorPopup,
    showConnectorPopup,
    setShowConnectorPopup,
    showConfirmCancelConnector,
    setShowConfirmCancelConnector,
    showConfirmDisConnector,
    setShowConfirmDisConnector,
    showOapMcpPopup,
    setShowOapMcpPopup,
    showUnsavedSubtoolsPopup,
    setShowUnsavedSubtoolsPopup,
    mcpConfigRef,
    changingToolRef,
    abortControllerRef,
    abortControllerConnectorRef,
    abortDisConnectorRef,
    sortedConfigOrderRef,
  } = state

  // Initialize cache hook
  const { updateToolsCache, getMcpConfig } = useToolsCache({
    loadTools,
    mcpConfig,
    setMcpConfig,
    tools,
    setTools,
    oapTools,
    setOapTools: state.setOapTools,
    toolsCache,
    setToolsCache: state.setToolsCache,
  })

  // Initialize config hook
  const { updateMCPConfig, updateMCPConfigNoAbort, handleUpdateConfigResponse } = useToolsConfig({
    showToast,
    abortControllerRef,
    abortDisConnectorRef,
  })

  // Helper functions
  const isReAuthorizing = useCallback(() => {
    return _subtab === "Tool" && _tabdata?.currentTool && authorizeState !== null
  }, [_subtab, _tabdata, authorizeState])

  const handleReAuthorizeFinish = useCallback(async () => {
    if (isReAuthorizing()) {
      setIsLoading(true)
      await fetch(`/api/tools/login/oauth/callback?code=''&state=${authorizeState}`)
      setIsLoading(false)
      closeAllOverlays()
    }
    setAuthorizeState(null)
  }, [isReAuthorizing, setIsLoading, authorizeState, closeAllOverlays, setAuthorizeState])

  const handleReloadMCPServers = useCallback(async (type: "all" | "connector" = "all", _showToast: boolean = true) => {
    try {
      if (type === "all") {
        setIsLoading(true)
      }
      await fetch("/api/plugins/oap-platform/config/refresh", {
      method: "POST",
      })
    } catch (_error) {
      console.error(_error)
    }
    const _mcpConfig = await getMcpConfig()
    await updateMCPConfig(_mcpConfig, true)

    await loadOapTools()
        await loadMcpConfig()
        await updateToolsCache()
        setIsResort(true)
      setIsLoading(false)
  }, [setIsLoading, getMcpConfig, updateMCPConfig, toolsCache, showToast, t, loadOapTools, loadMcpConfig, updateToolsCache, setIsResort])

  // Initialize connector hook
  const {
    onConnector,
    cancelConnector,
    cancelDisConnector,
    onDisconnectConnector,
    onConnectorSubmit,
  } = useConnector({
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
  })

  // Toggle tool section
  const toggleToolSection = useCallback((name: string) => {
    setExpandedSections(prev =>
      prev.includes(name)
        ? prev.filter(n => n !== name)
        : [...prev, name]
    )
  }, [setExpandedSections])

  // Initialize subtools hook
  const {
    toggleSubTool,
    toggleSubToolConfirm,
    toggleSubToolCancel,
    handleUnsavedSubtools,
  } = useSubTools({
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
  })

  // Initialize sorting hook
  const { sortedTools } = useToolsSorting({
    tools,
    oapTools,
    mcpConfig,
    toolsCache,
    toolType,
    isResort,
    setIsResort,
    sortedConfigOrderRef,
    isLoggedInOAP,
  })

  // Toggle tool enabled/disabled
  const toggleTool = useCallback(async (tool: any) => {
    if (loadingTools.includes(tool.name)) {
      return
    }
    setLoadingTools(prev => [...prev, tool.name])
    try {
      if (!mcpConfigRef.current) {
        mcpConfigRef.current = JSON.parse(JSON.stringify(mcpConfig))
      }

      const currentEnabled = tool.enabled
      const newConfig = JSON.parse(JSON.stringify(mcpConfigRef.current))
      newConfig.mcpServers[tool.name].enabled = !currentEnabled
      if (newConfig.mcpServers[tool.name].enabled && tool.tools?.every(subTool => !subTool.enabled)) {
        newConfig.mcpServers[tool.name].exclude_tools = []
      }
      mcpConfigRef.current = newConfig

      const data = await updateMCPConfigNoAbort(mcpConfigRef.current)
      if (data.errors && Array.isArray(data.errors) && data.errors.length) {
        data.errors
          .map((e: any) => e.serverName)
          .forEach((serverName: string) => {
            if (mcpConfigRef.current.mcpServers[serverName]) {
              mcpConfigRef.current.mcpServers[serverName].disabled = true
            }
          })

        await updateMCPConfigNoAbort(mcpConfigRef.current)
      }

      if (data.success) {
        setMcpConfig(mcpConfigRef.current)
        await loadOapTools()
        await updateToolsCache()
        handleUpdateConfigResponse(data, mcpConfig, setMcpConfig, tools, false)
      }
    } catch (error) {
      console.error("Failed to update MCP config:", error)
    } finally {
      setLoadingTools(prev => prev.filter(name => name !== tool.name))
    }
  }, [
    loadingTools,
    setLoadingTools,
    mcpConfigRef,
    mcpConfig,
    updateMCPConfigNoAbort,
    showToast,
    t,
    setMcpConfig,
    loadOapTools,
    updateToolsCache,
    handleUpdateConfigResponse,
    tools,
  ])

  // Handle custom submit
  const handleCustomSubmit = useCallback(async (newConfig: { mcpServers: any }) => {
    setIsLoading(true)
    try {
      const filledConfig = { ...newConfig }
      const connectorList = Object.entries(mcpConfig.mcpServers).filter(([_key, value]) => value.transport === "streamable").reduce((acc, [key, value]) => {
        acc[key] = value
        return acc
      }, {} as any)

      filledConfig.mcpServers = {
        ...newConfig.mcpServers,
        ...connectorList,
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

        await updateMCPConfig(filledConfig)
      }
      if (data?.success) {
        setMcpConfig(filledConfig)
        setShowCustomEditPopup(false)
        await loadMcpConfig()
        await updateToolsCache()
        handleUpdateConfigResponse(data, mcpConfig, setMcpConfig, tools)
        setIsResort(true)
      }
    } catch (error) {
      console.error("Failed to update MCP config:", error)
      showToast({
        message: t("tools.saveFailed"),
        type: "error"
      })
      setShowCustomEditPopup(false)
    } finally {
    setIsLoading(false)
  }
  }, [
    setIsLoading,
    mcpConfig,
    updateMCPConfig,
    showToast,
    t,
    setMcpConfig,
    setShowCustomEditPopup,
    loadMcpConfig,
    updateToolsCache,
    handleUpdateConfigResponse,
    tools,
    setIsResort,
  ])

  // Delete tool
  const deleteTool = useCallback(async (toolName: string) => {
        setIsLoading(true)
    if (isOapTool(toolName, oapTools)) {
      await oapApplyMCPServer(oapTools.filter(oapTool => oapTool.name !== toolName).map(oapTool => oapTool.id))
      }
    const newConfig = JSON.parse(JSON.stringify(mcpConfig))
    delete newConfig.mcpServers[toolName]
      await fetch("/api/plugins/oap-platform/config/refresh", {
        method: "POST",
      })
    await loadOapTools()
    await updateToolsCache()
    await updateMCPConfig(newConfig)
    setMcpConfig(newConfig)
    setIsResort(true)
    setIsLoading(false)
  }, [setIsLoading, oapTools, mcpConfig, loadOapTools, updateToolsCache, updateMCPConfig, setMcpConfig, setIsResort])

  const handleDeleteTool = useCallback(async (toolName: string) => {
    setCurrentTool(toolName)
    setShowDeletePopup(true)
  }, [setCurrentTool, setShowDeletePopup])

  const handleDeleteConnector = useCallback(async (connectorName: string) => {
    setCurrentTool(connectorName)
    setShowDeleteConnectorPopup(true)
  }, [setCurrentTool, setShowDeleteConnectorPopup])

  // Get tool menu
  const getToolMenu = useCallback((tool: any) => {
    return createToolMenu({
      tool,
      oapTools,
      mcpConfig,
      onReload: () => handleReloadMCPServers(),
      onEdit: () => {
              setCurrentTool(tool.name)
        if (isConnector(tool.name, mcpConfig)) {
                setShowConnectorPopup(true)
              } else {
                setShowCustomEditPopup(true)
              }
            },
      onDisconnect: () => {
              setCurrentTool(tool.name)
              setShowConfirmDisConnector(true)
            },
      onConnect: () => {
              onConnector(tool)
            },
      onDelete: () => {
              setCurrentTool(tool.name)
              setShowDeletePopup(true)
            },
      t,
    })
  }, [oapTools, mcpConfig, handleReloadMCPServers, setCurrentTool, setShowConnectorPopup, setShowCustomEditPopup, setShowConfirmDisConnector, onConnector, setShowDeletePopup, t])

  // Effects
  useEffect(() => {
    (async () => {
      switch (_subtab) {
        case "Tool":
          if (_tabdata?.currentTool) {
            setCurrentTool(_tabdata.currentTool)
            setShowConnectorPopup(true)
          }
          break
        case "Custom":
          if (_tabdata?.currentTool) {
            setCurrentTool(_tabdata.currentTool)
            setShowCustomEditPopup(true)
          }
          break
        default:
          break
      }
    })()
  }, [_subtab, _tabdata, setCurrentTool, setShowConnectorPopup, setShowCustomEditPopup])

  useEffect(() => {
    updateToolsCache()

    return () => {
      const abortController = abortControllerRef.current
      const abortConnector = abortControllerConnectorRef.current
      const abortDisConnector = abortDisConnectorRef.current

      if (abortController) {
        abortController.abort()
      }
      if (abortConnector) {
        abortConnector.abort()
      }
      if (abortDisConnector) {
        abortDisConnector.abort()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Consume install tool buffer
  useEffect(() => {
    if (!installToolBuffer.length) {
      return
    }

    const cfg = cloneDeep(mcpConfig.mcpServers)
    const install = ({ name, config }: { name: string, config: Record<string, any> }) => {
      if (name in cfg) {
        cfg[name] = {
          ...mcpConfig.mcpServers[name],
          enabled: true,
        }
        return
      }

      cfg[name] = {
        ...config,
        enabled: true,
      }
    }

    installToolBuffer.forEach(install)
    setInstallToolBuffer([])
    handleCustomSubmit({ mcpServers: cfg })
  }, [installToolBuffer, mcpConfig.mcpServers, setInstallToolBuffer, handleCustomSubmit])

  useEffect(() => {
    setExpandedSections(prev =>
      prev.filter(name => sortedTools.some(tool => tool.name === name))
    )
  }, [sortedTools, setExpandedSections])

  return (
    <div className="tools-page">
      <div className="tools-container">
        <ToolsHeader
          isLoggedInOAP={isLoggedInOAP}
          onOapClick={() => setShowOapMcpPopup(true)}
          onConnectorClick={() => {
                  setCurrentTool("")
                  setShowConnectorPopup(true)
                }}
          onCustomClick={() => {
                  setCurrentTool("")
                  setShowCustomEditPopup(true)
                }}
          onReloadClick={() => handleReloadMCPServers()}
        />

        <ToolsList
          isLoggedInOAP={isLoggedInOAP}
          toolType={toolType}
          setToolType={setToolType}
          sortedTools={sortedTools}
          isLoading={isLoading}
          expandedSections={expandedSections}
          loadingTools={loadingTools}
          changingToolRef={changingToolRef}
          onToggleSection={toggleToolSection}
          onToggleTool={toggleTool}
          onConnectorConnect={onConnector}
          getToolMenu={getToolMenu}
          onSubToolToggle={toggleSubTool}
          onSaveClick={toggleSubToolConfirm}
          onClickOutside={handleUnsavedSubtools}
        />
      </div>

      {isLoading && <LoadingOverlay />}

      {showDeletePopup && (
        <PopupConfirm
          title={t("tools.deleteTitle", { mcp: currentTool })}
          noBorder
          footerType="center"
          zIndex={1000}
          onCancel={() => setShowDeletePopup(false)}
          onConfirm={() => {
            deleteTool(currentTool)
            setShowDeletePopup(false)
            setCurrentTool("")
            setShowCustomEditPopup(false)
          }}
        />
      )}

      {showCustomEditPopup && (
        <CustomEdit
          _type={currentTool === "" ? "add" : "edit"}
          _config={mcpConfig}
          _toolName={currentTool}
          onDelete={handleDeleteTool}
          onCancel={() => {
            abortControllerRef.current?.abort()
            setShowCustomEditPopup(false)
          }}
          onSubmit={handleCustomSubmit}
          toolLog={toolLog}
        />
      )}

      {showConnectorPopup && (
        <ConnectorEdit
          _tabdata={_tabdata}
          _connectorName={currentTool}
          onDelete={handleDeleteConnector}
          onDisconnect={(connectorName) => {
            setCurrentTool(connectorName)
            setShowConfirmDisConnector(true)
          }}
          onToggle={toggleTool}
          onCancel={async () => {
            setShowConnectorPopup(false)
            cancelConnector()
            await handleReAuthorizeFinish()
          }}
          onConnect={onConnector}
          onSubmit={(newConfig, connector) => onConnectorSubmit(newConfig, connector, setIsResort)}
        />
      )}

      {isConnectorLoading && (
        <PopupConfirm
          noBorder
          footerType="center"
          zIndex={2000}
          onCancel={() => setShowConfirmCancelConnector(true)}
        >
          <div className="connector-loading-overlay">
            <div className="loading-spinner"></div>
            {t("tools.connector.loading")}
          </div>
        </PopupConfirm>
      )}

      {showConfirmCancelConnector && (
        <PopupConfirm
          noBorder
          footerType="center"
          zIndex={2000}
          onConfirm={cancelConnector}
          onCancel={() => setShowConfirmCancelConnector(false)}
          title={t("tools.connector.confirmCancel")}
        >
        </PopupConfirm>
      )}

      {showConfirmDisConnector && (
        <PopupConfirm
          noBorder
          footerType="center"
          zIndex={2000}
          confirmText={isDisConnectorLoading ? (<div className="loading-spinner"></div>) : null}
          disabled={isDisConnectorLoading}
          onConfirm={() => onDisconnectConnector(undefined, currentTool)}
          onCancel={cancelDisConnector}
          title={t("tools.connector.confirmDisConnect", { connector: currentTool })}
        >
          <div className="tool-confirm-content">
            {t("tools.connector.confirmDisConnectDescription", { connector: currentTool })}
          </div>
        </PopupConfirm>
      )}

      {showDeleteConnectorPopup && (
        <PopupConfirm
          title={t("tools.deleteTitle", { mcp: currentTool })}
          noBorder
          footerType="center"
          zIndex={1000}
          onCancel={() => setShowDeleteConnectorPopup(false)}
          onConfirm={() => {
            deleteTool(currentTool)
            setShowDeleteConnectorPopup(false)
            setCurrentTool("")
            setShowConnectorPopup(false)
          }}
        />
      )}

      {showOapMcpPopup && (
        <OAPServerList
          oapTools={oapTools ?? []}
          onConfirm={handleReloadMCPServers}
          onCancel={() => {
            setShowOapMcpPopup(false)
          }}
        />
      )}

      {showUnsavedSubtoolsPopup && (
        <PopupConfirm
          noBorder
          className="unsaved-popup"
          footerType="center"
          zIndex={1000}
          onConfirm={toggleSubToolConfirm}
          onCancel={toggleSubToolCancel}
          cancelText={t("tools.unsaved.cancel")}
        >
          <div className="unsaved-content">
            <div className="unsaved-header">
              {t("tools.unsaved.title")}
            </div>
            <div className="unsaved-desc">
              {t("tools.unsaved.desc")}
            </div>
          </div>
        </PopupConfirm>
      )}
    </div>
  )
}

export default React.memo(Tools)
