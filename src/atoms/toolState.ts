import { atom } from "jotai"

export interface MCP {
  type: "oap" | "custom"
  planTag?: string
  description: string
  icon?: string
  disabled?: boolean
  enabled?: boolean
  error?: string
  env?: Record<string, unknown>
  exclude_tools?: string[]
  command?: string
  extraData?: Record<string, unknown>
}

export interface MCPConfig {
  [key: string]: MCP
}

export interface SubTool {
  name: string
  description?: string
  enabled: boolean
}

export interface Tool {
  name: string
  oapId?: string
  type?: "oap" | "custom" | "connector"
  description?: string
  url?: string
  icon?: string
  tools?: SubTool[]
  error?: string
  enabled: boolean
  disabled?: boolean
  status?: "failed" | "running" | "unauthorized"
  has_credential?: boolean
  command?: string
  commandExists?: boolean
  extraData?: Record<string, any>
}

export const toolsAtom = atom<Tool[]>([])

export const enabledToolsAtom = atom<Tool[]>(
  (get) => {
    const tools = get(toolsAtom)
    return tools.filter((tool) => tool.enabled)
  }
)

export const successToolsAtom = atom<Tool[]>(
  (get) => {
    const tools = get(toolsAtom)
    return tools.filter((tool) => tool.enabled && !tool.error)
  }
)

export const loadToolsAtom = atom(
  null,
  async (get, set) => {
    const response = await fetch("/api/tools")
    const data = await response.json()
    const mcpserverResponse = await fetch("/api/config/mcpserver")
    const mcpserverData = await mcpserverResponse.json()
    if (data.success) {
      let tools = data.tools
      if (mcpserverData.success) {
        tools = tools.filter((tool: Tool) => {
          const mcpserver = Object.keys(mcpserverData.config.mcpServers).find((mcpServer: string) => mcpServer === tool.name)
          return mcpserver ? tool : null
        })
      }
      set(toolsAtom, tools)
    }

    return data
  }
)

export const mcpConfigAtom = atom<{mcpServers: MCPConfig}>({mcpServers: {}})

export const loadMcpConfigAtom = atom(
  null,
  async (get, set) => {
    const response = await fetch("/api/config/mcpserver")
    const data = await response.json()
    if (data.success) {
      set(mcpConfigAtom, data.config)
    } else {
      set(mcpConfigAtom, {mcpServers: {}})
    }

    return data
  }
)

export const forceRestartMcpConfigAtom = atom(
  null,
  async (get, set) => {
    await set(loadMcpConfigAtom)
    const mcpConfig = get(mcpConfigAtom)
    await fetch("/api/config/mcpserver?force=1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mcpConfig)
    })
      .then(async (response) => await response.json())
      .catch((error) => {
        console.error("Failed to update MCP config:", error)
      })

    return true
  }
)

export const installToolBufferAtom = atom<{name: string, config: Record<string, MCP>}[]>([])

export const loadingToolsAtom = atom<Record<string, { enabled: boolean }>>({})
