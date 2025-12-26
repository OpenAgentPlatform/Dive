import { invokeIPC, isElectron } from "."

export function responseLocalIPCElicitation(action: number, content: any) {
  if (isElectron) {
    return window.ipcRenderer.responsedIPCElicitation(action, content)
  }

  return invokeIPC("response_mcp_elicitation", { data: { action, content } })
}
