import { atom } from "jotai"

export interface SubTool {
  name: string
  description?: string
  enabled: boolean
}

export interface Tool {
  name: string
  description?: string
  icon?: string
  tools?: SubTool[]
  error?: string
  enabled: boolean
  disabled?: boolean
}

export const toolsAtom = atom<Tool[]>([])

export const enabledToolsAtom = atom<Tool[]>(
  (get, set) => {
    const tools = get(toolsAtom)
    return tools.filter((tool) => tool.enabled)
  }
)

export const loadToolsAtom = atom(
  null,
  async (get, set) => {
    const response = await fetch("/api/tools")
    const data = await response.json()
    if (data.success) {
      set(toolsAtom, data.tools)
    }

    return data
  }
)
