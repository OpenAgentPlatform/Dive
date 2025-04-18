import { app, BrowserWindow, shell, ipcMain } from "electron"
import { createRequire } from "node:module"
import path from "node:path"
import os from "node:os"
import AppState from "./state"
import { cleanup, initMCPClient } from "./service"
import { getDarwinSystemPath, modifyPath } from "./util"
import { binDirList, darwinPathList, __dirname, envPath, VITE_DEV_SERVER_URL, RENDERER_DIST } from "./constant"
import { update } from "./update"
import { ipcHandler } from "./ipc"
import { initTray } from "./tray"
import { preferencesStore } from "./store"
import { initProtocol } from "./protocol"
import log from "electron-log/main"

log.initialize()
log.transports.file.resolvePathFn = () => path.join(envPath.log, "main.log")
Object.assign(console, log.functions)

const require = createRequire(import.meta.url)

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith("6.1"))
  app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === "win32")
  app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
const preload = path.join(__dirname, "../preload/index.mjs")
const indexHtml = path.join(RENDERER_DIST, "index.html")

async function onReady() {
  if (process.platform === "win32") {
    binDirList.forEach(modifyPath)
  } else if (process.platform === "darwin") {
    if (!process.env.PATH) {
      process.env.PATH = await getDarwinSystemPath().catch(() => "")
    }

    darwinPathList.forEach(modifyPath)
  }

  initProtocol()
  createWindow()
  initMCPClient(win!)
}

async function createWindow() {
  win = new BrowserWindow({
    title: "Dive AI",
    icon: path.join(process.env.VITE_PUBLIC, "favicon.ico"),
    width: 1280,
    height: 720,
    minHeight: 320,
    minWidth: 400,
    webPreferences: {
      preload,
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // nodeIntegration: true,

      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      // contextIsolation: false,
    },
  })

  if (VITE_DEV_SERVER_URL) { // #298
    win.loadURL(VITE_DEV_SERVER_URL)
    // Open devTool if the app is not packaged
    win.webContents.openDevTools()
  } else {
    win.setMenu(null)
    win.loadFile(indexHtml)
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString())
  })

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:"))
      shell.openExternal(url)

    return { action: "deny" }
  })

  win.on("close", (event) => {
    if (!AppState.isQuitting) {
      event.preventDefault()
      win?.hide()
      return false
    }

    return true
  })

  // Auto update
  update(win)

  // Tray
  const shouldminimalToTray = preferencesStore.get("minimalToTray")
  if (process.platform !== "darwin" && shouldminimalToTray) {
    initTray(win)
    AppState.setIsQuitting(false)
  }

  // ipc handler
  ipcHandler(win)

  const shouldAutoLaunch = preferencesStore.get("autoLaunch")
  app.setLoginItemSettings({
    openAtLogin: shouldAutoLaunch,
    openAsHidden: false
  })
}

app.whenReady().then(onReady)

app.on("window-all-closed", async () => {
  win = null

  if (process.platform !== "darwin" && AppState.isQuitting) {
    await cleanup()
    app.quit()
  }
})

app.on("second-instance", () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized())
      win.restore()

    win.focus()
  }
})

app.on("before-quit", () => {
  AppState.setIsQuitting(true)
})

app.on("activate", () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    if (win) {
      win.show()
    } else {
      createWindow()
    }
  }
})

// New window example arg: new windows url
ipcMain.handle("open-win", (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`)
  } else {
    childWindow.loadFile(indexHtml, { hash: arg })
  }
})
