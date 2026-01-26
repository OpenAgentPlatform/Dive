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

export async function fuzzySearchPath(basePath: string, query: string): Promise<PathSearchResult> {
  if (isElectron) {
    return window.ipcRenderer.invoke("path:fuzzy-search", basePath, query)
  }

  return invoke<PathSearchResult>("path_fuzzy_search", { basePath, query })
}
