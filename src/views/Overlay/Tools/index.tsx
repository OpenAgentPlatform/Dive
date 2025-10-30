// @ts-nocheck
import React, { useEffect, useState, useRef, useMemo, memo } from "react"
import { useTranslation } from "react-i18next"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { showToastAtom } from "../../../atoms/toastState"
import Switch from "../../../components/Switch"
import { loadMcpConfigAtom, loadToolsAtom, MCPConfig, mcpConfigAtom, Tool, toolsAtom, installToolBufferAtom } from "../../../atoms/toolState"
import Tooltip from "../../../components/Tooltip"
import PopupConfirm from "../../../components/PopupConfirm"
import Dropdown from "../../../components/DropDown"
import { imgPrefix } from "../../../ipc"
import OAPServerList from "./Popup/OAPServerList"
import Tabs from "../../../components/Tabs"
import { OAPMCPServer } from "../../../types/oap"
import { isLoggedInOAPAtom, loadOapToolsAtom, oapToolsAtom } from "../../../atoms/oapState"
import { OAP_ROOT_URL } from "../../../../shared/oap"
import { openUrl } from "../../../ipc/util"
import { oapApplyMCPServer } from "../../../ipc"
import cloneDeep from "lodash/cloneDeep"
import { ClickOutside } from "../../../components/ClickOutside"
import Button from "../../../components/Button"
import CustomEdit from "./Popup/CustomEdit"
import "../../../styles/overlay/_Tools.scss"

interface ToolsCache {
  [key: string]: {
    type: "oap" | "custom"
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

export interface mcpServersProps {
  enabled?: boolean
  command?: string
  args?: string[]
  env?: [string, unknown, boolean][]
  url?: string
  transport?: string
  initialTimeout?: number
}

const Tools = () => {
  const { t } = useTranslation()
  const [tools, setTools] = useAtom(toolsAtom)
  const [oapTools, setOapTools] = useAtom(oapToolsAtom)
  const [mcpConfig, setMcpConfig] = useAtom(mcpConfigAtom)
  const mcpConfigRef = useRef<MCPConfig>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingTools, setLoadingTools] = useState<string[]>([])
  const showToast = useSetAtom(showToastAtom)
  const toolsCacheRef = useRef<ToolsCache>({})
  const loadTools = useSetAtom(loadToolsAtom)
  const [showDeletePopup, setShowDeletePopup] = useState(false)
  const [showCustomEditPopup, setShowCustomEditPopup] = useState(false)
  const [showOapMcpPopup, setShowOapMcpPopup] = useState(false)
  const [showUnsavedSubtoolsPopup, setShowUnsavedSubtoolsPopup] = useState(false)
  const changingToolRef = useRef<Tool | null>(null)
  const [currentTool, setCurrentTool] = useState<string>("")
  const abortControllerRef = useRef<AbortController | null>(null)
  const [toolLog, setToolLog] = useState<LogType[]>([])
  const [toolType, setToolType] = useState<"all" | "oap" | "custom">("all")
  const isLoggedInOAP = useAtomValue(isLoggedInOAPAtom)
  const loadMcpConfig = useSetAtom(loadMcpConfigAtom)
  const loadOapTools = useSetAtom(loadOapToolsAtom)
  const [isResort, setIsResort] = useState(true)
  const sortedConfigOrderRef = useRef<string[]>([])
  const [expandedSections, setExpandedSections] = useState<string[]>([])
  const [installToolBuffer, setInstallToolBuffer] = useAtom(installToolBufferAtom)
  const getMcpConfig = () => new Promise((resolve) => {
    setMcpConfig(prevConfig => {
      resolve(prevConfig)
      return prevConfig
    })
  })

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
    handleCustomSubmit({ mcpServers: cfg })
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
  }, [showCustomEditPopup])

  const isOapTool = (toolName: string) => {
    return oapTools?.find(oapTool => oapTool.name === toolName) ? true : false
  }

  const updateToolsCache = async () => {
    await loadTools()
    const _mcpConfig = await getMcpConfig()


    let _oapTools: OAPMCPServer[] = []
    setOapTools((oapTools) => {
      _oapTools = oapTools
      return oapTools
    })

    const newCache: ToolsCache = {}
    setTools(prevTools => {
      prevTools.forEach((tool: Tool) => {
        newCache[tool.name] = {
          type: _oapTools && _oapTools.find(oapTool => oapTool.name === tool.name) ? "oap" : "custom",
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

  const updateMCPConfigNoAbort = async (newConfig: Record<string, any> | string, force = false) => {
    const config = typeof newConfig === "string" ? JSON.parse(newConfig) : newConfig
    Object.keys(config.mcpServers).forEach(key => {
      const cfg = config.mcpServers[key]
      if (!cfg.transport) {
        config.mcpServers[key].transport = cfg.url ? "sse" : "stdio"
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
    if(!data.errors?.some((error: any) => tools.find(tool => tool.name === error.serverName)) &&
        !data?.detail?.some((item: any) => item.type.includes("error"))) {
        showToast({
          message: t("tools.saveSuccess"),
          type: "success"
        })
    }
  }

  const handleCustomSubmit = async (newConfig: {mcpServers: MCPConfig}) => {
    setIsLoading(true)
    try {
      // const filledConfig = await window.ipcRenderer.fillPathToConfig(JSON.stringify(newConfig))
      const filledConfig = { ...newConfig }

      filledConfig.mcpServers = {
        ...newConfig.mcpServers
      }

      const data = await updateMCPConfig(filledConfig)
      if (data?.errors && Array.isArray(data.errors) && data.errors.length) {
        data.errors
          .map((e: any) => e.serverName)
          .forEach((serverName: string) => {
            if(filledConfig.mcpServers[serverName]) {
              filledConfig.mcpServers[serverName].disabled = true
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
        setMcpConfig(filledConfig)
        setShowCustomEditPopup(false)
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
      setShowCustomEditPopup(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteTool = async(toolName: string) => {
    setCurrentTool(toolName)
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

  const toggleTool = async (tool: Tool) => {
    if(loadingTools.includes(tool.name)) {
      return
    }
    setLoadingTools(prev => [...prev, tool.name])
    try {
      if(!mcpConfigRef.current) {
        mcpConfigRef.current = JSON.parse(JSON.stringify(mcpConfig))
      }

      const currentEnabled = tool.enabled
      const newConfig = JSON.parse(JSON.stringify(mcpConfigRef.current))
      newConfig.mcpServers[tool.name].enabled = !currentEnabled
      if(newConfig.mcpServers[tool.name].enabled && tool.tools.every(subTool => !subTool.enabled)) {
        newConfig.mcpServers[tool.name].exclude_tools = []
      }
      mcpConfigRef.current = newConfig

      // The backend locks API requests and processes them sequentially.
      const data = await updateMCPConfigNoAbort(mcpConfigRef.current)
      if (data.errors && Array.isArray(data.errors) && data.errors.length) {
        data.errors
          .map((e: any) => e.serverName)
          .forEach((serverName: string) => {
            if(mcpConfigRef.current.mcpServers[serverName]) {
              mcpConfigRef.current.mcpServers[serverName].disabled = true
            }
          })

        // reset enable
        await updateMCPConfigNoAbort(mcpConfigRef.current)
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
        (!data?.detail || data?.detail?.filter((item: any) => item.type.includes("error")).length === 0) &&
        loadingTools.filter(name => name !== tool.name).length === 0) {
        showToast({
          message: t("tools.saveSuccess"),
          type: "success"
        })
      }

      if (data.success) {
        setMcpConfig(mcpConfigRef.current)
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
      setLoadingTools(prev => prev.filter(name => name !== tool.name))
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
    if(changingToolRef.current?.name === toolName && !isLoading && !loadingTools.includes(changingToolRef.current?.name ?? "")) {
      event?.preventDefault()
      setShowUnsavedSubtoolsPopup(true)
    }
    return
  }
  // SubTool start //
  const arrayEqual = (arr1: any[], arr2: any[]) => {
    if (arr1.length !== arr2.length)
      return false
    const sortedA = [...arr1].sort()
    const sortedB = [...arr2].sort()
    return sortedA.every((val, index) => val === sortedB[index])
  }

  const toggleSubTool = async (_tool: Tool, subToolName: string, action: "add" | "remove") => {
    const toolName = _tool.name
    if(loadingTools.includes(toolName)) {
      return
    }
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
    if(!arrayEqual(newDisabledSubTools ?? [], mcpConfig.mcpServers?.[toolName]?.exclude_tools ?? []) ||
    tool?.enabled !== mcpConfig.mcpServers[toolName].enabled) {
      changingToolRef.current = {
        ...tool,
        disabled: Boolean(tool?.error),
        type: isOapTool(toolName) ? "oap" : "custom",
        plan: isOapTool(toolName) ? oapTools?.find(oapTool => oapTool.name === toolName)?.plan : undefined,
        oapId: isOapTool(toolName) ? oapTools?.find(oapTool => oapTool.name === toolName)?.id : undefined,
      }
    } else {
      changingToolRef.current = null
    }
  }

  const toggleSubToolConfirm = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e?.stopPropagation()
    if(changingToolRef.current === null) {
      return
    }
    try {
      setLoadingTools(prev => [...prev, changingToolRef.current.name])
      setShowUnsavedSubtoolsPopup(false)

      if(!mcpConfigRef.current) {
        mcpConfigRef.current = JSON.parse(JSON.stringify(mcpConfig))
      }
      const newConfig = JSON.parse(JSON.stringify(mcpConfigRef.current))
      const _tool = changingToolRef.current
      const newDisabledSubTools = _tool?.tools.filter(subTool => !subTool.enabled).map(subTool => subTool.name)
      if(_tool?.tools?.length === newDisabledSubTools?.length) {
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
            if(mcpConfigRef.current?.mcpServers[serverName]) {
              mcpConfigRef.current.mcpServers[serverName].disabled = true
            }
          })

        // reset enable
        await updateMCPConfigNoAbort(mcpConfigRef.current)
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

      if(data.errors?.filter((error: any) => error.serverName === _tool.name).length === 0 &&
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
        setLoadingTools(prev => prev.filter(name => name !== _tool.name))
        if(changingToolRef.current?.name === _tool.name) {
          changingToolRef.current = null
        }
      }
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : t("tools.toggleFailed"),
        type: "error"
      })
    } finally {
      if(changingToolRef.current) {
        setLoadingTools(prev => prev.filter(name => name !== changingToolRef.current.name))
      }
    }
  }

  const toggleSubToolCancel = async () => {
    setShowUnsavedSubtoolsPopup(false)
    changingToolRef.current = null
    setIsLoading(true)
    await loadTools()
    setIsLoading(false)
  }
  // SubTool end //

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
          type: isOapTool(name) ? "oap" : "custom",
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
          url: mcpServers[name]?.url,
          error: mcpServers[name]?.error,
          disabled: Boolean(mcpServers[name]?.disabled || mcpServers[name]?.error),
          type: isOapTool(name) ? "oap" : "custom",
          plan: isOapTool(name) ? oapTools?.find(oapTool => oapTool.name === name)?.plan : undefined,
          oapId: isOapTool(name) ? oapTools?.find(oapTool => oapTool.name === name)?.id : undefined
        }
      }

      return {
        name,
        description: "",
        enabled: false,
        url: mcpServers[name]?.url,
        disabled: Boolean(mcpServers[name]?.disabled || mcpServers[name]?.error),
        type: isOapTool(name) ? "oap" : "custom",
        plan: isOapTool(name) ? oapTools?.find(oapTool => oapTool.name === name)?.plan : undefined,
        oapId: isOapTool(name) ? oapTools?.find(oapTool => oapTool.name === name)?.id : undefined
      }
    })

    return [...configTools].filter(tool => toolType === "all" || tool.type === toolType)
  }, [tools, oapTools, mcpConfig.mcpServers, toolType])

  const toolMenu = (tool: Tool & { type: string }) => {
    return {
      "root": {
        subOptions: [
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
              setCurrentTool(tool.name)
              setShowCustomEditPopup(true)
            },
            active: !isOapTool(tool.name)
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
              setCurrentTool(tool.name)
              setShowDeletePopup(true)
            },
            active: true
          }
        ].filter(option => option.active)
      }
    }
  }

  useEffect(() => {
    setExpandedSections(prev =>
      prev.filter(name => sortedTools.some(tool => tool.name === name))
    )
  }, [sortedTools])

  return (
    <div className="tools-page">
      <div className="tools-container">
        <div className="tools-header">
          <div>{t("tools.title")}</div>
          <div className="header-actions">
            {isLoggedInOAP &&
              <Tooltip content={t("tools.oap.headerBtnAlt")}>
                <Button
                  theme="Color"
                  color="primary"
                  size="medium"
                  onClick={() => {
                    setShowOapMcpPopup(true)
                  }}
                >
                  <img className="oap-logo" src={`${imgPrefix}logo_oap.png`} alt="info" />
                  OAPhub
                </Button>
              </Tooltip>
            }

            <Tooltip content={t("tools.custom.headerBtnAlt")}>
              <Button
                theme="Color"
                color="success"
                size="medium"
                onClick={() => {
                  setCurrentTool("")
                  setShowCustomEditPopup(true)
                }}
              >
                {t("tools.custom.headerBtn")}
              </Button>
            </Tooltip>

            <Tooltip content={t("tools.reload.headerBtnAlt")}>
              <Button
                className="reload-btn"
                theme="Color"
                color="neutralGray"
                size="medium"
                onClick={() => handleReloadMCPServers()}
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
                {t("tools.reload.headerBtn")}
              </Button>
            </Tooltip>
          </div>
        </div>

        <div className="tools-list">
          {isLoggedInOAP &&
            <Tabs
              className="tools-type-tabs"
              tabs={[{ label: t("tools.tab.all"), value: "all" }, { label: t("tools.tab.oap"), value: "oap" }, { label: t("tools.tab.custom"), value: "custom" }]}
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
          {sortedTools.map((tool, index) => {
            // Use changingToolRef.current if this tool is being edited
            const displayTool = changingToolRef.current?.name === tool.name ? changingToolRef.current : tool
            return (
              <div
                key={displayTool.name}
                id={`tool-${index}`}
                onClick={() => toggleToolSection(displayTool.name)}
                className={`tool-section
                  ${displayTool.disabled ? "disabled" : ""}
                  ${displayTool.enabled ? "enabled" : ""}
                  ${expandedSections.includes(displayTool.name) ? "expanded" : ""}
                  ${loadingTools.includes(displayTool.name) ? "loading" : ""}
                `}
              >
                <div className="tool-header-container">
                  <div className="tool-header">
                    <div className="tool-header-content">
                      <div className="tool-status-light">
                        {loadingTools.includes(displayTool.name) ?
                          <div className="loading-spinner" style={{ width: "16px", height: "16px" }}></div>
                        :
                          <>
                            {displayTool.enabled && !displayTool.disabled &&
                              <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
                                <circle cx="50" cy="50" r="45" fill="none" stroke="#52c41a" strokeWidth="4" />
                                <circle cx="50" cy="50" r="25" fill="#52c41a" />
                              </svg>}
                            {displayTool.enabled && displayTool.disabled &&
                              <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
                                <circle cx="50" cy="50" r="45" fill="none" stroke="#ff3333" strokeWidth="4" />
                                <circle cx="50" cy="50" r="25" fill="#ff0000" />
                              </svg>}
                          </>
                        }
                      </div>
                      {displayTool.type === "oap" ?
                        <img className="tool-header-content-icon oap-logo" src={`${imgPrefix}logo_oap.png`} alt="info" />
                      :
                        <svg className="tool-header-content-icon" width="20" height="20" viewBox="0 0 24 24">
                          <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
                        </svg>
                      }
                      <span className="tool-name">{displayTool.name}</span>
                      {isOapTool(displayTool.name) && displayTool.oapId &&
                        <>
                          <div className={`tool-tag ${displayTool.plan}`}>
                            {displayTool.plan}
                          </div>
                          <Tooltip content={t("tools.oapStoreLinkAlt")}>
                            <button className="oap-store-link" onClick={(e) => {
                              e.stopPropagation()
                              window.open(`${OAP_ROOT_URL}/mcp/${displayTool.oapId}`, "_blank")
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
                        options={toolMenu(displayTool)}
                      >
                        <div className="tool-edit-menu">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 22 22" width="25" height="25">
                            <path fill="currentColor" d="M19 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM11 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM3 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"></path>
                          </svg>
                        </div>
                      </Dropdown>
                    </div>
                    {displayTool.disabled && displayTool.enabled && <div className="tool-disabled-label">{t("tools.startFailed")}</div>}
                    {displayTool.disabled && !displayTool.enabled && <div className="tool-disabled-label">{t("tools.installFailed")}</div>}
                    <div className="tool-switch-container">
                      <Switch
                        color={displayTool.disabled ? "danger" : "primary"}
                        checked={displayTool.enabled}
                        onChange={() => toggleTool(displayTool)}
                      />
                    </div>
                    <span className="tool-toggle">
                      {(displayTool.description || (displayTool.tools?.length ?? 0) > 0 || displayTool.error) && "▼"}
                    </span>
                  </div>
                  {!displayTool.enabled &&
                    <div className="tool-content-sub-title">
                      {t("tools.disabledDescription")}
                    </div>
                  }
                  {displayTool.enabled && !displayTool.disabled && displayTool.tools && displayTool.tools.length > 0 &&
                    <div className="tool-content-sub-title">
                      <span>
                        {t("tools.subToolsCount", { count: displayTool.tools?.filter(subTool => subTool.enabled).length || 0, total: displayTool.tools?.length || 0 })}
                      </span>
                    </div>
                  }
                </div>
                {(displayTool.description || (displayTool.tools?.length ?? 0) > 0 || displayTool.error) && (
                  <div onClick={(e) => {
                    if(changingToolRef.current?.name === displayTool.name) {
                      e.stopPropagation()
                    }
                  }}>
                    <div className="tool-content-container">
                      {displayTool.error ? (
                        <div className="tool-content">
                          <div className="sub-tool-error">
                            <svg width="18px" height="18px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
                              <line x1="12" y1="6" x2="12" y2="14" stroke="currentColor" strokeWidth="2"/>
                              <circle cx="12" cy="17" r="1.5" fill="currentColor"/>
                            </svg>
                            <div className="sub-tool-error-text">
                              <div className="sub-tool-error-text-title">Error Message</div>
                              <div className="sub-tool-error-text-content">{displayTool.error}</div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          {displayTool.description && (
                            <div className="tool-content">
                              <div className="tool-description">{displayTool.description}</div>
                            </div>
                          )}
                          {displayTool.tools && displayTool.tools.length > 0 && (
                            <ClickOutside
                              onClickOutside={(event) => handleUnsavedSubtools(displayTool.name, event)}
                            >
                              <div className="tool-content">
                                <div className="sub-tools">
                                  {displayTool.tools.map((subTool, subIndex) => (
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
                                          active={subTool.enabled && displayTool.enabled}
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            toggleSubTool(displayTool, subTool.name, (!subTool.enabled || !displayTool.enabled) ? "remove" : "add")
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
                                  active={changingToolRef.current?.name === displayTool.name}
                                  disabled={changingToolRef.current === null || changingToolRef.current.name !== displayTool.name || isLoading || loadingTools.includes(changingToolRef.current?.name ?? "")}
                                  onClick={toggleSubToolConfirm}
                                >
                                  {t("common.save")}
                                </Button>
                              </div>
                            </ClickOutside>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {isLoading && (
        <div className="global-loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}

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