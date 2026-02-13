// @ts-nocheck
import React, { useCallback, useEffect, useState, useRef, useMemo, memo } from "react"
import { useTranslation } from "react-i18next"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import Switch from "../../../components/Switch"
import { loadingToolsAtom, loadMcpConfigAtom, loadToolsAtom, MCPConfig, mcpConfigAtom, Tool, toolsAtom, installToolBufferAtom } from "../../../atoms/toolState"
import Tooltip from "../../../components/Tooltip"
import PopupConfirm from "../../../components/PopupConfirm"
import Dropdown from "../../../components/DropDown"
import { imgPrefix } from "../../../ipc"
import OAPServerList from "./Popup/OAPServerList"
import Tabs from "../../../components/Tabs"
import { OAPMCPServer } from "../../../types/oap"
import { isLoggedInOAPAtom, loadOapToolsAtom, oapToolsAtom } from "../../../atoms/oapState"
import { OAP_ROOT_URL } from "../../../../shared/oap"
import { openUrl, checkCommandExist } from "../../../ipc/util"
import { oapApplyMCPServer } from "../../../ipc"
import cloneDeep from "lodash/cloneDeep"
import { ClickOutside } from "../../../components/ClickOutside"
import Button from "../../../components/Button"
import CustomEdit, { FieldType } from "./Popup/CustomEdit"
import { createPortal } from "react-dom"
import "../../../styles/overlay/_Tools.scss"
import { Subtab } from "../Setting"
import { closeAllOverlaysAtom } from "../../../atoms/layerState"
import { authorizeStateAtom } from "../../../atoms/globalState"
import { showToastAtom } from "../../../atoms/toastState"

interface ToolsCache {
  [key: string]: {
    toolType: "tool" | "connector"
    sourceType: "oap" | "custom"
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
  verify?: boolean
  transport?: string
  initialTimeout?: number
  extraData?: {
    oap?: boolean
  }
}

const Tools = ({ _subtab, _tabdata }: { _subtab?: Subtab, _tabdata?: any }) => {
  const { t } = useTranslation()
  const showToast = useSetAtom(showToastAtom)
  const [tools, setTools] = useAtom(toolsAtom)
  const [oapTools, setOapTools] = useAtom(oapToolsAtom)
  const [mcpConfig, setMcpConfig] = useAtom(mcpConfigAtom)
  const mcpConfigRef = useRef<MCPConfig>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isConnectorLoading, setIsConnectorLoading] = useState(false)
  const [loadingTools, setLoadingTools] = useAtom(loadingToolsAtom)
  const toolsCacheRef = useRef<ToolsCache>({})
  const loadTools = useSetAtom(loadToolsAtom)
  const [showDeletePopup, setShowDeletePopup] = useState(false)
  const [showCustomEditPopup, setShowCustomEditPopup] = useState(false)
  const [showConfirmCancelConnector, setShowConfirmCancelConnector] = useState(false)
  const [showConfirmDisConnector, setShowConfirmDisConnector] = useState(false)
  const [showOapMcpPopup, setShowOapMcpPopup] = useState(false)
  const [showUnsavedSubtoolsPopup, setShowUnsavedSubtoolsPopup] = useState(false)
  const changingToolRef = useRef<Tool | null>(null)
  const [currentTool, setCurrentTool] = useState<string>("")
  const abortControllerRef = useRef<AbortController | null>(null)
  const abortControllerConnectorRef = useRef<AbortController | null>(null)
  const abortDisConnectorRef = useRef<AbortController | null>(null)
  const [isDisConnectorLoading, setIsDisConnectorLoading] = useState(false)
  const [toolLog, setToolLog] = useState<LogType[]>([])
  const abortToolLogRef = useRef<AbortController | null>(null)
  const [toolLogReader, setToolLogReader] = useState<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  const [connectorReader, setConnectorReader] = useState<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  const [toolType, setToolType] = useState<"all" | "oap" | "custom">("all")
  const [filterSearch, setFilterSearch] = useState("")
  const isLoggedInOAP = useAtomValue(isLoggedInOAPAtom)
  const loadMcpConfig = useSetAtom(loadMcpConfigAtom)
  const loadOapTools = useSetAtom(loadOapToolsAtom)
  const [isResort, setIsResort] = useState(true)
  const sortedConfigOrderRef = useRef<string[]>([])
  const [expandedSections, setExpandedSections] = useState<string[]>([])
  const [commandExistsMap, setCommandExistsMap] = useState<Record<string, boolean>>({})
  const [installToolBuffer, setInstallToolBuffer] = useAtom(installToolBufferAtom)
  const [authorizeState, setAuthorizeState] = useAtom(authorizeStateAtom)
  const closeAllOverlays = useSetAtom(closeAllOverlaysAtom)
  const getMcpConfig = () => new Promise((resolve) => {
    setMcpConfig(prevConfig => {
      resolve(prevConfig)
      return prevConfig
    })
  })

  useEffect(() => {
    (async () => {
      switch(_subtab) {
        case "Custom":
          if(_tabdata?.currentTool) {
            setCurrentTool(_tabdata.currentTool)
            setShowCustomEditPopup(true)
          }
          break
        default:
          break
      }
    })()
  }, [_subtab, _tabdata])

  const handleReAuthorizeFinish = async () => {
    if(isReAuthorizing()) {
      setIsLoading(true)
      await fetch(`/api/tools/login/oauth/callback?code=''&state=${authorizeState}`)
      setIsLoading(false)
      closeAllOverlays()
    }
    setAuthorizeState(null)
  }

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
      if(Object.keys(loadingTools).length === 0) {
        await updateToolsCache()
      }
    })()
  }, [loadingTools])

  // Check if commands exist for all tools
  useEffect(() => {
    const checkCommands = async () => {
      const commands = Object.entries(mcpConfig.mcpServers || {})
        .filter(([_, config]) => config.command)
        .map(([name, config]) => ({ name, command: config.command }))

      const results: Record<string, boolean> = {}
      await Promise.all(
        commands.map(async ({ name, command }) => {
          if(!command) {
            results[name] = true
            return
          }

          try {
            results[name] = await checkCommandExist(command)
          } catch {
            // if checkCommandExist error, set to true
            results[name] = true
          }
        })
      )
      setCommandExistsMap(results)
    }

    checkCommands()
  }, [mcpConfig.mcpServers])

  useEffect(() => {
    (async () => {
      const cachedTools = localStorage.getItem("toolsCache")
      if (cachedTools) {
        toolsCacheRef.current = JSON.parse(cachedTools)
      }

      if(Object.keys(loadingTools).length === 0) {
        await updateToolsCache()
      }
    })()

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      if (abortControllerConnectorRef.current) {
        abortControllerConnectorRef.current.abort()
      }

      if (abortDisConnectorRef.current) {
        abortDisConnectorRef.current.abort()
      }

      if(abortToolLogRef.current) {
        abortToolLogRef.current.abort()
      }

      if(toolLogReader) {
        toolLogReader.cancel()
        setToolLogReader(null)
      }

      setToolLog([])
    }
  }, [showCustomEditPopup])

  const isReAuthorizing = () => {
    return _subtab === "Connector" && _tabdata?.currentTool && authorizeState !== null
  }

  const isOapTool = (toolName: string) => {
    return oapTools?.find(oapTool => oapTool.name === toolName) ? true : false
  }

  const isConnector = (toolName: string, _mcpConfig: MCPConfig) => {
    const config = _mcpConfig ?? mcpConfig
    return config.mcpServers[toolName]?.transport === "streamable"
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
        config.mcpServers[key].transport = FieldType.transport.options[0]
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
        console.error("Failed to update MCP config:", error)
      })
  }

  const updateMCPConfig = async (newConfig: Record<string, any> | string, force = false, fetchtingLog = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    if (abortDisConnectorRef.current) {
      abortDisConnectorRef.current.abort()
    }

    if(abortToolLogRef.current) {
      abortToolLogRef.current.abort()
    }

    if(toolLogReader) {
      toolLogReader.cancel()
      setToolLogReader(null)
    }

    abortControllerRef.current = new AbortController()
    const config = typeof newConfig === "string" ? JSON.parse(newConfig) : newConfig
    Object.keys(config.mcpServers).forEach(key => {
      const cfg = config.mcpServers[key]
      if (!cfg.transport) {
        config.mcpServers[key].transport = FieldType.transport.options[0]
      }

      if (!("enabled" in config.mcpServers[key])) {
        config.mcpServers[key].enabled = true
      }
    })

    if(fetchtingLog) {
      setIsLoading(false)
      const body = {
        "names": [
          ...Object.keys(config.mcpServers).filter(key => config.mcpServers[key].enabled)
        ],
        "stream_until": "running",
        "stop_on_notfound": false,
        "max_retries": 10
      }

      abortToolLogRef.current = new AbortController()

      // streaming in background, not block main process
      const streamLogReading = async () => {
        const response = await fetch("/api/tools/logs/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: abortToolLogRef.current?.signal
        })

        const chatReader = response.body!.getReader()
        setToolLogReader(chatReader)
        const decoder = new TextDecoder()
        let chunkBuf = ""
        // clear authorize state
        setAuthorizeState(null)

        while (true) {
          const { value, done } = await chatReader.read()
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
                toolLogReader?.cancel()
                setToolLogReader(null)
                return
              }

              setToolLog(prevToolLog => {
                return [...prevToolLog, dataObj]
              })
            } catch (error) {
              console.warn(error)
            }
          }
        }
      }

      streamLogReading().catch(error => {
        console.error("Failed to stream logs:", error)
        toolLogReader?.cancel()
        setToolLogReader(null)
        setToolLog([])
      })
    }

    try {
      const response = await fetch(`/api/config/mcpserver${force ? "?force=1" : ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        showToast({
          message: "Failed to update MCP config",
          type: "error"
        })
        abortToolLogRef.current.abort()
        throw new Error(`HTTP error! status: ${response.status}`)
        return
      }

      return await response.json()
    } catch (error) {
      console.error("Failed to update MCP config:", error)
    }
  }

  const handleUpdateConfigResponse = (data: { errors: { error: string; serverName: string }[] }, isShowToast = false, toolName?: string) => {
    if (data.errors && data.errors.length && Array.isArray(data.errors)) {
      data.errors.forEach(({ error, serverName }: { error: string; serverName: string }) => {
        if(isShowToast && (!toolName || toolName === serverName)) {
          console.error("Failed to update config:", error)
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
          if(isShowToast && (!toolName || toolName === serverName)) {
            console.error("Failed to update config:", error)
          }
        })
    }
  }

  const handleCustomSubmit = async (newConfig: {mcpServers: MCPConfig}) => {
    setIsLoading(true)
    const connectorsToDisconnect = Object.entries(mcpConfig.mcpServers).filter(([key, value]) => value.toolType === "connector" && !newConfig.mcpServers[key])
    for(const [key] of connectorsToDisconnect) {
      await onDisconnectConnector(key)
    }
    try {
      const filledConfig = { ...newConfig }
      const data = await updateMCPConfig(filledConfig, false, true)
      if (data?.errors && Array.isArray(data.errors) && data.errors.length) {
        data.errors
          .map((e: any) => e.serverName)
          .forEach((serverName: string) => {
            if(filledConfig.mcpServers[serverName]) {
              filledConfig.mcpServers[serverName].disabled = true
            }
          })

        // reset enable
        await updateMCPConfig(filledConfig)
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
      setShowCustomEditPopup(false)
    } finally {
      await handleReAuthorizeFinish()
      cancelConnector()
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

  // Connector start //
  // save config first, then authorize
  const onConnector = useCallback(async (connector: connectorListProps) => {
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
      setConnectorReader(reader)
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
                message: "Failed to authorize " + connector.name + " : " + dataObj.error,
                type: "error"
              })
              console.error("Failed to authorize " + connector.name + ":", dataObj.error)
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
      console.error("Failed to authorize connector:", error)
    } finally {
      await loadMcpConfig()
      await loadTools()
      await updateToolsCache()
      setCurrentTool(connector.name)
      await handleReAuthorizeFinish()
      if(!isReAuthorizing()) {
        await handleReloadMCPServers("connector")
      }
      setIsConnectorLoading(false)
    }
  }, [])

  const cancelConnector = async () => {
    if(abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    if (abortControllerConnectorRef.current) {
      abortControllerConnectorRef.current.abort()
    }
    if (connectorReader) {
      connectorReader.cancel()
      setConnectorReader(null)
    }
    setShowConfirmCancelConnector(false)
    setIsConnectorLoading(false)
    setToolLog([])
    await handleReAuthorizeFinish()
  }

  const cancelDisConnector = () => {
    if (abortDisConnectorRef.current) {
      abortDisConnectorRef.current.abort()
    }
    setShowConfirmDisConnector(false)
    setIsConnectorLoading(false)
    setToolLog([])
  }

  const onDisconnectConnector = async (connectorName?: string) => {
    setIsDisConnectorLoading(true)
    if(!connectorName) {
      connectorName = currentTool
    }
    if (abortDisConnectorRef.current) {
      abortDisConnectorRef.current.abort()
    }
    abortDisConnectorRef.current = new AbortController()

    try {
      await fetch("/api/tools/login/oauth/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          server_name: connectorName
        }),
        signal: abortDisConnectorRef.current.signal
      })
    } catch (error: any) {
      console.error("Failed to disconnect connector:", error)
    }
    await handleReloadMCPServers("connector")
    setShowConfirmDisConnector(false)
    setIsConnectorLoading(false)
    setToolLog([])
    setCurrentTool("")
    abortDisConnectorRef.current = null
    setIsDisConnectorLoading(false)
  }
  // Connector end //

  const toggleTool = async (tool: Tool) => {
    const toolLoadingKey = `Tool[${tool.name}]`
    if(loadingTools[toolLoadingKey]) {
      return
    }
    setLoadingTools(prev => ({ ...prev, [toolLoadingKey]: { enabled: !tool.enabled } }))
    try {
      mcpConfigRef.current = JSON.parse(JSON.stringify(mcpConfig))

      const currentEnabled = tool.enabled
      const newConfig = JSON.parse(JSON.stringify(mcpConfigRef.current))
      newConfig.mcpServers[tool.name].enabled = !currentEnabled
      if(newConfig.mcpServers[tool.name].enabled && tool.tools?.every(subTool => !subTool.enabled)) {
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

      if (data.success) {
        setMcpConfig(mcpConfigRef.current)
        await loadOapTools()
        await updateToolsCache()
        handleUpdateConfigResponse(data, true, tool.name)
      }
    } catch (error) {
      console.error("Failed to toggle tool:", error)
    } finally {
      setLoadingTools(prev => {
        const { [toolLoadingKey]: _, ...rest } = prev
        return rest
      })
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
    const toolLoadingKey = `Tool[${changingToolRef.current?.name ?? ""}]`
    if(changingToolRef.current?.name === toolName && !isLoading && !loadingTools[toolLoadingKey]) {
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
    const toolLoadingKey = `Tool[${toolName}]`
    if(loadingTools[toolLoadingKey]) {
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

  const toggleAllSubTools = async (toolName: string, action: "deactive" | "active") => {
    const toolLoadingKey = `Tool[${toolName}]`
    if(loadingTools[toolLoadingKey]) {
      return
    }
    const newTools = [...tools]
    const tool = newTools.find(tool => tool.name === toolName)

    if(action === "deactive") {
      tool.enabled = false
      tool.tools.map(subTool => {
        subTool.enabled = false
      })
    } else {
      tool.enabled = true
      tool.tools.map(subTool => {
        subTool.enabled = true
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
      const toolLoadingKey = `Tool[${changingToolRef.current.name}]`
      setLoadingTools(prev => ({ ...prev, [toolLoadingKey]: { enabled: changingToolRef.current.enabled } }))
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

      if (data.success) {
        setMcpConfig(mcpConfigRef.current)
        await loadTools()
        toggleToolSection(_tool.name)
        setLoadingTools(prev => {
          const { [toolLoadingKey]: _, ...rest } = prev
          return rest
        })
        if(changingToolRef.current?.name === _tool.name) {
          changingToolRef.current = null
        }
      }
    } catch (error) {
      console.error("Failed to toggle sub tool:", error)
    } finally {
      if(changingToolRef.current) {
        const finalToolLoadingKey = `Tool[${changingToolRef.current.name}]`
        setLoadingTools(prev => {
          const { [finalToolLoadingKey]: _, ...rest } = prev
          return rest
        })
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

  const handleReloadMCPServers = async (type: "all" | "connector" = "all") => {
    try{
      // Connector type: has its own loading UI
      if(type === "all") {
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
      const toolLoadingKey = `Tool[${name}]`
      const toolLoading = loadingTools[toolLoadingKey]

      if (toolMap.has(name)) {
        const tool = toolMap.get(name)!
        return {
          ...tool,
          enabled: toolLoading ? toolLoading.enabled : tool.enabled,
          tools: tool.tools?.map(subTool => {
            const subToolLoadingKey = `SubTool[${name}_${subTool.name}]`
            const subToolLoading = loadingTools[subToolLoadingKey]
            return {
              ...subTool,
              enabled: subToolLoading ? subToolLoading.enabled : subTool.enabled
            }
          }),
          disabled: Boolean(tool?.error),
          toolType: isConnector(name) ? "connector" : "tool",
          sourceType: isOapTool(name) && oapTools.find(oapTool => oapTool.name === name) ? "oap" : "custom",
          plan: isOapTool(name) ? oapTools?.find(oapTool => oapTool.name === name)?.plan : undefined,
          oapId: isOapTool(name) ? oapTools?.find(oapTool => oapTool.name === name)?.id : undefined,
          commandExists: commandExistsMap[name] ?? true,
          command: mcpConfig?.mcpServers?.[name]?.command,
        }
      }

      const cachedTool = toolsCacheRef.current[name]
      const mcpServers = (mcpConfig.mcpServers as Record<string, any>)
      if (cachedTool) {
        return {
          name,
          description: cachedTool.description,
          icon: cachedTool.icon,
          enabled: toolLoading ? toolLoading.enabled : false,
          tools: cachedTool.subTools.map(subTool => {
            const subToolLoadingKey = `SubTool[${name}_${subTool.name}]`
            const subToolLoading = loadingTools[subToolLoadingKey]
            return {
              name: subTool.name,
              description: subTool.description,
              enabled: subToolLoading ? subToolLoading.enabled : subTool.enabled,
            }
          }),
          url: mcpServers[name]?.url,
          error: mcpServers[name]?.error,
          disabled: Boolean(mcpServers[name]?.disabled || mcpServers[name]?.error),
          toolType: isConnector(name) ? "connector" : "tool",
          sourceType: isOapTool(name) && oapTools.find(oapTool => oapTool.name === name) ? "oap" : "custom",
          plan: isOapTool(name) ? oapTools?.find(oapTool => oapTool.name === name)?.plan : undefined,
          oapId: isOapTool(name) ? oapTools?.find(oapTool => oapTool.name === name)?.id : undefined,
          commandExists: commandExistsMap[name] ?? true,
          command: mcpServers[name]?.command,
        }
      }

      return {
        name,
        description: "",
        enabled: toolLoading ? toolLoading.enabled : false,
        url: mcpServers[name]?.url,
        disabled: Boolean(mcpServers[name]?.disabled || mcpServers[name]?.error),
        toolType: isConnector(name) ? "connector" : "tool",
        sourceType: isOapTool(name) && oapTools.find(oapTool => oapTool.name === name) ? "oap" : "custom",
        plan: isOapTool(name) ? oapTools?.find(oapTool => oapTool.name === name)?.plan : undefined,
        oapId: isOapTool(name) ? oapTools?.find(oapTool => oapTool.name === name)?.id : undefined,
        commandExists: commandExistsMap[name] ?? true,
        command: mcpServers[name]?.command,
      }
    })

    return [...configTools].filter(tool => toolType === "all" || toolType === tool.sourceType)
  }, [tools, oapTools, mcpConfig.mcpServers, toolType, loadingTools, commandExistsMap])

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
                  <path d="M17.888 4.11123C16.0704 2.29365 13.1292 2.29365 11.3138 4.11123L9.23193 6.19307L10.3276 7.28877L12.4095 5.20693C13.5653 4.05107 15.5161 3.92861 16.7923 5.20693C18.0706 6.48525 17.9481 8.43389 16.7923 9.58975L14.7104 11.6716L15.8083 12.7694L17.8901 10.6876C19.7034 8.87002 19.7034 5.92881 17.888 4.11123ZM9.59287 16.7913C8.43701 17.9472 6.48623 18.0696 5.21006 16.7913C3.93174 15.513 4.0542 13.5644 5.21006 12.4085L7.29189 10.3267L6.19404 9.22881L4.11221 11.3106C2.29463 13.1282 2.29463 16.0694 4.11221 17.8849C5.92979 19.7003 8.871 19.7024 10.6864 17.8849L12.7683 15.803L11.6726 14.7073L9.59287 16.7913ZM5.59248 4.49795C5.56018 4.46596 5.51655 4.44802 5.47109 4.44802C5.42563 4.44802 5.38201 4.46596 5.34971 4.49795L4.49893 5.34873C4.46694 5.38103 4.449 5.42466 4.449 5.47012C4.449 5.51558 4.46694 5.5592 4.49893 5.5915L16.4099 17.5024C16.4765 17.569 16.586 17.569 16.6526 17.5024L17.5034 16.6517C17.57 16.5851 17.57 16.4755 17.5034 16.4089L5.59248 4.49795Z" fill="currentColor"/>
                </svg>
                {t("tools.toolMenu.disconnect")}
              </div>,
            onClick: () => {
              setCurrentTool(tool.name)
              setShowConfirmDisConnector(true)
            },
            active: tool.status === "running" && isConnector(tool.name) && tool.has_credential
          },
          { label:
              <div className="tool-edit-menu-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 18 18" fill="none">
                  <path d="M16.6735 1.32098C14.9174 -0.435119 12.0404 -0.435119 10.2843 1.32098L6.83435 4.77091C8.01754 4.43463 9.3004 4.52181 10.4213 5.04491L12.2147 3.25144C12.9122 2.55399 14.0456 2.55399 14.743 3.25144C15.4405 3.9489 15.4405 5.08227 14.743 5.77973L12.4887 8.03401L11.0066 9.51611C10.3092 10.2136 9.17581 10.2136 8.47832 9.51611L6.54785 11.4466C6.99622 11.895 7.51931 12.2312 8.06731 12.4429C9.54945 13.0283 11.2682 12.8041 12.5635 11.7828C12.688 11.6832 12.825 11.5711 12.9371 11.4465L15.2661 9.11752L16.6735 7.71015C18.4421 5.95409 18.4421 3.08954 16.6735 1.32098Z" fill="currentColor"/>
                  <path d="M7.49452 13.028L5.77578 14.7467C5.07832 15.4442 3.94496 15.4442 3.2475 14.7467C2.55004 14.0493 2.55004 12.916 3.2475 12.2185L6.98388 8.48211C7.68134 7.78465 8.81471 7.78465 9.51221 8.48211L11.4427 6.55165C10.9943 6.10328 10.4712 5.76701 9.92321 5.55528C8.36638 4.93255 6.53555 5.219 5.22782 6.38974C5.16555 6.43956 5.10327 6.50183 5.05346 6.55165L1.31707 10.288C-0.439025 12.0441 -0.439025 14.9211 1.31707 16.6772C3.07317 18.4333 5.95019 18.4333 7.70629 16.6772L11.0815 13.2646C9.36271 13.6631 8.96416 13.6134 7.49452 13.028Z" fill="currentColor"/>
                </svg>
                {t("tools.toolMenu.connect")}
              </div>,
            onClick: () => {
              onConnector(tool)
            },
            active: tool.enabled && tool.status === "unauthorized" && isConnector(tool.name)
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
          },
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
          <div className="tools-filter-container">
            {isLoggedInOAP &&
              <Tabs
                className="tools-type-tabs"
                tabs={[{ label: t("tools.tab.all"), value: "all" }, { label: t("tools.tab.oap"), value: "oap" }, { label: t("tools.tab.custom"), value: "custom" }]}
                value={toolType}
                onChange={setToolType}
              />
            }
            <div className="tools-filter-search">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 22 22" width="18" height="18">
                <path stroke="currentColor" strokeLinecap="round" strokeMiterlimit="10" strokeWidth="2" d="m15 15 5 5"></path>
                <path stroke="currentColor" strokeMiterlimit="10" strokeWidth="2" d="M9.5 17a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z"></path>
              </svg>
              <input
                type="text"
                placeholder={t("tools.filter.search")}
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
              />
              {filterSearch && (
                <button className="tools-filter-search-clear" onClick={() => setFilterSearch("")}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              )}
            </div>
          </div>
          {sortedTools.length > 0 && !isLoading && filterSearch && !sortedTools.some(tool => tool.name.toLowerCase().includes(filterSearch.toLowerCase())) && 
            <div className="no-oap-result-container">
              <div className="no-oap-result-title">
                {t("tools.filter.noResult")}
              </div>
            </div>
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
          {sortedTools.filter(tool => !filterSearch || tool.name.toLowerCase().includes(filterSearch.toLowerCase())).map((tool, index) => {
            // Use changingToolRef.current if this tool is being edited
            const displayTool = changingToolRef.current?.name === tool.name ? changingToolRef.current : tool
            const toolLoadingKey = `Tool[${displayTool.name}]`
            const isToolLoading = !!loadingTools[toolLoadingKey]
            return (
              <div
                key={displayTool.name}
                id={`tool-${index}`}
                onClick={() => toggleToolSection(displayTool.name)}
                className={`tool-section
                  ${displayTool.disabled ? "disabled" : ""}
                  ${displayTool.enabled ? "enabled" : ""}
                  ${expandedSections.includes(displayTool.name) ? "expanded" : ""}
                  ${isToolLoading ? "loading" : ""}
                `}
              >
                <div className="tool-header-container">
                  <div className="tool-header">
                    <div className="tool-header-content">
                      <div className="tool-status-light">
                        {isToolLoading ?
                          <div className="loading-spinner" style={{ width: "16px", height: "16px" }}></div>
                        :
                          <>
                            {displayTool.enabled && !displayTool.disabled &&
                              <svg className="tool-status-light-icon success" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
                                <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4" />
                                <circle cx="50" cy="50" r="25" fill="currentColor" />
                              </svg>}
                            {displayTool.enabled && displayTool.disabled && displayTool.status !== "unauthorized" &&
                              <svg className="tool-status-light-icon danger" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
                                <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4" />
                                <circle cx="50" cy="50" r="25" fill="currentColor" />
                              </svg>}
                            {displayTool.enabled && displayTool.disabled && displayTool.status === "unauthorized" &&
                              <svg className="tool-status-light-icon warning" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
                                <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4" />
                                <circle cx="50" cy="50" r="25" fill="currentColor" />
                              </svg>}
                          </>
                        }
                      </div>
                      {displayTool.sourceType === "oap" ?
                        <img className="tool-header-content-icon oap-logo" src={`${imgPrefix}logo_oap.png`} alt="info" />
                      :
                        <svg className="tool-header-content-icon" width="20" height="20" viewBox="0 0 24 24">
                          <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
                        </svg>
                      }
                      <span className="tool-name">{displayTool.name}</span>
                      {displayTool.sourceType === "oap" &&
                        <>
                          <div className={`tool-tag ${displayTool.plan}`}>
                            {displayTool.plan}
                          </div>
                          <Tooltip content={t("tools.oapStoreLinkAlt")}>
                            <button className="oap-store-link" onClick={(e) => {
                              e.stopPropagation()
                              openUrl(`${OAP_ROOT_URL}/mcp/${displayTool.oapId}`)
                            }}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 17 16" fill="none">
                                <path d="M3.83333 14C3.46667 14 3.15278 13.8694 2.89167 13.6083C2.63056 13.3472 2.5 13.0333 2.5 12.6667V3.33333C2.5 2.96667 2.63056 2.65278 2.89167 2.39167C3.15278 2.13056 3.46667 2 3.83333 2H7.83333C8.02222 2 8.18056 2.06389 8.30833 2.19167C8.43611 2.31944 8.5 2.47778 8.5 2.66667C8.5 2.85556 8.43611 3.01389 8.30833 3.14167C8.18056 3.26944 8.02222 3.33333 7.83333 3.33333H3.83333V12.6667H13.1667V8.66667C13.1667 8.47778 13.2306 8.31944 13.3583 8.19167C13.4861 8.06389 13.6444 8 13.8333 8C14.0222 8 14.1806 8.06389 14.3083 8.19167C14.4361 8.31944 14.5 8.47778 14.5 8.66667V12.6667C14.5 13.0333 14.3694 13.3472 14.1083 13.6083C13.8472 13.8694 13.5333 14 13.1667 14H3.83333ZM13.1667 4.26667L7.43333 10C7.31111 10.1222 7.15556 10.1833 6.96667 10.1833C6.77778 10.1833 6.62222 10.1222 6.5 10C6.37778 9.87778 6.31667 9.72222 6.31667 9.53333C6.31667 9.34444 6.37778 9.18889 6.5 9.06667L12.2333 3.33333H10.5C10.3111 3.33333 10.1528 3.26944 10.025 3.14167C9.89722 3.01389 9.83333 2.85556 9.83333 2.66667C9.83333 2.47778 9.89722 2.31944 10.025 2.19167C10.1528 2.06389 10.3111 2 10.5 2H13.8333C14.0222 2 14.1806 2.06389 14.3083 2.19167C14.4361 2.31944 14.5 2.47778 14.5 2.66667V6C14.5 6.18889 14.4361 6.34722 14.3083 6.475C14.1806 6.60278 14.0222 6.66667 13.8333 6.66667C13.6444 6.66667 13.4861 6.60278 13.3583 6.475C13.2306 6.34722 13.1667 6.18889 13.1667 6V4.26667Z" fill="currentColor"/>
                              </svg>
                            </button>
                          </Tooltip>
                        </>
                      }
                      {/* {displayTool.toolType === "connector" && displayTool.sourceType !== "oap" &&
                        <Tooltip content={t("tools.tag_oauth")}>
                          <div className={`tool-tag ${(!displayTool.hasCredential && displayTool.status === "running") ? "success" : ""}`}>
                            OAuth
                          </div>
                        </Tooltip>
                      } */}
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
                    {displayTool.disabled && displayTool.enabled && displayTool.status !== "unauthorized" && (
                        <Tooltip
                          content={
                            <div className="tool-warning-label-tooltip">
                              {(!displayTool.commandExists && displayTool.command) ?
                                t("tools.failTooltip.commandNotFound", { name: displayTool.name, command: displayTool.command })
                              :
                                t("tools.failTooltip.startFailed")
                              }
                            </div>
                          }
                        >
                          <svg className="tool-warning-label" xmlns="http://www.w3.org/2000/svg" width="14" height="12" viewBox="0 0 14 12" fill="none">
                            <path d="M0.658974 12C0.536752 12 0.425641 11.9694 0.325641 11.9083C0.225641 11.8472 0.147863 11.7667 0.0923077 11.6667C0.0367521 11.5667 0.00619658 11.4583 0.000641026 11.3417C-0.00491453 11.225 0.025641 11.1111 0.0923077 11L6.25897 0.333333C6.32564 0.222222 6.41175 0.138889 6.51731 0.0833333C6.62286 0.0277778 6.7312 0 6.84231 0C6.95342 0 7.06175 0.0277778 7.16731 0.0833333C7.27286 0.138889 7.35897 0.222222 7.42564 0.333333L13.5923 11C13.659 11.1111 13.6895 11.225 13.684 11.3417C13.6784 11.4583 13.6479 11.5667 13.5923 11.6667C13.5368 11.7667 13.459 11.8472 13.359 11.9083C13.259 11.9694 13.1479 12 13.0256 12H0.658974ZM1.80897 10.6667H11.8756L6.84231 2L1.80897 10.6667ZM6.84231 10C7.0312 10 7.18953 9.93611 7.31731 9.80833C7.44509 9.68056 7.50897 9.52222 7.50897 9.33333C7.50897 9.14444 7.44509 8.98611 7.31731 8.85833C7.18953 8.73056 7.0312 8.66667 6.84231 8.66667C6.65342 8.66667 6.49509 8.73056 6.36731 8.85833C6.23953 8.98611 6.17564 9.14444 6.17564 9.33333C6.17564 9.52222 6.23953 9.68056 6.36731 9.80833C6.49509 9.93611 6.65342 10 6.84231 10ZM6.84231 8C7.0312 8 7.18953 7.93611 7.31731 7.80833C7.44509 7.68056 7.50897 7.52222 7.50897 7.33333V5.33333C7.50897 5.14444 7.44509 4.98611 7.31731 4.85833C7.18953 4.73056 7.0312 4.66667 6.84231 4.66667C6.65342 4.66667 6.49509 4.73056 6.36731 4.85833C6.23953 4.98611 6.17564 5.14444 6.17564 5.33333V7.33333C6.17564 7.52222 6.23953 7.68056 6.36731 7.80833C6.49509 7.93611 6.65342 8 6.84231 8Z" fill="currentColor"/>
                          </svg>
                        </Tooltip>
                    )}
                    {displayTool.disabled && !displayTool.enabled && <div className="tool-disabled-label">{t("tools.installFailed")}</div>}
                    {displayTool.disabled && displayTool.enabled && displayTool.status === "unauthorized" &&
                      <Button
                        theme="Color"
                        color="neutralGray"
                        size="medium"
                        onClick={(e) => {
                          e.stopPropagation()
                          onConnector(tool)
                        }}
                      >
                        {t("tools.toolMenu.connect")}
                      </Button>
                    }
                    <div className="tool-switch-container">
                      <Switch
                        color={(displayTool.disabled && displayTool.status !== "unauthorized") ? "danger" : "primary"}
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
                  {displayTool.enabled && displayTool.toolType !== "connector" &&
                    (displayTool.status === "running" ?
                      (displayTool.tools && displayTool.tools.length > 0 ?
                        <div className="tool-content-sub-title">
                          <span>
                            {t("tools.subToolsCount", { count: displayTool.tools?.filter(subTool => subTool.enabled).length || 0, total: displayTool.tools?.length || 0 })}
                          </span>
                        </div>
                      : null)
                    :
                      <div className="tool-content-sub-title danger">
                        <span>{t("tools.subTitle.startFailed")}</span>
                      </div>
                  )}
                  {displayTool.enabled && displayTool.toolType === "connector" && (
                    <div className={`tool-content-sub-title ${displayTool.status === "failed" && "danger"} ${displayTool.status === "unauthorized" && "warning"}`}>
                      {displayTool.status === "running" &&
                        <>
                          <span>{displayTool.url}</span>
                          {displayTool.tools && displayTool.tools.length > 0 &&
                            <span>
                              {t("tools.subToolsCount", { count: displayTool.tools?.filter(subTool => subTool.enabled).length || 0, total: displayTool.tools?.length || 0 })}
                            </span>
                          }
                        </>
                      }
                      {displayTool.status === "failed" &&
                        <span>{t("tools.subTitle.startFailed")}</span>
                      }
                      {displayTool.status === "unauthorized" &&
                        <span>{t("tools.subTitle.notAuthorized")}</span>
                      }
                    </div>
                  )}
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
                          <div className="sub-tool-error" onClick={e => e.stopPropagation()}>
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
                                  active={!isLoading && !loadingTools[`Tool[${changingToolRef.current?.name ?? ""}]`]}
                                  disabled={isLoading || !!loadingTools[`Tool[${changingToolRef.current?.name ?? ""}]`]}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleAllSubTools(displayTool.name, displayTool.enabled ? "deactive" : "active")
                                  }}
                                >
                                  {displayTool.tools.some(subTool => subTool.enabled) ? t("tools.disableAll") : t("tools.enableAll")}
                                </Button>
                                <Button
                                  theme="Color"
                                  color="neutralGray"
                                  size="medium"
                                  active={changingToolRef.current?.name === displayTool.name}
                                  disabled={changingToolRef.current === null || changingToolRef.current.name !== displayTool.name || isLoading || !!loadingTools[`Tool[${changingToolRef.current?.name ?? ""}]`]}
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
        createPortal(
          <div className="global-loading-overlay">
            <div className="loading-spinner"></div>
          </div>,
          document.body
      ))}

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
            abortToolLogRef.current?.abort()
            toolLogReader?.cancel()
            setToolLogReader(null)
            setToolLog([])
            setShowCustomEditPopup(false)
          }}
          onSubmit={handleCustomSubmit}
          onConnect={onConnector}
          onDisconnect={(connectorName) => {
            setCurrentTool(connectorName)
            setShowConfirmDisConnector(true)
          }}
          toolLog={toolLog}
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
          onConfirm={() => onDisconnectConnector()}
          onCancel={cancelDisConnector}
          title={t("tools.connector.confirmDisConnect", { connector: currentTool })}
        >
          <div className="tool-confirm-content">
            {t("tools.connector.confirmDisConnectDescription", { connector: currentTool })}
          </div>
        </PopupConfirm>
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
