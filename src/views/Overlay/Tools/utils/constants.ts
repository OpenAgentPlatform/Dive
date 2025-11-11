// Tools Cache Types
export interface ToolsCache {
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

// MCP Server Props
export interface McpServersProps {
  enabled?: boolean
  command?: string
  args?: string[]
  env?: [string, unknown, boolean][]
  url?: string
  transport?: string
  initialTimeout?: number
  extraData?: {
    oap?: boolean
  }
}

// Log Types
export interface LogType {
  message: string
  type: "info" | "error" | "success"
}

// Constants
export const TOOLS_CACHE_KEY = "toolsCache"

