import { isElectron } from "./env"
import { listen } from "@tauri-apps/api/event"
import { invoke as tauriInvoke } from "@tauri-apps/api/core"

export * from "./env"
export * from "./init"
export * from "./oap"
export * from "./host"
export * from "./config"
export * from "./llm"
export * from "./lipc"
export * from "./path"

export function listenIPC(event: string, listener: (...args: any[]) => void): () => void {
  if (isElectron) {
    window.ipcRenderer.on(event, listener)
    return () => window.ipcRenderer.off(event, listener)
  }

  const unlisten = listen(event, listener)
  return async () => (await unlisten)()
}

export async function invokeIPC(cmd: string, ...args: any[]) {
  if (isElectron) {
    return window.ipcRenderer.invoke(cmd, ...args)
  }

  return tauriInvoke(cmd, ...args)
}