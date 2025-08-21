// @ts-nocheck
import jsonlint from "jsonlint-mod"
import React, { useEffect, useState, useRef, useMemo, useCallback, memo } from "react"
import { useTranslation } from "react-i18next"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { showToastAtom } from "../../atoms/toastState"
import CodeMirror, { EditorView } from "@uiw/react-codemirror"
import { json } from "@codemirror/lang-json"
import { linter, lintGutter } from "@codemirror/lint"
import { systemThemeAtom, themeAtom } from "../../atoms/themeState"
import { closeOverlayAtom } from "../../atoms/layerState"
import Switch from "../../components/Switch"
import { loadMcpConfigAtom, loadToolsAtom, MCPConfig, mcpConfigAtom, Tool, toolsAtom, installToolBufferAtom } from "../../atoms/toolState"
import Tooltip from "../../components/Tooltip"
import PopupConfirm from "../../components/PopupConfirm"
import Dropdown from "../../components/DropDown"
import { imgPrefix } from "../../ipc"
import OAPServerList from "./Model/Popup/OAPServerList"
import Tabs from "../../components/Tabs"
import { OAPMCPServer } from "../../../types/oap"
import { isLoggedInOAPAtom, loadOapToolsAtom, oapToolsAtom } from "../../atoms/oapState"
import { OAP_ROOT_URL } from "../../../shared/oap"
import { openUrl } from "../../ipc/util"
import { oapApplyMCPServer } from "../../ipc"
import cloneDeep from "lodash/cloneDeep"
import { ClickOutside } from "../../components/ClickOutside"
import Button from "../../components/Button"

interface ToolsCache {
  [key: string]: {
    type: "oap" | "local"
    oapId?: string
    plan?: string
    description: string
    icon?: string
    subTools: {
      name: string
      description: string
      enabled: boolean
    }[]
    disabled: boolean
  }
}

const ToolLog = memo(({ toolLog }: { toolLog: string }) => {
  return (
    <div>
      {toolLog.split("\n").map((line: string, index: number) => (
        <div key={index}>{line}</div>
      ))}
    </div>
  )
})

const Tools = () => {
  const { t } = useTranslation()
  const [tools, setTools] = useAtom(toolsAtom)
  const [oapTools, setOapTools] = useAtom(oapToolsAtom)
  const [mcpConfig, setMcpConfig] = useAtom(mcpConfigAtom)
  const [isLoading, setIsLoading] = useState(false)
  const showToast = useSetAtom(showToastAtom)
  const closeOverlay = useSetAtom(closeOverlayAtom)
  const toolsCacheRef = useRef<ToolsCache>({})
  const loadTools = useSetAtom(loadToolsAtom)
  const [showDeletePopup, setShowDeletePopup] = useState(false)
  const [showMcpEditPopup, setShowMcpEditPopup] = useState(false)
  const [showMcpAddPopup, setShowMcpAddPopup] = useState(false)
  const [showMcpEditJsonPopup, setShowMcpEditJsonPopup] = useState(false)
  const [showOapMcpPopup, setShowOapMcpPopup] = useState(false)
  const [showUnsavedSubtoolsPopup, setShowUnsavedSubtoolsPopup] = useState(false)
  const [changingTool, setChangingTool] = useState<string>("")
  const [currentMcp, setCurrentMcp] = useState<string>("")
  const abortControllerRef = useRef<AbortController | null>(null)
  const [toolLog, setToolLog] = useState<LogType[]>([])
  const [toolType, setToolType] = useState<"all" | "oap" | "local">("all")
  const isLoggedInOAP = useAtomValue(isLoggedInOAPAtom)
  const loadMcpConfig = useSetAtom(loadMcpConfigAtom)
  const loadOapTools = useSetAtom(loadOapToolsAtom)
  const [isResort, setIsResort] = useState(true)
  const sortedConfigOrderRef = useRef<string[]>([])
  const [expandedSections, setExpandedSections] = useState<string[]>([])
  const [installToolBuffer, setInstallToolBuffer] = useAtom(installToolBufferAtom)

  // consume install tool buffer
  useEffect(() => {
    if (!installToolBuffer.length) {
      return
    }

    const cfg = cloneDeep(mcpConfig.mcpServers)
    const install = ({ name, config }: { name: string, config: Record<string, MCP> }) => {
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
    handleConfigSubmit({ mcpServers: cfg })
  }, [installToolBuffer.length])

  useEffect(() => {
    (async () => {
      const cachedTools = localStorage.getItem("toolsCache")
      if (cachedTools) {
        toolsCacheRef.current = JSON.parse(cachedTools)
      }

      await updateToolsCache()
    })()

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [showMcpEditPopup, showMcpAddPopup, showMcpEditJsonPopup])

  const isOapTool = (toolName: string) => {
    return oapTools?.find(oapTool => oapTool.name === toolName) ? true : false
  }

  const updateToolsCache = async () => {
    await loadTools()

    let _oapTools: OAPMCPServer[] = []
    setOapTools((oapTools) => {
      _oapTools = oapTools
      return oapTools
    })

    const newCache: ToolsCache = {}
    setTools(prevTools => {
      prevTools.forEach((tool: Tool) => {
        newCache[tool.name] = {
          type: _oapTools && _oapTools.find(oapTool => oapTool.name === tool.name) ? "oap" : "local",
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

      toolsCacheRef.current = {...toolsCacheRef.current, ...newCache}
      localStorage.setItem("toolsCache", JSON.stringify(toolsCacheRef.current))
      return prevTools
    })
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

      if (!("exclude_tools" in config.mcpServers[key])) {
        config.mcpServers[key].exclude_tools = []
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
          if((newConfig.mcpServers as Record<string, any>)[serverName]) {
            (newConfig.mcpServers as Record<string, any>)[serverName].disabled = true
          }
          return newConfig
        })
      })
    }
    if(data?.detail?.filter((item: any) => item.type.includes("error")).length > 0) {
      data?.detail?.filter((item: any) => item.type.includes("error"))
        .map((e: any) => [e.loc[2], e.msg])
        .forEach(([serverName, error]: [string, string]) => {
          if(isShowToast) {
            showToast({
              message: t("tools.updateFailed", { serverName, error }),
              type: "error",
              closable: true
            })
          }
        })
    }
    if(data.errors?.filter((error: any) => error.serverName === tool.name).length === 0 &&
        data?.detail?.filter((item: any) => item.type.includes("error")).length === 0) {
        showToast({
          message: t("tools.saveSuccess"),
          type: "success"
        })
    }
  }

  const handleConfigSubmit = async (newConfig: {mcpServers: MCPConfig}) => {
    setIsLoading(true)
    try {
      // const filledConfig = await window.ipcRenderer.fillPathToConfig(JSON.stringify(newConfig))
      const filledConfig = { ...newConfig }
      const data = await updateMCPConfig(filledConfig)
      if (data?.errors && Array.isArray(data.errors) && data.errors.length) {
        data.errors
          .map((e: any) => e.serverName)
          .forEach((serverName: string) => {
            if(newConfig.mcpServers[serverName]) {
              newConfig.mcpServers[serverName].disabled = true
            }
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
      if (data?.success) {
        setMcpConfig(newConfig)
        setShowMcpEditJsonPopup(false)
        setShowMcpEditPopup(false)
        await loadMcpConfig()
        await updateToolsCache()
        handleUpdateConfigResponse(data)
        setIsResort(true)
      }
    } catch (error) {
      console.error("Failed to update MCP config:", error)
      showToast({
        message: t("tools.saveFailed"),
        type: "error"
      })
      setShowMcpEditJsonPopup(false)
      setShowMcpEditPopup(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteTool = async(toolName: string) => {
    setCurrentMcp(toolName)
    setShowDeletePopup(true)
  }

  const deleteTool = async (toolName: string) => {
    setIsLoading(true)
    if(isOapTool(toolName)) {
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
  }

  const deleteAllTools = async () => {
    setIsLoading(true)
    const newConfig = JSON.parse(JSON.stringify(mcpConfig))
    newConfig.mcpServers = {}
    await updateMCPConfig(newConfig)
    setMcpConfig(newConfig)
    await loadOapTools()
    await updateToolsCache()
    setIsResort(true)
    setIsLoading(false)
  }

  const toggleTool = async (tool: Tool) => {
    try {
      setIsLoading(true)
      const currentEnabled = tool.enabled

      const newConfig = JSON.parse(JSON.stringify(mcpConfig))
      newConfig.mcpServers[tool.name].enabled = !currentEnabled
      if(newConfig.mcpServers[tool.name].enabled && tool.tools.every(subTool => !subTool.enabled)) {
        newConfig.mcpServers[tool.name].exclude_tools = []
      }

      const data = await updateMCPConfig(newConfig)
      if (data.errors && Array.isArray(data.errors) && data.errors.length) {
        data.errors
          .map((e: any) => e.serverName)
          .forEach((serverName: string) => {
            if(newConfig.mcpServers[serverName]) {
              newConfig.mcpServers[serverName].disabled = true
            }
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

      if(data.errors?.filter((error: any) => error.serverName === tool.name).length === 0 &&
        data?.detail?.filter((item: any) => item.type.includes("error")).length === 0) {
        showToast({
          message: t("tools.saveSuccess"),
          type: "success"
        })
      }

      if (data.success) {
        setMcpConfig(newConfig)
        await loadOapTools()
        await updateToolsCache()
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

  const toggleToolSection = (name: string) => {
    setExpandedSections(prev =>
      prev.includes(name)
        ? prev.filter(n => n !== name)
        : [...prev, name]
    )
  }

  const handleUnsavedSubtools = (toolName: string, event?: MouseEvent) => {
    // check current changing tool is the same as the toolName
    if(changingTool !== "" && changingTool === toolName) {
      event?.preventDefault()
      setShowUnsavedSubtoolsPopup(true)
    }
    return
  }

  const arrayEqual = (arr1: any[], arr2: any[]) => {
    if (arr1.length !== arr2.length)
      return false
    const sortedA = [...arr1].sort()
    const sortedB = [...arr2].sort()
    return sortedA.every((val, index) => val === sortedB[index])
  }

  const toggleSubTool = async (toolName: string, subToolName: string, action: "add" | "remove") => {
    const newTools = [...tools]
    const tool = newTools.find(tool => tool.name === toolName)
    const subToolIndex = tool?.tools?.findIndex(subTool => subTool.name === subToolName)

    if(tool?.enabled) {
      if(tool?.tools && subToolIndex > -1) {
        if(action === "add") {
          tool.tools[subToolIndex].enabled = false
        } else {
          tool.tools[subToolIndex].enabled = true
        }
      }

      if(tool?.tools.filter(subTool => subTool.enabled).length === 0) {
        tool.enabled = false
        //if closing all subtools, make tool disabled, check if tool is disabled originally
        //disabled Originally: it means it still in draft, recover all subtools state
        if(!mcpConfig.mcpServers[toolName].enabled) {
          tool.tools.map(subTool => {
            subTool.enabled = true
            if(mcpConfig.mcpServers[toolName].exclude_tools.includes(subTool.name)) {
              subTool.enabled = false
            }
          })
        }
      } else {
        tool.enabled = true
      }
    } else {
      tool.enabled = true
      tool.tools.map(subTool => {
        subTool.enabled = false
        if(subTool.name === subToolName) {
          subTool.enabled = true
        }
      })
    }

    setTools(newTools)

    //Compare disabled tools of tools(temporary disabled tools) and mcpConfig.mcpServers[toolName].exclude_tools(actually disabled tools)
    const newDisabledSubTools = newTools.find(tool => tool.name === toolName)?.tools.filter(subTool => !subTool.enabled).map(subTool => subTool.name)
    if(!arrayEqual(newDisabledSubTools, mcpConfig.mcpServers[toolName].exclude_tools) ||
    tool?.enabled !== mcpConfig.mcpServers[toolName].enabled) {
      setChangingTool(toolName)
    } else {
      setChangingTool("")
    }
  }

  const toggleSubToolConfirm = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    setShowUnsavedSubtoolsPopup(false)
    setChangingTool("")
    setIsLoading(true)
    const newConfig = JSON.parse(JSON.stringify(mcpConfig))
    Object.keys(newConfig.mcpServers).forEach(toolName => {
      const tool = tools.find(tool => tool.name === toolName)
      const newDisabledSubTools = tool?.tools.filter(subTool => !subTool.enabled).map(subTool => subTool.name)
      if(tool?.tools.length === newDisabledSubTools.length) {
        newConfig.mcpServers[toolName].enabled = false
      } else {
        newConfig.mcpServers[toolName].enabled = tool?.enabled
      }
      newConfig.mcpServers[toolName].exclude_tools = newDisabledSubTools
    })

    setMcpConfig(newConfig)
    await updateMCPConfig(newConfig)
    await loadTools()
    setIsLoading(false)
  }

  const toggleSubToolCancel = async () => {
    setShowUnsavedSubtoolsPopup(false)
    setChangingTool("")
    setIsLoading(true)
    await loadTools()
    setIsLoading(false)
  }

  const handleReloadMCPServers = async () => {
    setIsLoading(true)
    await fetch("/api/plugins/oap-platform/config/refresh", {
      method: "POST",
    })
    await updateMCPConfig(mcpConfig, true)
    const mcpServers = (mcpConfig.mcpServers as Record<string, any>)
    const disabledTools = Object.keys(toolsCacheRef.current).filter(tool => toolsCacheRef.current[tool]?.disabled && mcpServers[tool]?.enabled)
    const newDisabledTools = Object.keys(toolsCacheRef.current).filter(tool => toolsCacheRef.current[tool]?.disabled && mcpServers[tool]?.enabled)
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
    await loadOapTools()
    await loadMcpConfig()
    await updateToolsCache()
    setIsResort(true)
    setIsLoading(false)
  }

  const handlePost = useCallback(async (toolName: string) => {
    setToolLog([])
    const response = await fetch(`/api/tools/${toolName}/logs/stream?stream_until=running&stop_on_notfound=false&max_retries=10`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    const reader = response.body!.getReader()

    return reader
  }, [])

  const handleAddSubmit = async (newConfig: Record<string, any>) => {
    const mergedConfig = mcpConfig
    const configKeys = Object.keys(newConfig)
    if (configKeys.includes("mcpServers")) {
      mergedConfig.mcpServers = { ...mergedConfig.mcpServers, ...newConfig.mcpServers }
    }

    mergedConfig.mcpServers = configKeys.reduce((acc, key) => {
      if (("command" in newConfig[key] && "args" in newConfig[key]) || "url" in newConfig[key]) {
        acc[key] = { ...(mergedConfig.mcpServers?.[key as any] as any || {}), ...newConfig[key] }
      }
      return acc
    }, mergedConfig.mcpServers)

    mergedConfig.mcpServers = Object.keys(mergedConfig.mcpServers).reduce((acc, key) => {
      if (!("enabled" in acc[key])) {
        acc[key].enabled = true
      }
      return acc
    }, mergedConfig.mcpServers)

    try{
      const reader = await handlePost(Object.keys(newConfig.mcpServers)[0] as string)
      const decoder = new TextDecoder()
      let chunkBuf = ""

      setTimeout(async () => {
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
              setToolLog(prevLog => [...prevLog, dataObj])
            } catch (error) {
              console.warn(error)
            }
          }
        }
      }, 0)
      await handleConfigSubmit(mergedConfig)
      setShowMcpAddPopup(false)
    } catch (error) {
      console.error("Failed to add MCP server:", error)
      showToast({
        message: t("tools.saveFailed"),
        type: "error"
      })
    }
  }

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

      return 0
    }

    const sortedConfigOrder = configOrder.sort(toolSort)
    if(isResort) {
      sortedConfigOrderRef.current = sortedConfigOrder
    }
    setIsResort(false)
    const toolMap = new Map(
      tools.filter(tool => !(isOapTool(tool.name) && !isLoggedInOAP))
          .map(tool => [tool.name, tool])
    )

    const configTools = sortedConfigOrder.map(name => {
      if (toolMap.has(name)) {
        const tool = toolMap.get(name)!
        return {
          ...tool,
          disabled: Boolean(tool?.error),
          type: isOapTool(name) ? "oap" : "local" as const,
          plan: isOapTool(name) ? oapTools?.find(oapTool => oapTool.name === name)?.plan : undefined,
          oapId: isOapTool(name) ? oapTools?.find(oapTool => oapTool.name === name)?.id : undefined,
        }
      }

      const cachedTool = toolsCacheRef.current[name]
      const mcpServers = (mcpConfig.mcpServers as Record<string, any>)
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
          error: mcpServers[name]?.error,
          disabled: Boolean(mcpServers[name]?.disabled || mcpServers[name]?.error),
          type: isOapTool(name) ? "oap" : "local" as const,
          plan: isOapTool(name) ? oapTools?.find(oapTool => oapTool.name === name)?.plan : undefined,
          oapId: isOapTool(name) ? oapTools?.find(oapTool => oapTool.name === name)?.id : undefined
        }
      }

      return {
        name,
        description: "",
        enabled: false,
        disabled: Boolean(mcpServers[name]?.disabled || mcpServers[name]?.error),
        type: isOapTool(name) ? "oap" : "local" as const,
        plan: isOapTool(name) ? oapTools?.find(oapTool => oapTool.name === name)?.plan : undefined,
        oapId: isOapTool(name) ? oapTools?.find(oapTool => oapTool.name === name)?.id : undefined
      }
    })

    return [...configTools].filter(tool => toolType === "all" || tool.type === toolType)
  }, [tools, oapTools, mcpConfig.mcpServers, toolType])

  const toolMenu = (tool: Tool & { type: string }) => {
    return [
      { label:
          <div className="tool-edit-menu-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 17 16" fill="none">
              <path d="M3.83333 14C3.46667 14 3.15278 13.8694 2.89167 13.6083C2.63056 13.3472 2.5 13.0333 2.5 12.6667V3.33333C2.5 2.96667 2.63056 2.65278 2.89167 2.39167C3.15278 2.13056 3.46667 2 3.83333 2H7.83333C8.02222 2 8.18056 2.06389 8.30833 2.19167C8.43611 2.31944 8.5 2.47778 8.5 2.66667C8.5 2.85556 8.43611 3.01389 8.30833 3.14167C8.18056 3.26944 8.02222 3.33333 7.83333 3.33333H3.83333V12.6667H13.1667V8.66667C13.1667 8.47778 13.2306 8.31944 13.3583 8.19167C13.4861 8.06389 13.6444 8 13.8333 8C14.0222 8 14.1806 8.06389 14.3083 8.19167C14.4361 8.31944 14.5 8.47778 14.5 8.66667V12.6667C14.5 13.0333 14.3694 13.3472 14.1083 13.6083C13.8472 13.8694 13.5333 14 13.1667 14H3.83333ZM13.1667 4.26667L7.43333 10C7.31111 10.1222 7.15556 10.1833 6.96667 10.1833C6.77778 10.1833 6.62222 10.1222 6.5 10C6.37778 9.87778 6.31667 9.72222 6.31667 9.53333C6.31667 9.34444 6.37778 9.18889 6.5 9.06667L12.2333 3.33333H10.5C10.3111 3.33333 10.1528 3.26944 10.025 3.14167C9.89722 3.01389 9.83333 2.85556 9.83333 2.66667C9.83333 2.47778 9.89722 2.31944 10.025 2.19167C10.1528 2.06389 10.3111 2 10.5 2H13.8333C14.0222 2 14.1806 2.06389 14.3083 2.19167C14.4361 2.31944 14.5 2.47778 14.5 2.66667V6C14.5 6.18889 14.4361 6.34722 14.3083 6.475C14.1806 6.60278 14.0222 6.66667 13.8333 6.66667C13.6444 6.66667 13.4861 6.60278 13.3583 6.475C13.2306 6.34722 13.1667 6.18889 13.1667 6V4.26667Z" fill="currentColor"/>
            </svg>
            {t("tools.toolMenu.detail")}
          </div>,
        onClick: () => {
          openUrl(`${OAP_ROOT_URL}/mcp/${tool.oapId}`)
        },
        active: isOapTool(tool.name)
      },
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
            {t("tools.toolMenu.reload")}
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
            {t("tools.toolMenu.edit")}
          </div>,
        onClick: () => {
          setCurrentMcp(tool.name)
          setShowMcpEditPopup(true)
        },
        active: tool.type !== "oap"
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
            {t("tools.toolMenu.delete")}
          </div>,
        onClick: () => {
          setCurrentMcp(tool.name)
          setShowDeletePopup(true)
        },
        active: true
      }
    ].filter(option => option.active)
  }

  useEffect(() => {
    setExpandedSections(prev =>
      prev.filter(name => sortedTools.some(tool => tool.name === name))
    )
  }, [sortedTools])

  return (
    <div className="tools-page overlay-page">
      <div className="tools-container">
        <div className="tools-header">
          <div>
            <h1>{t("tools.title")}</h1>
            <p className="subtitle">{t("tools.subtitle")}</p>
          </div>
          <div className="header-actions">
            {isLoggedInOAP &&
              <Tooltip content={t("tools.addOapMcpAlt")}>
                <Button
                  onClick={() => {
                    setShowOapMcpPopup(true)
                  }}
                  color="blue"
                  size="fit"
                  padding="xs"
                >
                  <img className="oap-logo" src={`${imgPrefix}logo_oap.png`} alt="info" />
                  OAP MCP Servers
                </Button>
              </Tooltip>
            }

            <Tooltip content={t("tools.addServerAlt")}>
              <Button
                onClick={() => {
                  setToolLog([])
                  setShowMcpAddPopup(true)
                }}
                color="success-green"
                size="fit"
                padding="xs"
              >
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
                {t("tools.addServer")}
              </Button>
            </Tooltip>

            <Tooltip content={t("tools.editConfigAlt")}>
              <Button
                onClick={() => {
                  setCurrentMcp(sortedTools.find(tool => tool.type === "local")?.name || "")
                  setShowMcpEditPopup(true)
                }}
                disabled={sortedTools.find(tool => tool.type === "local") ? false : true}
                color="blue"
                size="fit"
                padding="xs"
              >
                {t("tools.editConfig")}
              </Button>
            </Tooltip>

            <Tooltip content={t("tools.reloadMCPServersAlt")}>
              <Button
                className="reload-btn"
                onClick={() => handleReloadMCPServers()}
                color="white"
                size="fit"
              >
                <svg width="16" height="16" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <g clipPath="url(#clip0_6_586)">
                    <path d="M11 5C9.41775 5 7.87103 5.46919 6.55544 6.34824C5.23985 7.22729 4.21446 8.47672 3.60896 9.93853C3.00346 11.4003 2.84504 13.0089 3.15372 14.5607C3.4624 16.1126 4.22433 17.538 5.34315 18.6569C6.46197 19.7757 7.88743 20.5376 9.43928 20.8463C10.9911 21.155 12.5997 20.9965 14.0615 20.391C15.5233 19.7855 16.7727 18.7602 17.6518 17.4446C18.5308 16.129 19 14.5823 19 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
                    <path d="M16.4382 5.40544C16.7147 5.20587 16.7147 4.79413 16.4382 4.59456L11.7926 1.24188C11.4619 1.00323 11 1.23952 11 1.64733L11 8.35267C11 8.76048 11.4619 8.99676 11.7926 8.75812L16.4382 5.40544Z" fill="currentColor"/>
                  </g>
                  <defs>
                  <clipPath id="clip0_6_586">
                    <rect width="22" height="22" fill="currentColor" transform="matrix(-1 0 0 1 22 0)"/>
                  </clipPath>
                  </defs>
                </svg>
                {t("tools.reloadMCPServers")}
              </Button>
            </Tooltip>
          </div>
        </div>

        <div className="tools-list">
          {isLoggedInOAP &&
            <Tabs
              className="tools-type-tabs"
              tabs={[{ label: t("tools.tabAll"), value: "all" }, { label: t("tools.tabOap"), value: "oap" }, { label: t("tools.tabLocal"), value: "local" }]}
              value={toolType}
              onChange={setToolType}
            />
          }
          {sortedTools.length === 0 && !isLoading &&
            <div className="no-oap-result-container">
              <div className="cloud-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="41" height="41" viewBox="0 0 41 41" fill="none">
                  <path d="M24.4 40.3C23.9 40.5667 23.3917 40.6083 22.875 40.425C22.3583 40.2417 21.9667 39.9 21.7 39.4L18.7 33.4C18.4333 32.9 18.3917 32.3917 18.575 31.875C18.7583 31.3583 19.1 30.9667 19.6 30.7C20.1 30.4333 20.6083 30.3917 21.125 30.575C21.6417 30.7583 22.0333 31.1 22.3 31.6L25.3 37.6C25.5667 38.1 25.6083 38.6083 25.425 39.125C25.2417 39.6417 24.9 40.0333 24.4 40.3ZM36.4 40.3C35.9 40.5667 35.3917 40.6083 34.875 40.425C34.3583 40.2417 33.9667 39.9 33.7 39.4L30.7 33.4C30.4333 32.9 30.3917 32.3917 30.575 31.875C30.7583 31.3583 31.1 30.9667 31.6 30.7C32.1 30.4333 32.6083 30.3917 33.125 30.575C33.6417 30.7583 34.0333 31.1 34.3 31.6L37.3 37.6C37.5667 38.1 37.6083 38.6083 37.425 39.125C37.2417 39.6417 36.9 40.0333 36.4 40.3ZM12.4 40.3C11.9 40.5667 11.3917 40.6083 10.875 40.425C10.3583 40.2417 9.96667 39.9 9.7 39.4L6.7 33.4C6.43333 32.9 6.39167 32.3917 6.575 31.875C6.75833 31.3583 7.1 30.9667 7.6 30.7C8.1 30.4333 8.60833 30.3917 9.125 30.575C9.64167 30.7583 10.0333 31.1 10.3 31.6L13.3 37.6C13.5667 38.1 13.6083 38.6083 13.425 39.125C13.2417 39.6417 12.9 40.0333 12.4 40.3ZM11.5 28.5C8.46667 28.5 5.875 27.425 3.725 25.275C1.575 23.125 0.5 20.5333 0.5 17.5C0.5 14.7333 1.41667 12.3167 3.25 10.25C5.08333 8.18333 7.35 6.96667 10.05 6.6C11.1167 4.7 12.575 3.20833 14.425 2.125C16.275 1.04167 18.3 0.5 20.5 0.5C23.5 0.5 26.1083 1.45833 28.325 3.375C30.5417 5.29167 31.8833 7.68333 32.35 10.55C34.65 10.75 36.5833 11.7 38.15 13.4C39.7167 15.1 40.5 17.1333 40.5 19.5C40.5 22 39.625 24.125 37.875 25.875C36.125 27.625 34 28.5 31.5 28.5H11.5ZM11.5 24.5H31.5C32.9 24.5 34.0833 24.0167 35.05 23.05C36.0167 22.0833 36.5 20.9 36.5 19.5C36.5 18.1 36.0167 16.9167 35.05 15.95C34.0833 14.9833 32.9 14.5 31.5 14.5H28.5V12.5C28.5 10.3 27.7167 8.41667 26.15 6.85C24.5833 5.28333 22.7 4.5 20.5 4.5C18.9 4.5 17.4417 4.93333 16.125 5.8C14.8083 6.66667 13.8167 7.83333 13.15 9.3L12.65 10.5H11.4C9.5 10.5667 7.875 11.275 6.525 12.625C5.175 13.975 4.5 15.6 4.5 17.5C4.5 19.4333 5.18333 21.0833 6.55 22.45C7.91667 23.8167 9.56667 24.5 11.5 24.5Z" fill="currentColor"/>
                </svg>
              </div>
              <div>
                <div className="no-oap-result-title">
                  {t("tools.no_tool_title")}
                </div>
                <div className="no-oap-result-message">
                  {isLoggedInOAP ? t(`tools.no_oap_tool_message.${toolType}`) : t("tools.no_tool_message")}
                </div>
              </div>
            </div>
          }
          {sortedTools.map((tool, index) => (
            <div key={tool.name} id={`tool-${index}`} onClick={() => toggleToolSection(tool.name)} className={`tool-section ${tool.disabled ? "disabled" : ""} ${tool.enabled ? "enabled" : ""} ${expandedSections.includes(tool.name) ? "expanded" : ""}`}>
              <div className="tool-header-container">
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
                    {tool.type === "oap" ?
                      <img className="oap-logo" src={`${imgPrefix}logo_oap.png`} alt="info" />
                    :
                      <svg width="20" height="20" viewBox="0 0 24 24">
                        <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
                      </svg>
                    }
                    <span className="tool-name">{tool.name}</span>
                    {isOapTool(tool.name) && tool.oapId &&
                      <>
                        <div className={`tool-tag ${tool.plan}`}>
                          {tool.plan}
                        </div>
                        <Tooltip content={t("tools.oapStoreLinkAlt")}>
                          <button className="oap-store-link" onClick={(e) => {
                            e.stopPropagation()
                            window.open(`${OAP_ROOT_URL}/mcp/${tool.oapId}`, "_blank")
                          }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 17 16" fill="none">
                              <path d="M3.83333 14C3.46667 14 3.15278 13.8694 2.89167 13.6083C2.63056 13.3472 2.5 13.0333 2.5 12.6667V3.33333C2.5 2.96667 2.63056 2.65278 2.89167 2.39167C3.15278 2.13056 3.46667 2 3.83333 2H7.83333C8.02222 2 8.18056 2.06389 8.30833 2.19167C8.43611 2.31944 8.5 2.47778 8.5 2.66667C8.5 2.85556 8.43611 3.01389 8.30833 3.14167C8.18056 3.26944 8.02222 3.33333 7.83333 3.33333H3.83333V12.6667H13.1667V8.66667C13.1667 8.47778 13.2306 8.31944 13.3583 8.19167C13.4861 8.06389 13.6444 8 13.8333 8C14.0222 8 14.1806 8.06389 14.3083 8.19167C14.4361 8.31944 14.5 8.47778 14.5 8.66667V12.6667C14.5 13.0333 14.3694 13.3472 14.1083 13.6083C13.8472 13.8694 13.5333 14 13.1667 14H3.83333ZM13.1667 4.26667L7.43333 10C7.31111 10.1222 7.15556 10.1833 6.96667 10.1833C6.77778 10.1833 6.62222 10.1222 6.5 10C6.37778 9.87778 6.31667 9.72222 6.31667 9.53333C6.31667 9.34444 6.37778 9.18889 6.5 9.06667L12.2333 3.33333H10.5C10.3111 3.33333 10.1528 3.26944 10.025 3.14167C9.89722 3.01389 9.83333 2.85556 9.83333 2.66667C9.83333 2.47778 9.89722 2.31944 10.025 2.19167C10.1528 2.06389 10.3111 2 10.5 2H13.8333C14.0222 2 14.1806 2.06389 14.3083 2.19167C14.4361 2.31944 14.5 2.47778 14.5 2.66667V6C14.5 6.18889 14.4361 6.34722 14.3083 6.475C14.1806 6.60278 14.0222 6.66667 13.8333 6.66667C13.6444 6.66667 13.4861 6.60278 13.3583 6.475C13.2306 6.34722 13.1667 6.18889 13.1667 6V4.26667Z" fill="currentColor"/>
                            </svg>
                          </button>
                        </Tooltip>
                      </>
                    }
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <Dropdown
                      options={toolMenu(tool)}
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
                  <span className="tool-toggle">
                    {(tool.description || (tool.tools?.length ?? 0) > 0 || tool.error) && "▼"}
                  </span>
                </div>
                {!tool.enabled ?
                  <div className="tool-content-sub-title">
                    {t("tools.disabledDescription")}
                  </div>
                :
                  (tool.tools && tool.tools.length > 0) ? (
                    <div className="tool-content-sub-title">
                      {t("tools.subToolsCount", { count: tool.tools?.filter(subTool => subTool.enabled).length || 0, total: tool.tools?.length || 0 })}
                    </div>
                  ) : null
                }
              </div>
              {(tool.description || (tool.tools?.length ?? 0) > 0 || tool.error) && (
                <div onClick={(e) => {
                  if(changingTool !== "" && changingTool === tool.name) {
                    e.stopPropagation()
                  }
                }}>
                  <div className="tool-content-container">
                    {tool.error ? (
                      <div className="tool-content">
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
                      </div>
                    ) : (
                      <>
                        {tool.description && (
                          <div className="tool-content">
                            <div className="tool-description">{tool.description}</div>
                          </div>
                        )}
                        {tool.tools && tool.tools.length > 0 && (
                          <ClickOutside onClickOutside={(event) => handleUnsavedSubtools(tool.name, event)}>
                            <div className="tool-content">
                              <div className="sub-tools">
                                {tool.tools.map((subTool, subIndex) => (
                                  <Tooltip
                                    key={subIndex}
                                    content={subTool.description}
                                    disabled={!subTool.description}
                                    align="start"
                                  >
                                    <div key={subIndex} className={`sub-tool ${(subTool.enabled && tool.enabled) ? "active" : ""}`} onClick={(e) => {
                                      e.stopPropagation()
                                      toggleSubTool(tool.name, subTool.name, (!subTool.enabled || !tool.enabled) ? "remove" : "add")
                                    }}>
                                      <div className="sub-tool-content">
                                          <div className="sub-tool-name">{subTool.name}</div>
                                      </div>
                                    </div>
                                  </Tooltip>
                                ))}
                              </div>
                            </div>
                            <div className="sub-tools-footer">
                              <button className={`sub-tools-footer-confirm-btn ${changingTool === tool.name ? "active" : ""}`} onClick={toggleSubToolConfirm}>{t("common.save")}</button>
                            </div>
                          </ClickOutside>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
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
          toolLog={toolLog}
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
          className="unsaved-subtools-popup"
          footerType="center"
          zIndex={1000}
          onConfirm={toggleSubToolConfirm}
          onCancel={toggleSubToolCancel}
          cancelText={t("tools.unsavedSubtools.cancel")}
        >
          <div className="unsaved-subtools-content">
            <div className="unsaved-subtools-header">
              {t("tools.unsavedSubtools.title")}
            </div>
            <div className="unsaved-subtools-desc">
              {t("tools.unsavedSubtools.desc")}
            </div>
          </div>
        </PopupConfirm>
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
  isRangeError: { isError: boolean, fieldKey: string }
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
  onSubmit: (config: {mcpServers: MCPConfig}) => Promise<void>
  toolLog?: Array<LogType>
}

interface LogType {
  body: string
  client_state: string
  event: string
  mcp_server_name: string
  timestamp: string
}

const FieldType = {
  "enabled": {
    type: "boolean",
    error: "tools.jsonFormatError.enabled"
  },
  "command": {
    type: "string",
    error: "tools.jsonFormatError.command"
  },
  "args": {
    type: "array",
    error: "tools.jsonFormatError.args"
  },
  "env": {
    type: "object",
    error: "tools.jsonFormatError.env"
  },
  "url": {
    type: "string",
    error: "tools.jsonFormatError.url"
  },
  "transport": {
    type: "select",
    options: ["stdio", "sse", "streamable", "websocket"] as const,
    error: "tools.jsonFormatError.transport"
  },
  "initialTimeout": {
    type: "number",
    min: 10,
    minError: "tools.jsonFormatError.minRange"
  }
}

const McpEditPopup = React.memo(({ _type, _config, _mcpName, onDelete, onCancel, onSubmit, toolLog }: mcpEditPopupProps) => {
  const typeRef = useRef(_type)
  const { t } = useTranslation()
  const [mcpList, setMcpList] = useState<mcpListProps[]>([])
  const [currentMcpIndex, setCurrentMcpIndex] = useState(0)
  const [isFormatError, setIsFormatError] = useState(false)
  const [isRangeError, setIsRangeError] = useState(false)
  const theme = useAtomValue(themeAtom)
  const systemTheme = useAtomValue(systemThemeAtom)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showToast = useSetAtom(showToastAtom)
  const logContentRef = useRef<HTMLDivElement>(null)

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
      Object.keys(newConfig.mcpServers)
      .filter((mcpName) => !newConfig.mcpServers[mcpName]?.extraData?.oap)
      .sort((a, b) => {
        const aEnabled = newConfig.mcpServers[a]?.enabled
        const bEnabled = newConfig.mcpServers[b]?.enabled
        if (aEnabled && !bEnabled)
          return -1
        if (!aEnabled && bEnabled)
          return 1
      })
      .forEach((mcpName) => {
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
          isError: !isValidName(newMcpList, mcpName) || !isValidField(encodeMcpServers(newConfig.mcpServers[mcpName])),
          isRangeError: isValidRange(encodeMcpServers(newConfig.mcpServers[mcpName]))
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
        isError: false,
        isRangeError: { isError: false, fieldKey: "" }
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
    } catch(e) {
      console.error(e)
    }
  }, [mcpList, currentMcpIndex, typeRef])

  useEffect(() => {
    if(logContentRef.current) {
      logContentRef.current.scrollTop = logContentRef.current.scrollHeight
    }
  }, [toolLog])

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
      newMcpList.forEach(mcp => mcp.isRangeError = isValidRange(mcp.mcpServers))
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
          if(FieldType[fieldKey].type === "number") {
            const isRangeError = isValidRange(newMcpServers, fieldKey)
            return !isRangeError?.isError
          }
        }
      }
      return true
    } catch(_e) {
      return false
    }
  }

  const isValidRange = (value: Record<string, any>, field?: keyof typeof FieldType) => {
    try {
      let newMcpServers = value
      if(newMcpServers.mcpServers) {
        newMcpServers = newMcpServers.mcpServers
      }

      // check value is in range
      for(const fieldKey of Object.keys(FieldType) as Array<keyof typeof FieldType>) {
        if(field && fieldKey !== field) {
          continue
        }
        if(FieldType[fieldKey].type === "number") {
          if("min" in FieldType[fieldKey] && (isNaN(newMcpServers[fieldKey]) || (newMcpServers[fieldKey] ?? 0) < FieldType[fieldKey].min)) {
            return { isError: true, fieldKey: fieldKey }
          }
          if("max" in FieldType[fieldKey] && (newMcpServers[fieldKey] ?? 0) > FieldType[fieldKey].max) {
            return { isError: true, fieldKey: fieldKey }
          }
        }
      }
      return { isError: false, fieldKey: "" }
    } catch(_e) {
      return { isError: true, fieldKey: "" }
    }
  }

  const handleSubmit = async () => {
    try {
      if (mcpList.some(mcp => mcp.isError || mcp.isRangeError?.isError))
        return

      const newConfig: {mcpServers: MCPConfig} = { mcpServers: {} }
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

  const mcpNameMask = (name: string, maxLength: number = 15) => {
    return name.length > maxLength ? `${name.slice(0, maxLength)}...` : name
  }

  const McpList = useMemo(() => {
    if(typeRef.current === "add" || typeRef.current === "add-json" || typeRef.current === "edit-json") {
      return null
    }

    return (
      <div className="tool-edit-list">
        {mcpList && mcpList.map((mcp, index) => (
          (mcp.isError || mcp.isRangeError?.isError) ? (
            <Tooltip
              key={index}
              content={(mcp.isRangeError?.isError && mcp.isRangeError.fieldKey !== "") ? t("tools.jsonFormatError.range", { mcp: mcp.name, field: mcp.isRangeError.fieldKey, min: FieldType.initialTimeout.min }) : t("tools.jsonFormatError.format", { mcp: mcp.name })}
              side="right"
            >
              <div
                className={`tool-edit-list-item error ${index === currentMcpIndex ? "active" : ""}`}
                onClick={() => setCurrentMcpIndex(index)}
              >
                <div className="tool-edit-list-item-content">
                  <label>
                    {`<> ${mcpNameMask(mcp.name, 15)}`}
                  </label>
                  <svg width="16px" height="16px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"></circle>
                    <line x1="12" y1="6" x2="12" y2="14" stroke="currentColor" strokeWidth="2"></line>
                    <circle cx="12" cy="17" r="1.5" fill="currentColor"></circle>
                  </svg>
                </div>
              </div>
            </Tooltip>
          ) : (
            <div
              key={index}
              className={`tool-edit-list-item ${index === currentMcpIndex ? "active" : ""}`}
              onClick={() => setCurrentMcpIndex(index)}
            >
              <label>
                {`<> ${mcpNameMask(mcp.name, 18)}`}
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
                            className="key-input-error"
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
          {/* Initial Timeout (s) */}
          <div className={`field-item ${isValidRange(currentMcpServers, "initialTimeout")?.isError ? "error" : ""}`}>
            <div className="field-item-title">
              <label>Initial Timeout (s)</label>
              <Tooltip content={t("tools.initialTimeoutAlt")} side="bottom" align="start" maxWidth={402}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7.5" stroke="currentColor"/>
                  <path d="M8.73 6.64V12H7.85V6.64H8.73ZM8.3 4.63C8.43333 4.63 8.55 4.67667 8.65 4.77C8.75667 4.85667 8.81 4.99667 8.81 5.19C8.81 5.37667 8.75667 5.51667 8.65 5.61C8.55 5.70333 8.43333 5.75 8.3 5.75C8.15333 5.75 8.03 5.70333 7.93 5.61C7.83 5.51667 7.78 5.37667 7.78 5.19C7.78 4.99667 7.83 4.85667 7.93 4.77C8.03 4.67667 8.15333 4.63 8.3 4.63Z" fill="currentColor"/>
                </svg>
              </Tooltip>
            </div>
            <div className="key-input-wrapper">
              <input
                placeholder={t("tools.initialTimeoutPlaceholder")}
                type="number"
                value={currentMcpServers.initialTimeout}
                onChange={(e) => handleMcpChange("initialTimeout", parseFloat(e.target.value))}
              />
              {isValidRange(currentMcpServers, "initialTimeout")?.isError ? (
                <Tooltip content={t("tools.initialTimeoutError")} side="left">
                  <div
                    className="key-input-error"
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
      } catch(_e) {
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
              message: t("tools.jsonFormatError.length"),
              severity: "error",
            }]
          }

          // tool name cannot be empty
          if (Object.keys(parsed.mcpServers).some(key => key === "")) {
            setIsFormatError(true)
            return [{
              from: 0,
              to: doc.length,
              message: t("tools.jsonFormatError.nameEmpty"),
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
              message: t("tools.jsonFormatError.nameExist", { mcp: mcpList[currentMcpIndex].name }),
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
                }else if(parsed.mcpServers[mcp]?.[fieldKey] && FieldType[fieldKey].type === "number") {
                  if("min" in FieldType[fieldKey] && (isNaN(parsed.mcpServers[mcp][fieldKey]) || parsed.mcpServers[mcp][fieldKey] < FieldType[fieldKey].min)) {
                    setIsRangeError(true)
                    return [{
                      from: 0,
                      to: doc.length,
                      message: t(FieldType[fieldKey].minError, { mcp: mcp, field: fieldKey, min: FieldType[fieldKey].min }),
                      severity: "error",
                    }]
                  } else if("max" in FieldType[fieldKey] && parsed.mcpServers[mcp][fieldKey] > FieldType[fieldKey].max) {
                    setIsRangeError(true)
                    return [{
                      from: 0,
                      to: doc.length,
                      message: t(FieldType[fieldKey].maxError, { mcp: mcp, field: fieldKey, max: FieldType[fieldKey].max }),
                      severity: "error",
                    }]
                  }
                }
              }
            }
          }

          setIsFormatError(false)
          setIsRangeError(false)
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
        paddingBottom: "10px",
      },
      ".cm-lineNumbers": {
        color: "var(--text)",
      },
      ".cm-gutters": {
        paddingBottom: "10px",
      }
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
            isError: false,
            isRangeError: { isError: false, fieldKey: "" }
          }])
          setCurrentMcpIndex(0)
        } else if(isValidJSON(newJson)) {
          setMcpList(prev => {
            const newMcpList = [...prev]
            newMcpList[currentMcpIndex].jsonString = value
            newMcpList[currentMcpIndex].name = newMcpName
            newMcpList[currentMcpIndex].mcpServers = encodeMcpServers(newMcpServers[newMcpName])
            newMcpList[currentMcpIndex].isError = false
            newMcpList[currentMcpIndex].isRangeError = isValidRange(newMcpList[currentMcpIndex].mcpServers)
            return newMcpList
          })
        } else {
          setMcpList(prev => {
            const newMcpList = [...prev]
            newMcpList[currentMcpIndex].jsonString = value
            newMcpList[currentMcpIndex].isError = true
            newMcpList[currentMcpIndex].isRangeError = { isError: false, fieldKey: "" }
            return newMcpList
          })
        }
      } catch(_e) {
        setMcpList(prev => {
          const newMcpList = [...prev]
          newMcpList[currentMcpIndex].jsonString = value
          newMcpList[currentMcpIndex].isError = true
          newMcpList[currentMcpIndex].isRangeError = { isError: false, fieldKey: "" }
          return newMcpList
        })
      }
    }

    const logTime = (timestamp: string) => {
      const date = new Date(timestamp)
      return date.toLocaleString("en-US")
    }

    return (
      <div className={`tool-edit-json-editor ${typeRef.current} ${(toolLog && toolLog.length > 0) ? "submitting" : ""}`}>
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
          onChange={(value) => {
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
        {toolLog && toolLog.length > 0 &&
          <div className="tool-edit-json-editor-log">
            <div className="tool-edit-json-editor-log-title">
              {t("tools.logTitle")}
              <div className="tool-edit-json-editor-log-title-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="17" viewBox="0 0 14 17" fill="none">
                  <path d="M0.502643 8.22159C0.502643 8.49773 0.726501 8.72159 1.00264 8.72159C1.27879 8.72159 1.50264 8.49773 1.50264 8.22159L0.502643 8.22159ZM12.9297 6.58454L11.8635 0.910342L7.48259 4.67079L12.9297 6.58454ZM1.00264 8.22159L1.50264 8.22159C1.50264 5.37117 3.81769 2.875 6.61537 2.875L6.61537 2.375L6.61537 1.875C3.21341 1.875 0.502643 4.87236 0.502643 8.22159L1.00264 8.22159ZM6.61537 2.375L6.61537 2.875C7.89483 2.875 8.9093 3.12599 9.75157 3.60453L9.99857 3.1698L10.2456 2.73507C9.22264 2.15388 8.02979 1.875 6.61537 1.875L6.61537 2.375Z" fill="currentColor"/>
                  <path d="M13.427 8.77841C13.427 8.50227 13.2032 8.27841 12.927 8.27841C12.6509 8.27841 12.427 8.50227 12.427 8.77841L13.427 8.77841ZM1 10.4155L2.06619 16.0897L6.4471 12.3292L1 10.4155ZM12.927 8.77841L12.427 8.77841C12.427 11.6288 10.112 14.125 7.31432 14.125L7.31432 14.625L7.31432 15.125C10.7163 15.125 13.427 12.1276 13.427 8.77841L12.927 8.77841ZM7.31432 14.625L7.31432 14.125C6.03486 14.125 5.02039 13.874 4.17811 13.3955L3.93112 13.8302L3.68412 14.2649C4.70705 14.8461 5.8999 15.125 7.31432 15.125L7.31432 14.625Z" fill="currentColor"/>
                </svg>
                {t("tools.logProcessing")}
              </div>
            </div>
            <div className="tool-edit-json-editor-log-content" ref={logContentRef}>
              {toolLog?.map((log, index) => (
                <div key={index}>
                  <div className="log-entry">
                    <span className="timestamp">[{logTime(log.timestamp)}]</span>
                    <span className="debug-label">[{log.event}]</span>
                    <span className="log-content">{log.body}</span>
                  </div>
                </div>
              ))}
              <div className="log-dots"></div>
            </div>
          </div>
        }
      </div>
    )
  }, [theme, systemTheme, mcpList, currentMcpIndex, typeRef, toolLog, isSubmitting])

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
      disabled={isFormatError || isRangeError || !isValidName(mcpList, mcpList[currentMcpIndex]?.name) || mcpList.some(mcp => mcp.isError || mcp.isRangeError?.isError) || isSubmitting}
      zIndex={1000}
      listenHotkey={false}
      confirmText={isSubmitting ? (
        <div className="loading-spinner"></div>
      ) : t("tools.save")}
      footerHint={ typeRef.current.startsWith("edit") && onDelete && !isSubmitting &&
        <Button
          className="tool-edit-delete"
          color="white"
          size="fit"
          padding="n"
          onClick={() => onDelete(mcpList[currentMcpIndex]?.name)}
        >
          {t("tools.delete")}
        </Button>
      }
    >
      <div className="tool-edit-popup">
        {McpList}
        <div className="tool-edit-popup-content">
          <div className="tool-edit-header">
            <span>{mcpToolTitle(typeRef.current)}</span>
            <Tooltip content={t("tools.toogleToolAlt")} side="bottom" disabled={typeRef.current !== "edit"}>
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
})
