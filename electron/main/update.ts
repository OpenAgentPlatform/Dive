import { app, ipcMain } from "electron"
import { createRequire } from "node:module"
import type {
  ProgressInfo,
  UpdateDownloadedEvent,
  UpdateInfo,
} from "electron-updater"
import path from "node:path"
import { cwd } from "./constant"
import { CLIENT_ID } from "./oap"
import { OAP_ROOT_URL } from "../../shared/oap"

const { autoUpdater } = createRequire(import.meta.url)("electron-updater")

// Update server configuration
const PRIMARY_UPDATE_SERVER = `${OAP_ROOT_URL}/api/v1/version`
const FALLBACK_CONFIG = {
  provider: "github",
  owner: "OpenAgentPlatform",
  repo: "Dive"
}

// Auto update check configuration
const CHECK_INTERVAL = 60 * 60 * 1000 // 1 hour in milliseconds
const INITIAL_DELAY = 3 * 1000 // 3 seconds delay for first check

let useFallback = false

export function update(win: Electron.BrowserWindow) {

  // When set to false, the update download will be triggered through the API
  autoUpdater.autoDownload = false
  autoUpdater.disableWebInstaller = false
  autoUpdater.allowDowngrade = false

  if (process.env.DEBUG) {
    autoUpdater.updateConfigPath = path.join(cwd, "dev-app-update.yml")
  }

  // Setup automatic update checking
  if (app.isPackaged) {
    // First check after initial delay
    setTimeout(() => {
      performAutoUpdateCheck()
    }, INITIAL_DELAY)

    // Periodic checks every hour
    setInterval(() => {
      performAutoUpdateCheck()
    }, CHECK_INTERVAL)
  }

  async function performAutoUpdateCheck() {
    try {
      console.log("Performing automatic update check...")
      if (!useFallback) {
        await configurePrimaryServer()
      }
      await autoUpdater.checkForUpdatesAndNotify()
    } catch (error) {
      console.error("Auto update check failed:", error)
      // Silent failure for automatic checks
    }
  }

  // start check
  autoUpdater.on("checking-for-update", function () { })
  // update available
  autoUpdater.on("update-available", (arg: UpdateInfo) => {
    win.webContents.send("update-can-available", { update: true, version: app.getVersion(), newVersion: arg?.version })
  })
  // update not available
  autoUpdater.on("update-not-available", (arg: UpdateInfo) => {
    win.webContents.send("update-can-available", { update: false, version: app.getVersion(), newVersion: arg?.version })
  })

  // Checking for updates with fallback mechanism
  ipcMain.handle("check-update", async () => {
    if (!app.isPackaged) {
      const error = new Error("The update feature is only available after the package.")
      return { message: error.message, error }
    }

    try {
      // Try primary server first
      if (!useFallback) {
        await configurePrimaryServer()
      }

      return await autoUpdater.checkForUpdatesAndNotify()
    } catch (error) {
      console.error("Primary update server failed:", error)

      // If primary server fails and we haven't tried fallback yet
      if (!useFallback) {
        console.log("Switching to fallback update server (GitHub)")
        useFallback = true
        configureFallbackServer()

        try {
          // Try fallback server (GitHub)
          return await autoUpdater.checkForUpdatesAndNotify()
        } catch (fallbackError) {
          console.error("Fallback update server also failed:", fallbackError)
          return { message: "All update servers failed", error: fallbackError }
        }
      }

      return { message: "Network error", error }
    }
  })

  // Start downloading and feedback on progress
  ipcMain.handle("start-download", (event: Electron.IpcMainInvokeEvent) => {
    startDownload(
      (error, progressInfo) => {
        if (error) {
          // feedback download error message
          event.sender.send("update-error", { message: error.message, error })
        } else {
          // feedback update progress message
          event.sender.send("download-progress", progressInfo)
        }
      },
      () => {
        // feedback update downloaded message
        event.sender.send("update-downloaded")
      }
    )
  })

  // Install now
  ipcMain.handle("quit-and-install", () => {
    autoUpdater.quitAndInstall(false, true)
  })
}

function startDownload(
  callback: (error: Error | null, info: ProgressInfo | null) => void,
  complete: (event: UpdateDownloadedEvent) => void,
) {
  autoUpdater.on("download-progress", (info: ProgressInfo) => callback(null, info))
  autoUpdater.on("error", (error: Error) => callback(error, null))
  autoUpdater.on("update-downloaded", complete)
  autoUpdater.downloadUpdate()
}

// Configure primary update server (custom server)
async function configurePrimaryServer() {
  console.log("Configuring primary update server:", PRIMARY_UPDATE_SERVER)

  // Set custom request headers
  autoUpdater.requestHeaders = {
    "User-Agent": `DiveDesktop/${app.getVersion()}`,
    "X-Dive-Id": CLIENT_ID,
  }

  autoUpdater.setFeedURL({
    provider: "generic",
    url: PRIMARY_UPDATE_SERVER,
  })
}

// Configure fallback update server (GitHub releases)
function configureFallbackServer() {
  console.log("Configuring fallback update server: GitHub")
  autoUpdater.requestHeaders = {}
  autoUpdater.setFeedURL(FALLBACK_CONFIG)
}
