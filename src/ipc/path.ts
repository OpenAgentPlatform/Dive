import { invoke } from "@tauri-apps/api/core"
import { isElectron } from "./env"

export interface PathEntry {
  name: string
  path: string
  isDir: boolean
}

export interface PathSearchResult {
  entries: PathEntry[]
  error?: string
}

export async function searchPath(path: string): Promise<PathSearchResult> {
  if (isElectron) {
    return window.ipcRenderer.invoke("path:search", path)
  }

  return invoke<PathSearchResult>("path_search", { path })
}
