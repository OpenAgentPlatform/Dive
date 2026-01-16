import { ipcMain, BrowserWindow } from "electron"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"

interface PathEntry {
  name: string
  path: string
  isDir: boolean
}

interface PathSearchResult {
  entries: PathEntry[]
  error?: string
}

export function ipcPathHandler(_win: BrowserWindow) {
  ipcMain.handle("path:search", async (_event, searchPath: string): Promise<PathSearchResult> => {
    try {
      // Expand ~ to home directory
      let normalizedPath = searchPath
      if (normalizedPath.startsWith("~")) {
        normalizedPath = path.join(os.homedir(), normalizedPath.slice(1))
      }

      // Determine parent directory and prefix for filtering
      let dirToSearch: string
      let filterPrefix: string

      if (normalizedPath.endsWith(path.sep) || normalizedPath.endsWith("/")) {
        // User typed a complete directory path, list its contents
        dirToSearch = normalizedPath
        filterPrefix = ""
      } else {
        // User is typing a partial name, list parent and filter
        dirToSearch = path.dirname(normalizedPath)
        filterPrefix = path.basename(normalizedPath).toLowerCase()
      }

      // Check if directory exists
      if (!fs.existsSync(dirToSearch)) {
        return { entries: [], error: "Directory not found" }
      }

      const stat = fs.statSync(dirToSearch)
      if (!stat.isDirectory()) {
        return { entries: [], error: "Not a directory" }
      }

      // Read directory contents
      const items = fs.readdirSync(dirToSearch, { withFileTypes: true })

      // Filter and map entries
      const entries: PathEntry[] = items
        .filter(item => {
          // Hide dotfiles unless user is searching for them (filter starts with .)
          if (item.name.startsWith('.') && !filterPrefix.startsWith('.')) {
            return false
          }

          // Filter by prefix if provided
          if (filterPrefix) {
            return item.name.toLowerCase().startsWith(filterPrefix)
          }
          return true
        })
        .map(item => ({
          name: item.name,
          path: path.join(dirToSearch, item.name),
          isDir: item.isDirectory()
        }))
        // Sort: directories first, then by name
        .sort((a, b) => {
          if (a.isDir !== b.isDir) {
            return a.isDir ? -1 : 1
          }
          return a.name.localeCompare(b.name)
        })
        // Limit to 20 entries
        .slice(0, 20)

      return { entries }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error"
      return { entries: [], error: message }
    }
  })
}
