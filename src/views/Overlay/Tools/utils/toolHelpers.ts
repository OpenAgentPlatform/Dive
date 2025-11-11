import { OAPMCPServer } from "../../../../../types/oap"

// Check if arrays are equal
export const arrayEqual = (arr1: any[], arr2: any[]): boolean => {
  if (arr1.length !== arr2.length) {
    return false
  }
  const sortedA = [...arr1].sort()
  const sortedB = [...arr2].sort()
  return sortedA.every((val, index) => val === sortedB[index])
}

// Check if tool is from OAP
export const isOapTool = (toolName: string, oapTools: OAPMCPServer[]): boolean => {
  return oapTools?.find(oapTool => oapTool.name === toolName) ? true : false
}

// Check if tool is a connector
export const isConnector = (toolName: string, mcpConfig: { mcpServers: Record<string, any> }): boolean => {
  return mcpConfig.mcpServers[toolName]?.transport === "streamable"
}

