// @ts-ignore
import jsonlint from "jsonlint-mod"
import React, { useEffect, useState, useRef, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useAtomValue, useSetAtom } from "jotai"
import { showToastAtom } from "../../atoms/toastState"
import CodeMirror, { EditorView } from "@uiw/react-codemirror"
import { json } from "@codemirror/lang-json"
import { linter, lintGutter } from "@codemirror/lint"
import { systemThemeAtom, themeAtom } from "../../atoms/themeState"
import { closeOverlayAtom } from "../../atoms/layerState"
import Switch from "../../components/Switch"
import { loadToolsAtom, Tool, toolsAtom } from "../../atoms/toolState"
import Tooltip from "../../components/Tooltip"
import PopupConfirm from "../../components/PopupConfirm"
import Dropdown from "../../components/DropDown"

interface ToolsCache {
  [key: string]: {
    description: string
    icon?: string
    subTools: {
      name: string
      description: string
    }[]
    disabled: boolean
  }
}

const Tools = () => {
  const { t } = useTranslation()
  const tools = useAtomValue(toolsAtom)
  const [mcpConfig, setMcpConfig] = useState<Record<string, any>>({})
  const [isLoading, setIsLoading] = useState(false)
  const showToast = useSetAtom(showToastAtom)
  const closeOverlay = useSetAtom(closeOverlayAtom)
  const toolsCacheRef = useRef<ToolsCache>({})
  const loadTools = useSetAtom(loadToolsAtom)
  const [showDeletePopup, setShowDeletePopup] = useState(false)
  const [showMcpEditPopup, setShowMcpEditPopup] = useState(false)
  const [showMcpAddPopup, setShowMcpAddPopup] = useState(false)
  const [showMcpEditJsonPopup, setShowMcpEditJsonPopup] = useState(false)
  const [currentMcp, setCurrentMcp] = useState<string>("")
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const cachedTools = localStorage.getItem("toolsCache")
    if (cachedTools) {
      toolsCacheRef.current = JSON.parse(cachedTools)
    }

    fetchTools()
    fetchMCPConfig()

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [showMcpEditPopup, showMcpAddPopup, showMcpEditJsonPopup])

  const fetchTools = async () => {
    try {
      const data = await loadTools()

      if (data.success) {
        const newCache: ToolsCache = {}
        data.tools.forEach((tool: Tool) => {
          newCache[tool.name] = {
            description: tool.description || "",
            icon: tool.icon,
            subTools: tool.tools?.map(subTool => ({
              name: subTool.name,
              description: subTool.description || ""
            })) || [],
            disabled: tool.error ? true : false
          }
        })

        toolsCacheRef.current = {...toolsCacheRef.current, ...newCache}
        localStorage.setItem("toolsCache", JSON.stringify(toolsCacheRef.current))
      } else {
        showToast({
          message: data.message || t("tools.fetchFailed"),
          type: "error"
        })
      }
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : t("tools.fetchFailed"),
        type: "error"
      })
    }
  }

  const updateMCPConfig = async (newConfig: Record<string, any> | string, force = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()
    const config = typeof newConfig === "string" ? JSON.parse(newConfig) : newConfig
    Object.keys(config.mcpServers).forEach(key => {
      const cfg = config.mcpServers[key]
      if (!cfg.transport) {
        config.mcpServers[key].transport = cfg.url ? "sse" : "stdio"
      }

      if (!config.mcpServers[key].url) {
        config.mcpServers[key].url = null
      }

      if (!config.mcpServers[key].env) {
        config.mcpServers[key].env = {}
      }

      if (!config.mcpServers[key].command) {
        config.mcpServers[key].command = null
      }

      if (!config.mcpServers[key].args) {
        config.mcpServers[key].args = []
      }

      if (!("enabled" in config.mcpServers[key])) {
        config.mcpServers[key].enabled = true
      }
    })

    return await fetch(`/api/config/mcpserver${force ? "?force=1" : ""}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
      signal: abortControllerRef.current.signal
    })
      .then(async (response) => await response.json())
      .catch((error) => {
        if (error.name === "AbortError") {
          abortControllerRef.current = null
          showToast({
            message: t("tools.configSaveAborted"),
            type: "error"
          })
          return {}
        } else {
          showToast({
            message: error instanceof Error ? error.message : t("tools.configFetchFailed"),
            type: "error"
          })
        }
      })
  }

  const fetchMCPConfig = async () => {
    try {
      const response = await fetch("/api/config/mcpserver")
      const data = await response.json()
      if (data.success) {
        setMcpConfig(data.config || {})
      } else {
        showToast({
          message: data.message || t("tools.configFetchFailed"),
          type: "error"
        })
      }
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : t("tools.configFetchFailed"),
        type: "error"
      })
    }
  }

  const handleUpdateConfigResponse = (data: { errors: { error: string; serverName: string }[] }, isShowToast = false) => {
    if (data.errors && data.errors.length && Array.isArray(data.errors)) {
      data.errors.forEach(({ error, serverName }: { error: string; serverName: string }) => {
        if(isShowToast) {
          showToast({
            message: t("tools.updateFailed", { serverName, error }),
            type: "error",
            closable: true
          })
        }
        setMcpConfig(prevConfig => {
          const newConfig = {...prevConfig}
          newConfig.mcpServers[serverName].disabled = true
          return newConfig
        })
      })
    } else if(isShowToast) {
      showToast({
        message: t("tools.saveSuccess"),
        type: "success"
      })
    }
  }

  const handleConfigSubmit = async (newConfig: Record<string, any>) => {
    try {
      const filledConfig = await window.ipcRenderer.fillPathToConfig(JSON.stringify(newConfig))
      const data = await updateMCPConfig(filledConfig)
      if (data.errors && Array.isArray(data.errors) && data.errors.length) {
        data.errors
          .map((e: any) => e.serverName)
          .forEach((serverName: string) => {
            newConfig.mcpServers[serverName].disabled = true
          })

        // reset enable
        await updateMCPConfig(newConfig)
      }
      if(data?.detail?.filter((item: any) => item.type.includes("error")).length > 0) {
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
      if (data.success) {
        setMcpConfig(newConfig)
        setShowMcpEditJsonPopup(false)
        setShowMcpEditPopup(false)
        fetchTools()
        handleUpdateConfigResponse(data)
      }
    } catch (error) {
      console.error("Failed to update MCP config:", error)
      showToast({
        message: t("tools.saveFailed"),
        type: "error"
      })
      setShowMcpEditJsonPopup(false)
      setShowMcpEditPopup(false)
    }
  }

  const handleDeleteTool = async(toolName: string) => {
    setCurrentMcp(toolName)
    setShowDeletePopup(true)
  }

  const deleteTool = async (toolName: string) => {
    const newConfig = JSON.parse(JSON.stringify(mcpConfig))
    delete newConfig.mcpServers[toolName]
    await updateMCPConfig(newConfig)
    setMcpConfig(newConfig)
    await fetchTools()
  }

  const deleteAllTools = async () => {
    const newConfig = JSON.parse(JSON.stringify(mcpConfig))
    newConfig.mcpServers = {}
    await updateMCPConfig(newConfig)
    setMcpConfig(newConfig)
    await fetchTools()
  }

  const toggleTool = async (tool: Tool) => {
    try {
      setIsLoading(true)
      const currentEnabled = tool.enabled

      const newConfig = JSON.parse(JSON.stringify(mcpConfig))
      newConfig.mcpServers[tool.name].enabled = !currentEnabled
      const data = await updateMCPConfig(newConfig)
      if (data.errors && Array.isArray(data.errors) && data.errors.length) {
        data.errors
          .map((e: any) => e.serverName)
          .forEach((serverName: string) => {
            newConfig.mcpServers[serverName].disabled = true
          })

        // reset enable
        await updateMCPConfig(newConfig)
      }

      if(data.errors?.filter((error: any) => error.serverName === tool.name).length > 0) {
        showToast({
          message: t("tools.toggleFailed"),
          type: "error"
        })
      } else {
        showToast({
          message: t("tools.saveSuccess"),
          type: "success"
        })
      }

      if (data.success) {
        setMcpConfig(newConfig)
        await fetchTools()
        handleUpdateConfigResponse(data, false)
      }
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : t("tools.toggleFailed"),
        type: "error"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const toggleToolSection = (index: number) => {
    const toolElement = document.getElementById(`tool-${index}`)
    toolElement?.classList.toggle("expanded")
  }

  const handleReloadMCPServers = async () => {
    setIsLoading(true)
    const disabledTools = Object.keys(toolsCacheRef.current).filter(tool => toolsCacheRef.current[tool].disabled && mcpConfig.mcpServers[tool].enabled)
    await updateMCPConfig(mcpConfig, true)
    await fetchTools()
    const newDisabledTools = Object.keys(toolsCacheRef.current).filter(tool => toolsCacheRef.current[tool].disabled && mcpConfig.mcpServers[tool].enabled)
    const hasToolsEnabled = disabledTools.some(tool => !newDisabledTools.includes(tool))

    if (hasToolsEnabled) {
      showToast({
        message: t("tools.saveSuccess"),
        type: "success"
      })
    }

    if (newDisabledTools.length > 0) {
      if(newDisabledTools.length === 1) {
        showToast({
          message: t("tools.reloadFailed", { toolName: newDisabledTools[0] }),
          type: "error",
          closable: true
        })
      } else {
        showToast({
          message: t("tools.reloadAllFailed", { number: newDisabledTools.length }),
          type: "error",
          closable: true
        })
      }
    }
    setIsLoading(false)
  }

  const handleAddSubmit = async (newConfig: Record<string, any>) => {
    const mergedConfig = mcpConfig
    const configKeys = Object.keys(newConfig)
    if (configKeys.includes("mcpServers")) {
      mergedConfig.mcpServers = { ...mergedConfig.mcpServers, ...newConfig.mcpServers }
    }

    mergedConfig.mcpServers = configKeys.reduce((acc, key) => {
      if (("command" in newConfig[key] && "args" in newConfig[key]) || "url" in newConfig[key]) {
        acc[key] = { ...(mergedConfig.mcpServers[key] || {}), ...newConfig[key] }
      }
      return acc
    }, mergedConfig.mcpServers)

    mergedConfig.mcpServers = Object.keys(mergedConfig.mcpServers).reduce((acc, key) => {
      if (!("enabled" in acc[key])) {
        acc[key].enabled = true
      }
      return acc
    }, mergedConfig.mcpServers)

    await handleConfigSubmit(mergedConfig)
    setShowMcpAddPopup(false)
  }

  const onClose = () => {
    closeOverlay("Tools")
  }

  const sortedTools = useMemo(() => {
    const configOrder = mcpConfig.mcpServers ? Object.keys(mcpConfig.mcpServers) : []
    const toolMap = new Map(tools.map(tool => [tool.name, tool]))

    return configOrder.map(name => {
      if (toolMap.has(name)) {
        const tool = toolMap.get(name)!
        return {
          ...tool,
          disabled: Boolean(tool?.error)
        }
      }

      const cachedTool = toolsCacheRef.current[name]
      if (cachedTool) {
        return {
          name,
          description: cachedTool.description,
          icon: cachedTool.icon,
          enabled: false,
          tools: cachedTool.subTools.map(subTool => ({
            name: subTool.name,
            description: subTool.description,
            enabled: false,
          })),
          error: mcpConfig.mcpServers[name]?.error,
          disabled: Boolean(mcpConfig.mcpServers[name]?.disabled || mcpConfig.mcpServers[name]?.error),
        }
      }

      return {
        name,
        description: "",
        enabled: false,
        disabled: Boolean(mcpConfig.mcpServers[name]?.disabled || mcpConfig.mcpServers[name]?.error),
      }
    })
  }, [tools, mcpConfig.mcpServers])

  return (
    <div className="tools-page overlay-page">
      <button
        className="close-btn"
        onClick={onClose}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <div className="tools-container">
        <div className="tools-header">
          <div>
            <h1>{t("tools.title")}</h1>
            <p className="subtitle">{t("tools.subtitle")}</p>
          </div>
          <div className="header-actions">
            <Tooltip content={t("tools.addServer.alt")}>
              <button
                className="add-btn"
                onClick={() => {
                  setShowMcpAddPopup(true)
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
                {t("tools.addServer")}
              </button>
            </Tooltip>

            <Tooltip content={t("tools.editConfig.alt")}>
              <button
                className="edit-btn"
                onClick={() => {
                  setCurrentMcp(sortedTools[0].name)
                  setShowMcpEditPopup(true)
                }}
              >
                {t("tools.editConfig")}
              </button>
            </Tooltip>

            <Tooltip content={t("tools.reloadMCPServers.alt")}>
              <button
                className="reload-btn"
                onClick={() => handleReloadMCPServers()}
              >
                <img src={"img://reload.svg"} />
                {t("tools.reloadMCPServers")}
              </button>
            </Tooltip>
          </div>
        </div>

        <div className="tools-list">
          {sortedTools.map((tool, index) => (
            <div key={index} id={`tool-${index}`} onClick={() => toggleToolSection(index)} className={`tool-section ${tool.disabled ? "disabled" : ""} ${tool.enabled ? "enabled" : ""}`}>
              <div className="tool-header">
                <div className="tool-header-content">
                  <div className="tool-status-light">
                    {!tool.disabled && tool.enabled &&
                      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="#52c41a" strokeWidth="4" />
                        <circle cx="50" cy="50" r="25" fill="#52c41a" />
                      </svg>}
                    {tool.disabled && tool.enabled &&
                      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="#ff3333" strokeWidth="4" />
                        <circle cx="50" cy="50" r="25" fill="#ff0000" />
                      </svg>}
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
                  </svg>
                  <span className="tool-name">{tool.name}</span>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <Dropdown
                    options={[
                      { label:
                          <div className="tool-edit-menu-item">
                            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <g clipPath="url(#clip0_6_586)">
                                <path d="M11 5C9.41775 5 7.87103 5.46919 6.55544 6.34824C5.23985 7.22729 4.21446 8.47672 3.60896 9.93853C3.00346 11.4003 2.84504 13.0089 3.15372 14.5607C3.4624 16.1126 4.22433 17.538 5.34315 18.6569C6.46197 19.7757 7.88743 20.5376 9.43928 20.8463C10.9911 21.155 12.5997 20.9965 14.0615 20.391C15.5233 19.7855 16.7727 18.7602 17.6518 17.4446C18.5308 16.129 19 14.5823 19 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                <path d="M16.4382 5.40544C16.7147 5.20587 16.7147 4.79413 16.4382 4.59456L11.7926 1.24188C11.4619 1.00323 11 1.23952 11 1.64733L11 8.35267C11 8.76048 11.4619 8.99676 11.7926 8.75812L16.4382 5.40544Z" fill="currentColor"/>
                              </g>
                              <defs>
                                <clipPath id="clip0_6_586">
                                <rect width="22" height="22" fill="currentColor" transform="matrix(-1 0 0 1 22 0)"/>
                                </clipPath>
                              </defs>
                            </svg>
                            {t("tools.toolMenu3")}
                          </div>,
                        onClick: () => {
                          handleReloadMCPServers()
                        },
                        active: tool.enabled && tool.disabled
                      },
                      { label:
                          <div className="tool-edit-menu-item">
                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
                              <path d="M3 13.6684V18.9998H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M2.99991 13.5986L12.5235 4.12082C13.9997 2.65181 16.3929 2.65181 17.869 4.12082V4.12082C19.3452 5.58983 19.3452 7.97157 17.869 9.44058L8.34542 18.9183" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            {t("tools.toolMenu2")}
                          </div>,
                        onClick: () => {
                          setCurrentMcp(tool.name)
                          setShowMcpEditPopup(true)
                        },
                        active: true
                      },
                      { label:
                          <div className="tool-edit-menu-item">
                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
                              <path d="M3 5H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M17 7V18.2373C16.9764 18.7259 16.7527 19.1855 16.3778 19.5156C16.0029 19.8457 15.5075 20.0192 15 19.9983H7C6.49249 20.0192 5.99707 19.8457 5.62221 19.5156C5.24735 19.1855 5.02361 18.7259 5 18.2373V7" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                              <path d="M8 10.04L14 16.04" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                              <path d="M14 10.04L8 16.04" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                              <path d="M13.5 2H8.5C8.22386 2 8 2.22386 8 2.5V4.5C8 4.77614 8.22386 5 8.5 5H13.5C13.7761 5 14 4.77614 14 4.5V2.5C14 2.22386 13.7761 2 13.5 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                            </svg>
                            {t("tools.toolMenu1")}
                          </div>,
                        onClick: () => {
                          setCurrentMcp(tool.name)
                          setShowDeletePopup(true)
                        },
                        active: true
                      }
                    ].filter(option => option.active)}
                  >
                    <div className="tool-edit-menu">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 22 22" width="25" height="25">
                        <path fill="currentColor" d="M19 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM11 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM3 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"></path>
                      </svg>
                    </div>
                  </Dropdown>
                </div>
                {tool.disabled && tool.enabled && <div className="tool-disabled-label">{t("tools.startFailed")}</div>}
                {tool.disabled && !tool.enabled && <div className="tool-disabled-label">{t("tools.installFailed")}</div>}
                <div className="tool-switch-container">
                  <Switch
                    checked={tool.enabled}
                    onChange={() => toggleTool(tool)}
                  />
                </div>
                <span className="tool-toggle">▼</span>
              </div>
              <div className="tool-content">
                {tool.error ? (
                  <div className="sub-tool-error">
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
                ) : (
                  <>
                    {tool.description && (
                      <div className="tool-description">{tool.description}</div>
                    )}
                    {tool.tools && (
                      <div className="sub-tools">
                        {tool.tools.map((subTool, subIndex) => (
                          <div key={subIndex} className="sub-tool">
                            <div className="sub-tool-content">
                              <div className="sub-tool-name">{subTool.name}</div>
                              {subTool.description && (
                                <div className="sub-tool-description">
                                  {subTool.description}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="global-loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}

      {showDeletePopup && (
        <PopupConfirm
          title={t(showMcpEditJsonPopup ? "tools.deleteAllTitle" : "tools.deleteTitle", { mcp: currentMcp })}
          noBorder
          footerType="center"
          zIndex={1000}
          onCancel={() => setShowDeletePopup(false)}
          onConfirm={() => {
            if(showMcpEditJsonPopup) {
              deleteAllTools()
            } else {
              deleteTool(currentMcp)
            }
            setShowDeletePopup(false)
            setCurrentMcp("")
            setShowMcpEditPopup(false)
            setShowMcpEditJsonPopup(false)
          }}
        />
      )}

      {showMcpAddPopup && (
        <McpEditPopup
          _type={"add"}
          _config={mcpConfig}
          onCancel={() => setShowMcpAddPopup(false)}
          onSubmit={handleAddSubmit}
        />
      )}

      {showMcpEditJsonPopup && (
        <McpEditPopup
          _type={"edit-json"}
          _config={mcpConfig}
          onDelete={handleDeleteTool}
          onCancel={() => setShowMcpEditJsonPopup(false)}
          onSubmit={handleConfigSubmit}
        />
      )}

      {showMcpEditPopup && (
        <McpEditPopup
          _type={"edit"}
          _config={mcpConfig}
          _mcpName={currentMcp}
          onDelete={handleDeleteTool}
          onCancel={() => {
            abortControllerRef.current?.abort()
            setShowMcpEditPopup(false)
          }}
          onSubmit={handleConfigSubmit}
        />
      )}
    </div>
  )
}

export default React.memo(Tools)

interface mcpListProps {
  originalName: string
  name: string
  mcpServers: mcpServersProps
  jsonString: string
  isError: boolean
}

interface mcpServersProps {
  enabled?: boolean
  command?: string
  args?: string[]
  env?: [string, unknown, boolean][]
  url?: string
  transport?: string
}

interface mcpEditPopupProps {
  _type: "add" | "add-json" | "edit" | "edit-json"
  _config: Record<string, any>
  _mcpName?: string
  onDelete?: (toolName: string) => Promise<void>
  onCancel: () => void
  onSubmit: (config: Record<string, any>) => Promise<void>
}

const FieldType = {
  "enabled": {
    type: "boolean",
    error: "tools.jsonFormatError4"
  },
  "command": {
    type: "string",
    error: "tools.jsonFormatError5"
  },
  "args": {
    type: "array",
    error: "tools.jsonFormatError6"
  },
  "env": {
    type: "object",
    error: "tools.jsonFormatError7"
  },
  "url": {
    type: "string",
    error: "tools.jsonFormatError8"
  },
  "transport": {
    type: "select",
    options: ["stdio", "sse"] as const,
    error: "tools.jsonFormatError9"
  }
}

const McpEditPopup = ({ _type, _config, _mcpName, onDelete, onCancel, onSubmit }: mcpEditPopupProps) => {
  const typeRef = useRef(_type)
  const { t } = useTranslation()
  const [mcpList, setMcpList] = useState<mcpListProps[]>([])
  const [currentMcpIndex, setCurrentMcpIndex] = useState(0)
  const [isFormatError, setIsFormatError] = useState(false)
  const theme = useAtomValue(themeAtom)
  const systemTheme = useAtomValue(systemThemeAtom)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showToast = useSetAtom(showToastAtom)

  useEffect(() => {
    if(!_config.mcpServers) {
      return
    }
    const newMcpList: mcpListProps[] = []
    const newConfig = JSON.parse(JSON.stringify(_config))

    // remove disabled field
    Object.keys(newConfig.mcpServers).forEach((mcpName) => {
      delete newConfig.mcpServers[mcpName].disabled
    })

    // edit mode: separate each tool into a single object
    if(typeRef.current === "edit") {
      Object.keys(newConfig.mcpServers).forEach((mcpName) => {
        const newJson = {
          mcpServers: {
            [mcpName]: newConfig.mcpServers[mcpName]
          }
        }
        newMcpList.push({
          originalName: mcpName,
          name: mcpName,
          mcpServers: encodeMcpServers(newConfig.mcpServers[mcpName]),
          jsonString: JSON.stringify(newJson, null, 2),
          isError: !isValidName(newMcpList, mcpName) || !isValidField(encodeMcpServers(newConfig.mcpServers[mcpName]))
        })
      })
      setCurrentMcpIndex(newMcpList.findIndex(mcp => mcp.name === _mcpName) ?? 0)
    } else {
      // other mode: don't separate each tool into a single object
      newMcpList.push({
        originalName: "",
        name: "",
        mcpServers: {},
        jsonString: typeRef.current === "edit-json" ? JSON.stringify(newConfig, null, 2) : "",
        isError: false
      })
      setCurrentMcpIndex(0)
    }
    setMcpList(newMcpList)
  }, [])

  useEffect(() => {
    try {
      if(mcpList.length === 0 || currentMcpIndex === -1) {
        return
      }
      let newMcpServers = JSON.parse(mcpList[currentMcpIndex].jsonString)
      if(Object.keys(newMcpServers)[0] === "mcpServers") {
        newMcpServers = newMcpServers.mcpServers
      }
      if(Object.keys(newMcpServers).length > 1 && typeRef.current === "add") {
        typeRef.current = "add-json"
      } else if(Object.keys(newMcpServers).length === 1 && typeRef.current === "add-json") {
        typeRef.current = "add"
      }
    } catch(e) {}
  }, [mcpList, currentMcpIndex, typeRef])

  const handleMcpChange = (key: string, value: any) => {
    const newMcpServers = JSON.parse(JSON.stringify(mcpList[currentMcpIndex].mcpServers))
    let newName = mcpList[currentMcpIndex].name

    if(key === "name") {
      newName = value
    } else {
      newMcpServers[key] = value
    }

    const newJsonString = { mcpServers: { [newName]: decodeMcpServers(newMcpServers) } }
    setMcpList(prev => {
      const newMcpList = [...prev]
      newMcpList[currentMcpIndex].name = newName
      newMcpList[currentMcpIndex].mcpServers = newMcpServers
      newMcpList[currentMcpIndex].jsonString = isValidField(newMcpServers) ? JSON.stringify(newJsonString, null, 2) : newMcpList[currentMcpIndex].jsonString
      newMcpList.forEach(mcp => mcp.isError = !isValidName(newMcpList, mcp.name) || !isValidField(mcp.mcpServers))
      return newMcpList
    })
  }

  const encodeMcpServers = (mcpServers: mcpServersProps & { env?: Record<string, unknown> }) => {
    // from object to array [[key, value, isError],...]
    const newMcpServers = JSON.parse(JSON.stringify(mcpServers))
    Object.keys(newMcpServers).forEach((fieldKey) => {
      if(newMcpServers[fieldKey] && FieldType[fieldKey as keyof typeof FieldType]?.type === "object") {
        const newField = Object.entries(newMcpServers[fieldKey])
                              .map(([key, value]) => [key, value, false] as [string, unknown, boolean])
        newMcpServers[fieldKey] = newField
      }
    })
    return newMcpServers
  }

  const decodeMcpServers = (mcpServers: mcpServersProps) => {
    // from array [[key, value, isError],...] to object
    const newMcpServers = JSON.parse(JSON.stringify(mcpServers))
    Object.keys(newMcpServers).forEach((fieldKey) => {
      if(newMcpServers[fieldKey] && FieldType[fieldKey as keyof typeof FieldType]?.type === "object") {
        newMcpServers[fieldKey] = Object.fromEntries(newMcpServers[fieldKey])
      }
    })
    return newMcpServers
  }

  const isValidName = (newMcpList: mcpListProps[], newName: string) => {
    const names = newMcpList.map(mcp => mcp.name).filter(name => name === newName)
    return (typeRef.current.includes("json") || newName?.length > 0) && names.length <= 1
  }

  const isValidField = (value: Record<string, any>) => {
    try {
      let newMcpServers = value
      if(newMcpServers.mcpServers) {
        newMcpServers = newMcpServers.mcpServers
      }

      // check Object key is valid
      for(const fieldKey of Object.keys(FieldType) as Array<keyof typeof FieldType>) {
        if(newMcpServers[fieldKey]) {
          if(FieldType[fieldKey].type === "object") {
            const keys = newMcpServers[fieldKey].map(([key]: [string]) => key)
            const duplicateIndex = keys.findIndex((key: string, index: number) => keys.indexOf(key) !== index)

            if(duplicateIndex !== -1) {
              newMcpServers[fieldKey][duplicateIndex][2] = true
              return false
            }
          }
          if(FieldType[fieldKey].type === "select") {
            const field = FieldType[fieldKey]
            if("options" in field && !field.options?.includes(newMcpServers[fieldKey])) {
              newMcpServers[fieldKey][2] = true
              return false
            }
          }
        }
      }
      return true
    } catch(e) {
      return false
    }
  }

  const handleSubmit = async () => {
    try {
      if (mcpList.some(mcp => mcp.isError))
        return

      const newConfig: Record<string, any> = { "mcpServers": {} }
      if(typeRef.current.includes("json")) {
        let processedJsonString = mcpList[0].jsonString.trim()
        if (!processedJsonString.startsWith("{")) {
          processedJsonString = `{${processedJsonString}}`
        }
        let newMcpServers = JSON.parse(processedJsonString)
        if(newMcpServers.mcpServers) {
          newMcpServers = newMcpServers.mcpServers
        }
        newConfig.mcpServers = newMcpServers
      } else {
        for(const mcp of mcpList) {
          newConfig.mcpServers[mcp.name] = decodeMcpServers(mcp.mcpServers)
        }
      }

      //clear env empty key
      Object.keys(newConfig.mcpServers).forEach(mcpName => {
        if(newConfig.mcpServers[mcpName].env) {
          newConfig.mcpServers[mcpName].env = Object.entries(newConfig.mcpServers[mcpName].env)
            .reduce((acc, [k, v]) => {
              if(k && v) {
                acc[k] = v
              }
              return acc
            }, {} as Record<string, any>)
        }
      })

      setIsSubmitting(true)
      await onSubmit(newConfig)
    } catch (err) {
      if (err instanceof SyntaxError) {
        showToast({
          message: t("tools.invalidJson"),
          type: "error"
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const mcpNameMask = (name: string) => {
    return name.length > 18 ? `${name.slice(0, 18)}...` : name
  }

  const McpList = useMemo(() => {
    if(typeRef.current === "add" || typeRef.current === "add-json" || typeRef.current === "edit-json") {
      return null
    }

    return (
      <div className="tool-edit-list">
        {mcpList && mcpList.map((mcp, index) => (
          mcp.isError ? (
            <Tooltip
              key={index}
              content={t("tools.jsonFormatError", { mcp: mcp.name })}
              side="right"
            >
              <div
                className={`tool-edit-list-item error ${index === currentMcpIndex ? "active" : ""}`}
                onClick={() => setCurrentMcpIndex(index)}
              >
                <label>
                  {`<> ${mcpNameMask(mcp.name)}`}
                  <svg width="16px" height="16px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"></circle>
                    <line x1="12" y1="6" x2="12" y2="14" stroke="currentColor" strokeWidth="2"></line>
                    <circle cx="12" cy="17" r="1.5" fill="currentColor"></circle>
                  </svg>
                </label>
              </div>
            </Tooltip>
          ) : (
            <div
              key={index}
              className={`tool-edit-list-item ${index === currentMcpIndex ? "active" : ""}`}
              onClick={() => setCurrentMcpIndex(index)}
            >
              <label>
                {`<> ${mcpNameMask(mcp.name)}`}
              </label>
            </div>
          )
        ))}
      </div>
    )
  }, [mcpList, currentMcpIndex])

  const Field = useMemo(() => {
    if(typeRef.current === "edit-json" || typeRef.current === "add-json") {
      return null
    }

    // wait for mcpList and currentMcpIndex, so show container first
    if (!mcpList || !mcpList[currentMcpIndex]) {
      return (
        <div className="tool-edit-field"></div>
      )
    }

    // wait for currentMcpServers, so show container first
    const currentMcp = mcpList[currentMcpIndex]
    const currentMcpServers = currentMcp?.mcpServers
    if (!currentMcpServers) {
      return (
        <div className="tool-edit-field"></div>
      )
    }

    const handleEnvChange = (newEnv: [string, unknown, boolean][]) => {
      const keys = newEnv.map(([key]) => key)
      keys.forEach((key, index) => {
        newEnv[index][2] = false
        if(keys.filter(k => k === key).length > 1) {
          newEnv[index][2] = true
        }
      })
      handleMcpChange("env", newEnv)
    }

    return (
      <div className="tool-edit-field">
        <div className="tool-edit-title">
          {t("tools.fieldTitle")}
          <Tooltip content={t("tools.fieldTitleAlt")} side="bottom" align="start" maxWidth={402}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7.5" stroke="currentColor"/>
              <path d="M8.73 6.64V12H7.85V6.64H8.73ZM8.3 4.63C8.43333 4.63 8.55 4.67667 8.65 4.77C8.75667 4.85667 8.81 4.99667 8.81 5.19C8.81 5.37667 8.75667 5.51667 8.65 5.61C8.55 5.70333 8.43333 5.75 8.3 5.75C8.15333 5.75 8.03 5.70333 7.93 5.61C7.83 5.51667 7.78 5.37667 7.78 5.19C7.78 4.99667 7.83 4.85667 7.93 4.77C8.03 4.67667 8.15333 4.63 8.3 4.63Z" fill="currentColor"/>
            </svg>
          </Tooltip>
        </div>
        <div className="field-content">
          {/* Name */}
          <div className="field-item">
            <label>Name</label>
            <input
              placeholder={t("tools.namePlaceholder")}
              type="text"
              value={currentMcp.name}
              onChange={(e) => handleMcpChange("name", e.target.value)}
            />
          </div>
          {/* Command */}
          <div className="field-item">
            <label>Command</label>
            <input
              placeholder={t("tools.commandPlaceholder")}
              type="text"
              value={currentMcpServers.command || ""}
              onChange={(e) => handleMcpChange("command", e.target.value)}
            />
          </div>
          {/* Transport */}
          {/* <div className="field-item">
            <label>Transport</label>
            <Select
              options={FieldType.transport.options.map((option) => ({
                value: option,
                label: (
                    <div className="model-select-label" key={option}>
                      <span className="model-select-label-text">
                        {option}
                      </span>
                    </div>
                  )
                })
              )}
              placeholder={t("tools.transportPlaceholder")}
              value={currentMcpServers.transport ?? FieldType.transport.options[0]}
              onSelect={(value) => handleMcpChange("transport", value)}
            />
          </div> */}
          {/* Args */}
          <div className="field-item">
            <label>
              ARGS
              <button onClick={() => handleMcpChange("args", [...(currentMcpServers.args || []), ""])}>
                + {t("tools.addArg")}
              </button>
            </label>
            <div className={`field-item-array ${(currentMcpServers?.args && currentMcpServers.args.length > 0) ? "no-border" : ""}`}>
              {currentMcpServers?.args && currentMcpServers.args.map((arg: string, index: number) => (
                <div key={index} className="field-item-array-item">
                  <input
                    placeholder={t("tools.argsPlaceholder")}
                    type="text"
                    autoFocus
                    value={arg}
                    onChange={(e) => handleMcpChange("args", currentMcpServers.args?.map((arg: string, i: number) => i === index ? e.target.value : arg))}
                  />
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 18 18"
                    width="22"
                    height="22"
                    className="field-item-array-item-clear"
                    onClick={() => handleMcpChange("args", currentMcpServers.args?.filter((_: string, i: number) => i !== index))}
                  >
                    <path stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="m13.91 4.09-9.82 9.82M13.91 13.91 4.09 4.09"></path>
                  </svg>
                </div>
              ))}
            </div>
          </div>
          {/* env */}
          <div className="field-item">
            <label>
              ENV
              <button onClick={() => {
                const newEnv = Array.isArray(currentMcpServers?.env)
                  ? [...currentMcpServers.env]
                  : []
                let index = 0
                while(newEnv.some(([key]) => key === `key${index}`)) {
                  index++
                }
                const nextKey = `key${index}`
                newEnv.push([nextKey, "", false] as [string, unknown, boolean])
                handleEnvChange(newEnv)
              }}>
                + {t("tools.addEnv")}
              </button>
            </label>
            <div className={`field-item-array ${(currentMcpServers?.env && currentMcpServers.env.length > 0) ? "no-border" : ""}`}>
              {(currentMcpServers?.env && currentMcpServers.env.length > 0) && currentMcpServers?.env.map(([envKey, envValue, isError]: [string, unknown, boolean], index: number) => (
                  <div key={index} className={`field-item-array-item ${isError ? "error" : ""}`}>
                    <div className="key-input-wrapper">
                      <input
                        className="env-key"
                        type="text"
                        placeholder={t("tools.envKey")}
                        value={envKey}
                        onChange={(e) => {
                          const newEnv = [...(currentMcpServers.env || [])]
                          newEnv[index][0] = e.target.value
                          newEnv[index][2] = false
                          handleEnvChange(newEnv)
                        }}
                      />
                      {isError ? (
                        <Tooltip content={t("tools.inputKeyError", { name: "ENV" })} side="left">
                          <div
                            className="env-key-error"
                            onClick={(e) => {
                              const input = e.currentTarget.parentElement?.parentElement?.querySelector("input")
                              if (input) {
                                input.focus()
                              }
                            }}
                          />
                        </Tooltip>
                      ) : null}
                    </div>
                    <input
                      className="env-value"
                      type="text"
                      placeholder={t("tools.envValue")}
                      value={envValue as string}
                      onChange={(e) => {
                        const newEnv = [...(currentMcpServers.env || [])]
                        newEnv[index][1] = e.target.value
                        newEnv[index][2] = false
                        handleEnvChange(newEnv)
                      }}
                    />
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 18 18"
                      width="22"
                      height="22"
                      className="field-item-array-item-clear"
                      onClick={() => {
                        const newEnv = (currentMcpServers.env || []).filter((_, i) => i !== index)
                        handleEnvChange(newEnv)
                      }}
                    >
                      <path stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="m13.91 4.09-9.82 9.82M13.91 13.91 4.09 4.09"></path>
                    </svg>
                  </div>
              ))}
            </div>
          </div>
          {/* Url */}
          <div className="field-item">
            <label>URL</label>
            <input
              placeholder={t("tools.urlPlaceholder")}
              type="text"
              value={currentMcpServers.url || ""}
              onChange={(e) => handleMcpChange("url", e.target.value)}
            />
          </div>
        </div>
      </div>
    )
  }, [mcpList, currentMcpIndex, typeRef])

  const JSONEditor = useMemo(() => {
    const isValidJSON = (value: Record<string, any>) => {
      try {
        const newMcpServers = value.mcpServers
        if(Object.keys(newMcpServers)?.length !== 1) {
          return false
        }
        if(Object.keys(newMcpServers)?.some(key => key === "")) {
          return false
        }
        // check field type
        for(const fieldKey of Object.keys(FieldType) as Array<keyof typeof FieldType>) {
          for(const mcp of Object.keys(newMcpServers)) {
            if(newMcpServers[mcp]?.[fieldKey] && Object.keys(newMcpServers[mcp]).some(key => key === fieldKey)) {
              const fieldType = Array.isArray(newMcpServers[mcp]?.[fieldKey]) ? "array" : typeof newMcpServers[mcp][fieldKey]
              if(FieldType[fieldKey].type === "select") {
                const field = FieldType[fieldKey]
                if("options" in field && !field.options?.includes(newMcpServers[mcp][fieldKey])) {
                  return false
                }
              } else if(FieldType[fieldKey].type !== fieldType) {
                return false
              }
            }
          }
        }
        return true
      } catch(e) {
        return false
      }
    }

    const createJsonLinter = () => {
      return linter((view) => {
        const doc = view.state.doc.toString()
        if (!doc.trim())
          return []

        try {
          let parsed = jsonlint.parse(doc)

          // handle when the json is not start with 'mcpServers' object
          if (Object.keys(parsed)[0] !== "mcpServers") {
            parsed = { mcpServers: parsed }
          }

          // mcpServers must contain exactly one tool
          if (Object.keys(parsed.mcpServers).length !== 1 && typeRef.current === "edit") {
            setIsFormatError(true)
            return [{
              from: 0,
              to: doc.length,
              message: t("tools.jsonFormatError1"),
              severity: "error",
            }]
          }

          // tool name cannot be empty
          if (Object.keys(parsed.mcpServers).some(key => key === "")) {
            setIsFormatError(true)
            return [{
              from: 0,
              to: doc.length,
              message: t("tools.jsonFormatError2"),
              severity: "error",
            }]
          }

          // Check for duplicate names in mcpList
          const names = mcpList.map(mcp => mcp.name)
          const showDuplicateError = names.some((name, index) =>
            names.indexOf(name) !== index && name === mcpList[currentMcpIndex].name
          )
          if (showDuplicateError) {
            setIsFormatError(true)
            return [{
              from: 0,
              to: doc.length,
              message: t("tools.jsonFormatError3", { mcp: mcpList[currentMcpIndex].name }),
              severity: "error",
            }]
          }

          // check field type
          for(const fieldKey of Object.keys(FieldType) as Array<keyof typeof FieldType>) {
            for(const mcp of Object.keys(parsed.mcpServers)) {
              if(parsed.mcpServers[mcp] && Object.keys(parsed.mcpServers[mcp]).some(key => key === fieldKey)) {
                const fieldType = Array.isArray(parsed.mcpServers[mcp][fieldKey]) ? "array" : typeof parsed.mcpServers[mcp][fieldKey]
                if(parsed.mcpServers[mcp]?.[fieldKey] && FieldType[fieldKey].type === "select") {
                  const field = FieldType[fieldKey]
                  if("options" in field && !field.options?.includes(parsed.mcpServers[mcp][fieldKey])) {
                    setIsFormatError(true)
                    return [{
                      from: 0,
                      to: doc.length,
                      message: t(FieldType[fieldKey].error, { mcp: mcp, options: field.options.flat().join(" / ") }),
                      severity: "error",
                    }]
                  }
                } else if(parsed.mcpServers[mcp]?.[fieldKey] && FieldType[fieldKey]?.type !== fieldType) {
                  setIsFormatError(true)
                  return [{
                    from: 0,
                    to: doc.length,
                    message: t(FieldType[fieldKey].error, { mcp: mcp }),
                    severity: "error",
                  }]
                }
              }
            }
          }

          setIsFormatError(false)
          return []
        } catch (e: any) {
          const lineMatch = e.message.match(/line\s+(\d+)/)
          const line = lineMatch ? parseInt(lineMatch[1]) : 1
          const linePos = view.state.doc.line(line)
          setIsFormatError(true)

          return [{
            from: linePos.from,
            to: linePos.to,
            message: e.message,
            severity: "error",
          }]
        }
      })
    }

    const inputTheme = EditorView.theme({
      ".cm-content": {
        color: "var(--text)",
      },
      ".cm-lineNumbers": {
        color: "var(--text)",
      },
    })

    const copyJson = () => {
      navigator.clipboard.writeText(mcpList[currentMcpIndex]?.jsonString)
      showToast({
        message: t("tools.jsonCopied"),
        type: "success"
      })
    }

    const downloadJson = () => {
      const blob = new Blob([mcpList[currentMcpIndex]?.jsonString], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${mcpList[currentMcpIndex]?.name?.length > 0 ? "mcpServers-"+mcpList[currentMcpIndex]?.name : "mcpServers"}.json`
      a.click()
    }

    const handleJsonChangeMcp = async (value: string) => {
      try {
        let newJson = jsonlint.parse(value)
        if(Object.keys(newJson)[0] !== "mcpServers") {
          newJson = { mcpServers: newJson }
        }
        const newMcpServers = newJson.mcpServers
        const newMcpName = Object.keys(newMcpServers)[0]
        if(Object.keys(newMcpServers).length > 1 && typeRef.current === "add") {
          typeRef.current = "add-json"
        } else if(Object.keys(newMcpServers).length === 1 && typeRef.current === "add-json") {
          typeRef.current = "add"
        }
        if(typeRef.current === "edit-json" || typeRef.current === "add-json") {
          setMcpList([{
            originalName: "",
            name: "",
            mcpServers: {},
            jsonString: value,
            isError: false
          }])
          setCurrentMcpIndex(0)
        } else if(isValidJSON(newJson)) {
          setMcpList(prev => {
            const newMcpList = [...prev]
            newMcpList[currentMcpIndex].jsonString = value
            newMcpList[currentMcpIndex].name = newMcpName
            newMcpList[currentMcpIndex].mcpServers = encodeMcpServers(newMcpServers[newMcpName])
            newMcpList[currentMcpIndex].isError = false
            return newMcpList
          })
        } else {
          setMcpList(prev => {
            const newMcpList = [...prev]
            newMcpList[currentMcpIndex].jsonString = value
            newMcpList[currentMcpIndex].isError = true
            return newMcpList
          })
        }
      } catch(e) {
        setMcpList(prev => {
          const newMcpList = [...prev]
          newMcpList[currentMcpIndex].jsonString = value
          newMcpList[currentMcpIndex].isError = true
          return newMcpList
        })
      }
    }

    return (
      <div className={`tool-edit-json-editor ${typeRef.current}`}>
        <div className="tool-edit-title">
          JSON
          <div className="tool-edit-desc">
            {t("tools.jsonDesc")}
          </div>
        </div>
        <CodeMirror
          minWidth={(typeRef.current === "edit-json" || typeRef.current === "add-json") ? "670px" : "400px"}
          placeholder={"{\n \"mcpServers\":{}\n}"}
          theme={theme === "system" ? systemTheme : theme}
          value={mcpList[currentMcpIndex]?.jsonString}
          extensions={[
            json(),
            lintGutter(),
            createJsonLinter(),
            inputTheme
          ]}
          onChange={(value, viewUpdate) => {
            let newJsonString = value
            if(!value.trim().startsWith("{")) {
              newJsonString = `{\n ${value}\n}`
            }
            handleJsonChangeMcp(newJsonString)
          }}
        />
        <div className="tool-edit-json-editor-copy">
          <Tooltip
            content={t("tools.jsonCopy")}
            side="bottom"
          >
            <div onClick={copyJson}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18px" height="18px" viewBox="0 0 22 22" fill="transparent">
                <path d="M13 20H2V6H10.2498L13 8.80032V20Z" fill="transparent" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinejoin="round"/>
                <path d="M13 9H10V6L13 9Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 3.5V2H17.2498L20 4.80032V16H16" fill="transparent" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinejoin="round"/>
                <path d="M20 5H17V2L20 5Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </Tooltip>
          <Tooltip
            content={t("tools.jsonDownload")}
            side="bottom"
          >
            <div onClick={downloadJson}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 1.81836L10 12.7275" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M6.33105 9.12305L9.99973 12.7917L13.6684 9.12305" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2.72754 13.6367V16.2731C2.72754 16.8254 3.17526 17.2731 3.72754 17.2731H16.273C16.8253 17.2731 17.273 16.8254 17.273 16.2731V13.6367" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </Tooltip>
        </div>
      </div>
    )
  }, [theme, systemTheme, mcpList, currentMcpIndex, typeRef])

  const mcpToolTitle = (type: string) => {
    switch(type) {
      case "edit":
        return t("tools.editTool", { tool: mcpList[currentMcpIndex]?.name })
      case "add":
        case "add-json":
        return t("tools.addTool")
      case "edit-json":
        return t("tools.editJsonTool")
    }
  }

  return (
    <PopupConfirm
      className={`tool-edit-popup-container ${typeRef.current}`}
      onConfirm={handleSubmit}
      onCancel={onCancel}
      disabled={isFormatError || !isValidName(mcpList, mcpList[currentMcpIndex]?.name) || mcpList.some(mcp => mcp.isError) || isSubmitting}
      zIndex={1000}
      listenHotkey={false}
      confirmText={isSubmitting ? (
        <div className="loading-spinner"></div>
      ) : t("tools.save")}
      footerHint={ typeRef.current.startsWith("edit") && onDelete && !isSubmitting &&
        <button
          onClick={() => onDelete(mcpList[currentMcpIndex]?.name)}
          className="tool-edit-delete"
        >
          {t("tools.delete")}
        </button>
      }
    >
      <div className="tool-edit-popup">
        {McpList}
        <div className="tool-edit-popup-content">
          <div className="tool-edit-header">
            <span>{mcpToolTitle(typeRef.current)}</span>
            <Tooltip content={t("tools.toogleTool.alt")} side="bottom" disabled={typeRef.current !== "edit"}>
              <div className="tool-edit-header-actions">
                {typeRef.current === "edit" &&
                  <Switch
                    checked={mcpList[currentMcpIndex]?.mcpServers.enabled || false}
                    onChange={() => handleMcpChange("enabled", !mcpList[currentMcpIndex]?.mcpServers.enabled)}
                  />}
              </div>
            </Tooltip>
          </div>
          <div className="tool-edit-content">
            {Field}
            {JSONEditor}
          </div>
        </div>
      </div>
    </PopupConfirm>
  )
}

