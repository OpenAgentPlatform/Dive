import { enabledToolsAtom, loadingToolsAtom, loadMcpConfigAtom, loadToolsAtom, MCPConfig, mcpConfigAtom, Tool, toolsAtom } from "../atoms/toolState"
import Button from "./Button"
import DropDownSearch, { DropDownOptionType, DropDownProps } from "./DropDownSearch"
import { useTranslation } from "react-i18next"
import Switch from "./Switch"
import { useEffect, useMemo, useRef, useState } from "react"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { loadOapToolsAtom, oapToolsAtom } from "../atoms/oapState"
import { showToastAtom } from "../atoms/toastState"
import { openOverlayAtom } from "../atoms/layerState"
import { imgPrefix } from "../ipc"
import { checkCommandExist } from "../ipc/util"
import Tooltip from "./Tooltip"

const ToolDropDown: React.FC = () => {
  const { t } = useTranslation()
  const showToast = useSetAtom(showToastAtom)
  const openOverlay = useSetAtom(openOverlayAtom)
  const [tools] = useAtom(toolsAtom)
  const enabledTools = useAtomValue(enabledToolsAtom)
  const [oapTools] = useAtom(oapToolsAtom)
  const [sortedTools, setSortedTools] = useState<Tool[]>(tools)
  const [mcpConfig, setMcpConfig] = useAtom(mcpConfigAtom)
  const loadMcpConfig = useSetAtom(loadMcpConfigAtom)
  const mcpConfigRef = useRef<{mcpServers: MCPConfig} | null>(null)
  const [loadingTools, setLoadingTools] = useAtom(loadingToolsAtom)
  const loadTools = useSetAtom(loadToolsAtom)
  const loadOapTools = useSetAtom(loadOapToolsAtom)
  const [isResort, setIsResort] = useState(true)
  const [searchText, setSearchText] = useState("")
  const [currentMenuKey, setCurrentMenuKey] = useState<string | null>("root")
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [commandExistsMap, setCommandExistsMap] = useState<Record<string, boolean>>({})

  useEffect(() => {
    (async () => {
      if(Object.keys(loadingTools).length === 0) {
        await loadMcpConfig()
        mcpConfigRef.current = JSON.parse(JSON.stringify(mcpConfig))
        await loadTools()
        await loadOapTools()
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

  const updateMCPConfig = async (newConfig: Record<string, any> | string, force = false) => {
    if(abortController) {
      abortController.abort()
    }
    const newAbortController = new AbortController()
    setAbortController(newAbortController)
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
      signal: newAbortController.signal
    })
      .then(async (response) => await response.json())
      .catch((error) => {
        if(error.name === "AbortError") {
          return
        }
        showToast({
          message: error instanceof Error ? error.message : t("tools.configFetchFailed"),
          type: "error"
        })
      })
  }

  const handleUpdateConfigResponse = (data: { errors: { error: string; serverName: string }[], detail: any }, isShowToast = false, toolName?: string) => {
    if (data?.errors && data.errors.length && Array.isArray(data.errors)) {
      data.errors.forEach(({ error, serverName }: { error: string; serverName: string }) => {
        if(isShowToast && (!toolName || toolName === serverName)) {
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
          if(isShowToast && (!toolName || toolName === serverName)) {
            showToast({
              message: t("tools.updateFailed", { serverName, error }),
              type: "error",
              closable: true
            })
          }
        })
    }
    if(!data?.errors?.some((error: any) => tools.find(tool => tool.name === error.serverName && tool.name === toolName)) &&
        !data?.detail?.some((item: any) => item.type.includes("error"))) {
        if(isShowToast) {
          showToast({
            message: t("tools.saveSuccess"),
            type: "success"
          })
        }
    }
  }

  const toggleTool = async (tool: Tool) => {
    const loadingKey = `Tool[${tool.name}]`
    const targetEnabled = !tool.enabled
    setLoadingTools(prev => ({ ...prev, [loadingKey]: { enabled: targetEnabled } }))
    try {
      if(!mcpConfigRef.current) {
        mcpConfigRef.current = JSON.parse(JSON.stringify(mcpConfig))
      }

      const newSortedTools = JSON.parse(JSON.stringify(sortedTools))
      newSortedTools.find((t: Tool) => t.name === tool.name).enabled = !tool.enabled

      const currentEnabled = tool.enabled
      const newConfig = JSON.parse(JSON.stringify(mcpConfigRef.current))
      newConfig.mcpServers[tool.name].enabled = !currentEnabled
      if(newConfig.mcpServers[tool.name].enabled && tool.tools?.every(subTool => !subTool.enabled)) {
        newConfig.mcpServers[tool.name].exclude_tools = []
        newSortedTools.find((t: Tool) => t.name === tool.name).tools?.map((subTool: Tool) => {
          subTool.enabled = true
        })
      }
      mcpConfigRef.current = newConfig
      setSortedTools(newSortedTools)

      // The backend locks API requests and processes them sequentially.
      const data = await updateMCPConfig(mcpConfigRef.current ?? "")
      if (data?.errors && Array.isArray(data.errors) && data.errors.length) {
        data.errors
          .map((e: any) => e.serverName)
          .forEach((serverName: string) => {
            if(mcpConfigRef.current?.mcpServers[serverName]) {
              mcpConfigRef.current.mcpServers[serverName].disabled = true
            }
          })

        // reset enable
        await updateMCPConfig(mcpConfigRef.current ?? "")
      }

      if(data) {
        if (data.success) {
          setMcpConfig(mcpConfigRef.current ?? { mcpServers: {} })
          handleUpdateConfigResponse(data, true, tool.name)
        }
        setLoadingTools({})
      }
    } catch (error) {
      console.log(error)
      showToast({
        message: error instanceof Error ? error.message : t("tools.toggleFailed"),
        type: "error"
      })
    }
  }

  const toggleSubTool = async (toolName: string, subToolName: string, action: "add" | "remove") => {
    // remove: active
    // add: deactive
    let updatedTool: Tool | null = null

    const _sortedTool = sortedTools.find(tool => tool.name === toolName)
    const newSortedTool = JSON.parse(JSON.stringify(_sortedTool))
    const subToolIndex = newSortedTool?.tools?.findIndex((subTool: Tool) => subTool.name === subToolName)

    if(newSortedTool?.enabled) {
      if(newSortedTool?.tools && subToolIndex > -1) {
        if(action === "add") {
          newSortedTool.tools[subToolIndex].enabled = false
        } else {
          newSortedTool.tools[subToolIndex].enabled = true
        }
      }

      if(newSortedTool?.tools.filter((subTool: Tool) => subTool.enabled).length === 0) {
        newSortedTool.enabled = false
      } else {
        newSortedTool.enabled = true
      }
    } else {
      newSortedTool.enabled = true
      newSortedTool.tools.map((subTool: Tool) => {
        subTool.enabled = false
        if(subTool.name === subToolName) {
          subTool.enabled = true
        }
      })
    }

    updatedTool = newSortedTool

    // record loading state
    // when re-open the dropdown, reset tool state with loading state
    // because loading tools state is not updated in api response
    const loadingKey = `SubTool[${toolName}_${subToolName}]`
    const targetSubToolEnabled = action === "remove"

    setLoadingTools(prev => ({
      ...prev,
      [`Tool[${toolName}]`]: { enabled: newSortedTool.enabled },
      [loadingKey]: { enabled: targetSubToolEnabled }
    }))

    // update sortedTools state
    const newSortedTools = sortedTools.map(tool => tool.name === newSortedTool.name ? newSortedTool : tool)
    setSortedTools(newSortedTools)

    if(updatedTool) {
      subToolPost(updatedTool, toolName, subToolName)
    }
  }

  const subToolPost = async (tool: Tool, toolName: string, subToolName: string) => {
    if(!mcpConfig) {
      return
    }
    const toolLoadingKey = `Tool[${toolName}]`
    const subToolLoadingKey = `SubTool[${toolName}_${subToolName}]`

    try {
      if(!mcpConfigRef.current) {
        mcpConfigRef.current = JSON.parse(JSON.stringify(mcpConfig))
      }
      if(!mcpConfigRef.current) {
        setLoadingTools(prev => {
          const { [toolLoadingKey]: _, [subToolLoadingKey]: __, ...rest } = prev
          return rest
        })
        return
      }

      const currentEnabled = tool?.enabled

      const newConfig = JSON.parse(JSON.stringify(mcpConfigRef.current))
      newConfig.mcpServers[tool.name].enabled = currentEnabled
      if(tool.tools?.every(subTool => !subTool.enabled) && !currentEnabled) {
        newConfig.mcpServers[tool.name].exclude_tools = []
      } else if(currentEnabled) {
        newConfig.mcpServers[tool.name].exclude_tools = tool.tools?.filter(subTool => !subTool.enabled).map(subTool => subTool.name) ?? []
      }
      mcpConfigRef.current = newConfig

      const data = await updateMCPConfig(mcpConfigRef.current ?? "")
      if (data?.errors && Array.isArray(data.errors) && data.errors.length) {
        data.errors
          .map((e: any) => e.serverName)
          .forEach((serverName: string) => {
            if(mcpConfigRef.current?.mcpServers[serverName]) {
              mcpConfigRef.current.mcpServers[serverName].disabled = true
            }
          })

        // reset enable
        await updateMCPConfig(mcpConfigRef.current ?? "")
      }

      if(data) {
        if (data.success) {
          setMcpConfig(mcpConfigRef.current ?? { mcpServers: {} })
          handleUpdateConfigResponse(data, false)
        }
        setLoadingTools({})
      }
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : t("tools.toggleFailed"),
        type: "error"
      })
    }
  }

  const toggleAllSubTools = async (toolName: string, action: "deactive" | "active") => {
    const _sortedTool = sortedTools.find(tool => tool.name === toolName)
    const newSortedTool = JSON.parse(JSON.stringify(_sortedTool))
    newSortedTool.tools?.forEach((subTool: Tool) => {
      subTool.enabled = action === "active"
    })
    newSortedTool.enabled = action === "active"
    const updatedTool = newSortedTool

    // record loading state
    // when re-open the dropdown, reset tool state with loading state
    // because loading tools state is not updated in api response
    const newLoadingTools: Record<string, { enabled: boolean }> = {}
    newSortedTool.tools?.forEach((subTool: Tool) => {
      newLoadingTools[`SubTool[${toolName}_${subTool.name}]`] = { enabled: subTool.enabled }
    })
    newLoadingTools[`Tool[${toolName}]`] = { enabled: newSortedTool.enabled }
    setLoadingTools(prev => (
      {
        ...prev,
        ...newLoadingTools
      }
    ))

    // update sortedTools state
    const newSortedTools = sortedTools.map(tool => tool.name === newSortedTool.name ? newSortedTool : tool)
    setSortedTools(newSortedTools)

    if(updatedTool) {
      allSubToolPost(updatedTool, toolName, action)
    }
  }

  const allSubToolPost = async (tool: Tool, toolName: string, action: "deactive" | "active") => {
    if(!mcpConfig) {
      return
    }
    const toolLoadingKey = `Tool[${toolName}]`

    try {
      if(!mcpConfigRef.current) {
        mcpConfigRef.current = JSON.parse(JSON.stringify(mcpConfig))
      }
      if(!mcpConfigRef.current) {
        setLoadingTools(prev => {
          const { [toolLoadingKey]: _, ...rest } = prev
          return rest
        })
        return
      }

      const newConfig = JSON.parse(JSON.stringify(mcpConfigRef.current))
      newConfig.mcpServers[tool.name].enabled = action === "active"
      if(action === "active") {
        newConfig.mcpServers[tool.name].exclude_tools = []
      } else if(action === "deactive") {
        newConfig.mcpServers[tool.name].exclude_tools = tool.tools?.map(subTool => subTool.name) ?? []
      }
      mcpConfigRef.current = newConfig

      const data = await updateMCPConfig(mcpConfigRef.current ?? "")
      if (data?.errors && Array.isArray(data.errors) && data.errors.length) {
        data.errors
          .map((e: any) => e.serverName)
          .forEach((serverName: string) => {
            if(mcpConfigRef.current?.mcpServers[serverName]) {
              mcpConfigRef.current.mcpServers[serverName].disabled = true
            }
          })

        // reset enable
        await updateMCPConfig(mcpConfigRef.current ?? "")
      }

      if(data) {
        if (data.success) {
          setMcpConfig(mcpConfigRef.current ?? { mcpServers: {} })
          handleUpdateConfigResponse(data, false)
        }
        setLoadingTools({})
      }
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : t("tools.toggleFailed"),
        type: "error"
      })
    }
  }

  const isOapTool = (toolName: string) => {
    return oapTools?.find(oapTool => oapTool.name === toolName) ? true : false
  }

  const toolSort = (a: Tool, b: Tool) => {
    const aTool = a.name
    const bTool = b.name
    const aIsOap = oapTools?.find(oapTool => oapTool.name === aTool)
    const aEnabled = tools.find(tool => tool.name === aTool)?.enabled
    const bEnabled = tools.find(tool => tool.name === bTool)?.enabled
    if (isResort) {
      if (aEnabled && !bEnabled)
        return -1
      if (!aEnabled && bEnabled)
        return 1
      return aIsOap ? -1 : 1
    } else {
      const aIndex = sortedTools.findIndex(tool => tool.name === aTool)
      const bIndex = sortedTools.findIndex(tool => tool.name === bTool)
      return aIndex - bIndex
    }

    return 0
  }

  useEffect(() => {
    const newSortedTools = tools.sort(toolSort).map(tool => {
      const toolLoadingKey = `Tool[${tool.name}]`
      const toolLoading = loadingTools[toolLoadingKey]
      return {
        ...tool,
        enabled: toolLoading ? toolLoading.enabled : tool.enabled,
        disabled: Boolean(tool?.error),
        type: (isOapTool(tool.name) ? "oap" : "custom") as "oap" | "custom",
        plan: isOapTool(tool.name) ? oapTools?.find(oapTool => oapTool.name === tool.name)?.plan : undefined,
        oapId: isOapTool(tool.name) ? oapTools?.find(oapTool => oapTool.name === tool.name)?.id : undefined,
        commandExists: commandExistsMap[tool.name] ?? true,
        command: mcpConfig?.mcpServers?.[tool.name]?.command,
        tools: tool.tools?.map(subTool => {
          const subToolLoadingKey = `SubTool[${tool.name}_${subTool.name}]`
          const subToolLoading = loadingTools[subToolLoadingKey]
          return {
            ...subTool,
            enabled: subToolLoading ? subToolLoading.enabled : subTool.enabled
          }
        })
      }
    })
    setSortedTools(newSortedTools)
    setIsResort(false)
  }, [tools, oapTools, isResort, commandExistsMap])

  const toolsDropdownOptions = useMemo(() => {
    const options: DropDownProps["options"] = {
      "root": {
        subOptions: [
          {
            label:
              <div className="chat-input-tools-option head">
                <div className="chat-input-tools-option-left">
                  <div className="chat-input-tools-option-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M8.39551 18L7.93717 15.625C7.61773 15.5 7.3087 15.3542 7.01009 15.1875C6.71148 15.0208 6.43023 14.8264 6.16634 14.6042L3.87467 15.375L2.27051 12.6042L4.08301 11.0208C4.05523 10.8542 4.0344 10.6875 4.02051 10.5208C4.00662 10.3542 3.99967 10.1806 3.99967 10C3.99967 9.81944 4.00662 9.64583 4.02051 9.47917C4.0344 9.3125 4.05523 9.14583 4.08301 8.97917L2.27051 7.39583L3.87467 4.625L6.16634 5.39583C6.43023 5.17361 6.71148 4.97917 7.01009 4.8125C7.3087 4.64583 7.61773 4.5 7.93717 4.375L8.39551 2H11.6038L12.0622 4.375C12.3816 4.5 12.6906 4.64583 12.9893 4.8125C13.2879 4.97917 13.5691 5.17361 13.833 5.39583L16.1247 4.625L17.7288 7.39583L15.9163 8.97917C15.9441 9.14583 15.965 9.3125 15.9788 9.47917C15.9927 9.64583 15.9997 9.81944 15.9997 10C15.9997 10.1806 15.9927 10.3542 15.9788 10.5208C15.965 10.6875 15.9441 10.8542 15.9163 11.0208L17.7288 12.6042L16.1247 15.375L13.833 14.6042C13.5691 14.8264 13.2879 15.0208 12.9893 15.1875C12.6906 15.3542 12.3816 15.5 12.0622 15.625L11.6038 18H8.39551ZM9.99967 13C10.833 13 11.5413 12.7083 12.1247 12.125C12.708 11.5417 12.9997 10.8333 12.9997 10C12.9997 9.16667 12.708 8.45833 12.1247 7.875C11.5413 7.29167 10.833 7 9.99967 7C9.16634 7 8.45801 7.29167 7.87467 7.875C7.29134 8.45833 6.99967 9.16667 6.99967 10C6.99967 10.8333 7.29134 11.5417 7.87467 12.125C8.45801 12.7083 9.16634 13 9.99967 13Z" fill="currentColor"/>
                    </svg>
                  </div>
                  <div className="chat-input-tools-option-label">
                    {t("chat.tools.mcpToolsManagement")}
                  </div>
                </div>
                <div className="chat-input-tools-option-left">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="23" viewBox="0 0 22 23" fill="none">
                    <path d="M12.0998 11.4991L8.5248 7.92409C8.35675 7.75603 8.27272 7.54214 8.27272 7.28242C8.27272 7.0227 8.35675 6.80881 8.5248 6.64076C8.69286 6.4727 8.90675 6.38867 9.16647 6.38867C9.42619 6.38867 9.64008 6.4727 9.80814 6.64076L14.0248 10.8574C14.2081 11.0408 14.2998 11.2546 14.2998 11.4991C14.2998 11.7435 14.2081 11.9574 14.0248 12.1408L9.80814 16.3574C9.64008 16.5255 9.42619 16.6095 9.16647 16.6095C8.90675 16.6095 8.69286 16.5255 8.5248 16.3574C8.35675 16.1894 8.27272 15.9755 8.27272 15.7158C8.27272 15.456 8.35675 15.2421 8.5248 15.0741L12.0998 11.4991Z" fill="currentColor"/>
                  </svg>
                </div>
              </div>,
            onClick: () => {
              openOverlay({ page: "Setting", tab: "Tools" })
            }
          }
        ],
        showSearch: true
      }
    }

    sortedTools.forEach(tool => {
      // if (tool.name == "__SYSTEM_DIVE_SERVER__") {
      //   return
      // }

      let subOptions: DropDownOptionType[] = []
      if(tool.error) {
        subOptions = [
          {
            label:
              <div className="chat-input-tools-error">
                <div className="chat-input-tools-error-title">Error Message</div>
                <div className="chat-input-tools-error-content">{tool.error}</div>
              </div>,
            autoClose: false,
            noHover: true
          }
        ]
      } else if(tool.tools && tool.tools.length > 0) {
        subOptions = [
          {
            label:
              <div className="chat-input-tools-option-toggle-all">
                {(tool.tools?.some(t => t.enabled) && tool.enabled) ? t("chat.tools.disableAll") : t("chat.tools.enableAll")}
              </div>,
            onClick: () => {
              toggleAllSubTools(tool.name, (tool.tools?.some(t => t.enabled) && tool.enabled) ? "deactive" : "active")
            },
            autoClose: false,
            visible: searchText ? false : true
          }
        ]
        tool.tools.forEach(subTool => {
          subOptions.push({
            label:
              <div className="chat-input-tools-option">
                <div className="chat-input-tools-option-left">
                  <div className="chat-input-tools-option-icon sub-tool">
                    {tool.icon ? tool.icon :
                      isOapTool(tool.name) ?
                        <img src={`${imgPrefix}logo_oap.png`} alt="info" />
                      :
                        <svg width="22" height="22" viewBox="0 0 24 24">
                          <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" fill="currentColor"/>
                        </svg>
                    }
                  </div>
                  <div className="chat-input-tools-option-label">
                    <div className="chat-input-tools-option-title">
                      {subTool.name}
                    </div>
                  </div>
                </div>
                <div className="chat-input-tools-option-right">
                  <svg className={(tool.enabled && subTool.enabled) ? "show" : ""} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 22 22" width="22" height="22">
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="m4.67 10.424 4.374 4.748 8.478-7.678"></path>
                  </svg>
                </div>
              </div>,
            onClick: (e) => {
              toggleSubTool(tool.name, subTool.name, (!tool.enabled || !subTool.enabled) ? "remove" : "add")
            },
            autoClose: false,
            visible: !searchText || subTool.name.toLowerCase().includes(searchText.toLowerCase())
          })
        })
        subOptions.push({
          label:
            <div className="no-result">
              {t("chat.tools.noSearchResultsText")}
            </div>,
          visible: (searchText
            && !tool.tools?.some(t => t.name.toLowerCase().includes(searchText.toLowerCase())))
            ? true : false,
          noHover: true
        })
      } else if(tool.description) {
        subOptions = [
          {
            label:
              <div className="chat-input-tools-description">
                <div>{tool.description}</div>
              </div>,
            autoClose: false
          }
        ]
      }

      if(subOptions.length > 0) {
        options[tool.name] = {
          subOptions: subOptions,
          showSearch: (tool.error || !tool.tools || tool.tools.length === 0) ? false : true,
          preLabel: tool.name
        }
      }

      options.root.subOptions.push({
        label:
          <div className="chat-input-tools-option">
            <div className="chat-input-tools-option-left">
              <div className="chat-input-tools-option-icon">
                {tool.icon ? tool.icon :
                  isOapTool(tool.name) ?
                    <img src={`${imgPrefix}logo_oap.png`} alt="info" />
                  :
                    <svg width="22" height="22" viewBox="0 0 24 24">
                      <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" fill="currentColor"/>
                    </svg>
                }
              </div>
              <div className="chat-input-tools-option-label">
                <div className="chat-input-tools-option-title">
                  {tool.name}
                </div>
                <div className={`chat-input-tools-option-desc ${(tool.disabled && tool.enabled) ? "error" : ""}`}>
                  {
                    (!tool.disabled && tool.enabled && tool.tools && (tool.tools?.length ?? 0) > 0) &&
                      t("tools.subToolsCount", { count: tool.tools?.filter(subTool => subTool.enabled).length || 0, total: tool.tools?.length || 0 })
                  }
                  {
                    (!tool.disabled && !tool.enabled) &&
                      t("tools.disabledDescription")
                  }
                  {
                    (tool.disabled && tool.enabled) &&
                      t("tools.subTitle.startFailed")
                  }
                  {
                    (tool.disabled && !tool.enabled) &&
                      t("tools.installFailed")
                  }
                </div>
              </div>
            </div>
            <div
              className="chat-input-tools-option-right"
              onClick={(e) => e.stopPropagation()}
            >
              {
                (tool.disabled && tool.enabled) &&
                  <Tooltip
                    content={
                      <div className="tool-warning-label-tooltip">
                        {(!tool.commandExists && tool.command) ?
                          t("tools.failTooltip.commandNotFound", { name: tool.name, command: tool.command })
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
              }
              <Switch
                size="x-small"
                color={tool.disabled ? "danger" : "primary"}
                checked={tool.enabled}
                onChange={() => toggleTool(tool)}
              />
            </div>
          </div>,
        childrenKey: subOptions.length > 0 ? tool.name : undefined,
        visible: searchText ? tool.name.toLowerCase().includes(searchText.toLowerCase()) : true
      })

      tool.tools?.forEach(subTool => {
        options.root.subOptions.push({
          label:
            <div className="chat-input-tools-option">
              <div className="chat-input-tools-option-left">
                <div className="chat-input-tools-option-icon sub-tool">
                  {tool.icon ? tool.icon :
                    isOapTool(tool.name) ?
                      <img src={`${imgPrefix}logo_oap.png`} alt="info" />
                    :
                      <svg width="22" height="22" viewBox="0 0 24 24">
                        <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" fill="currentColor"/>
                      </svg>
                  }
                </div>
                <div className="chat-input-tools-option-label">
                  <div className="chat-input-tools-option-title">
                    {subTool.name}
                  </div>
                </div>
              </div>
              <div className="chat-input-tools-option-right">
                <svg className={(tool.enabled && subTool.enabled) ? "show" : ""} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 22 22" width="22" height="22">
                  <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="m4.67 10.424 4.374 4.748 8.478-7.678"></path>
                </svg>
              </div>
            </div>,
          onClick: (e) => {
            toggleSubTool(tool.name, subTool.name, (!tool.enabled || !subTool.enabled) ? "remove" : "add")
          },
          autoClose: false,
          visible: !!searchText && subTool.name.toLowerCase().includes(searchText.toLowerCase())
        })
      })
    })

    /**
   * Note: The ToolDropDown options are controlled by the 'visible' prop.
   * This is not the actual no-result state from DropDownSearch itself,
   * so we need to manually add a no-result option here when no matches are shown.
   */
    options.root.subOptions.push({
      label:
        <div className="no-result">
          {t("chat.tools.noSearchResultsText")}
        </div>,
      visible: currentMenuKey === "root"
        && !!searchText
        && !tools.some(tool => tool.name.toLowerCase().includes(searchText.toLowerCase()))
        && !tools.some(tool => tool.tools?.some(t => t.name.toLowerCase().includes(searchText.toLowerCase())))
    })

    return options
  }, [sortedTools, loadingTools, searchText, currentMenuKey])

  return (
    <>
      <DropDownSearch
        rootKey="root"
        placement="bottom"
        contentClassName="chat-input-tools-dropdown"
        options={toolsDropdownOptions}
        fixWidth={300}
        fixHeight={360}
        size="m"
        onKeyChange={(key) => {
          setCurrentMenuKey(key)
        }}
        onSearch={(value) => {
          setSearchText(value)
        }}
        searchInputIndex={1}
        searchPlaceholder={t("chat.tools.searchPlaceholder")}
        searchNoResultText={t("chat.tools.noSearchResultsText")}
        searchIcon={
          Object.keys(loadingTools).length > 0 ?
            <div className="search-loading-spinner"></div>
          :
            null
        }
        onOpen={async () => {
          if(Object.keys(loadingTools).length === 0) {
            await loadMcpConfig()
            mcpConfigRef.current = JSON.parse(JSON.stringify(mcpConfig))
            await loadOapTools()
            await loadTools()
          }
          // await loadOapTools()
          // await loadTools()
          setIsResort(true)
          setCurrentMenuKey("root")
        }}
        onClose={async () => {
          setCurrentMenuKey("root")
        }}
      >
        <Button
          theme="TextOnly"
          color="neutral"
          size="medium"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M16.3625 18.287L12.3062 14.2307L14.2312 12.3057L18.2875 16.362C18.5472 16.6217 18.6771 16.9425 18.6771 17.3245C18.6771 17.7064 18.5472 18.0273 18.2875 18.287C18.0278 18.5467 17.7069 18.6766 17.325 18.6766C16.943 18.6766 16.6222 18.5467 16.3625 18.287ZM3.71248 18.287C3.45276 18.0273 3.3229 17.7064 3.3229 17.3245C3.3229 16.9425 3.45276 16.6217 3.71248 16.362L9.07498 10.9995L7.51665 9.44115C7.34859 9.6092 7.1347 9.69323 6.87498 9.69323C6.61526 9.69323 6.40137 9.6092 6.23331 9.44115L5.70623 8.91406V10.9766C5.70623 11.1905 5.61456 11.3356 5.43123 11.412C5.2479 11.4884 5.07984 11.4502 4.92706 11.2974L2.42914 8.79948C2.27637 8.6467 2.23817 8.47865 2.31456 8.29531C2.39095 8.11198 2.53609 8.02031 2.74998 8.02031H4.81248L4.30831 7.51615C4.12498 7.33281 4.03331 7.11892 4.03331 6.87448C4.03331 6.63003 4.12498 6.41615 4.30831 6.23281L6.92081 3.62031C7.22637 3.31476 7.55484 3.09323 7.90623 2.95573C8.25762 2.81823 8.61664 2.74948 8.98331 2.74948C9.28887 2.74948 9.57533 2.79531 9.84269 2.88698C10.11 2.97865 10.3736 3.11615 10.6333 3.29948C10.7555 3.37587 10.8205 3.48281 10.8281 3.62031C10.8357 3.75781 10.7861 3.88003 10.6791 3.98698L8.93748 5.72865L9.44164 6.23281C9.6097 6.40087 9.69373 6.61476 9.69373 6.87448C9.69373 7.1342 9.6097 7.34809 9.44164 7.51615L11 9.07448L13.0625 7.01198C13.0014 6.84392 12.9517 6.66823 12.9135 6.4849C12.8753 6.30156 12.8562 6.11823 12.8562 5.9349C12.8562 5.03351 13.1656 4.27344 13.7844 3.65469C14.4031 3.03594 15.1632 2.72656 16.0646 2.72656C16.1868 2.72656 16.3014 2.73038 16.4083 2.73802C16.5153 2.74566 16.6222 2.76476 16.7291 2.79531C16.8666 2.84115 16.9545 2.93663 16.9927 3.08177C17.0309 3.22691 16.9965 3.35295 16.8896 3.4599L15.4 4.94948C15.3083 5.04115 15.2625 5.14809 15.2625 5.27031C15.2625 5.39253 15.3083 5.49948 15.4 5.59115L16.4083 6.59948C16.5 6.69115 16.6069 6.73698 16.7291 6.73698C16.8514 6.73698 16.9583 6.69115 17.05 6.59948L18.5396 5.1099C18.6465 5.00295 18.7725 4.96476 18.9177 4.99531C19.0628 5.02587 19.1583 5.11753 19.2041 5.27031C19.2347 5.37726 19.2538 5.4842 19.2614 5.59115C19.2691 5.69809 19.2729 5.81267 19.2729 5.9349C19.2729 6.83628 18.9635 7.59635 18.3448 8.2151C17.726 8.83385 16.966 9.14323 16.0646 9.14323C15.8812 9.14323 15.6979 9.12795 15.5146 9.0974C15.3312 9.06684 15.1555 9.01337 14.9875 8.93698L5.63748 18.287C5.37776 18.5467 5.05692 18.6766 4.67498 18.6766C4.29303 18.6766 3.9722 18.5467 3.71248 18.287Z" fill="currentColor"/>
          </svg>
          {`${enabledTools.length} ${t("chat.tools.button")}`}
        </Button>
      </DropDownSearch>
    </>
  )
}

export default ToolDropDown
