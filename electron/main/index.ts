import { app, BrowserWindow, shell, ipcMain, protocol, net, Menu } from "electron"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import path from "node:path"
import os from "node:os"
import { update } from "./update"
import { binDirList, cleanup, initMCPClient, port, scriptsDir } from "./service"
import Anthropic from "@anthropic-ai/sdk"
import fse from "fs-extra"
import OpenAI from "openai"
import { Ollama } from "ollama"
import { getNvmPath, modifyPath } from "./util"

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

protocol.registerSchemesAsPrivileged([
  {
    scheme: "local-file",
    privileges: {
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true,
    }
  }
])

const selectionMenu = Menu.buildFromTemplate([
  { role: "copy" },
  { role: "selectAll" }
])

const inputMenu = Menu.buildFromTemplate([
  { role: "copy" },
  { role: "paste" },
  { role: "cut" },
  { role: "selectAll" }
])

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs   > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.APP_ROOT = path.join(__dirname, "../..")

export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron")
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist")
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST

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
    // modifyPath(path.join(process.resourcesPath, `bin/node/bin`))
    // modifyPath(path.join(process.resourcesPath, `bin/uv`))

    modifyPath("/opt/homebrew/bin")
    modifyPath("/usr/local/bin")
    modifyPath("/usr/bin")

    const nvmPath = getNvmPath()
    if (nvmPath) {
      modifyPath(nvmPath)
    }
  }

  protocol.handle("local-file", (req) => {
    const url = req.url.replace("local-file:///", process.platform === "win32" ? "file:///" : "file://")
    return net.fetch(url)
  })

  initMCPClient()
  createWindow()
}

async function createWindow() {
  win = new BrowserWindow({
    title: "Dive AI",
    icon: path.join(process.env.VITE_PUBLIC, "favicon.ico"),
    webPreferences: {
      preload,
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // nodeIntegration: true,

      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      // contextIsolation: false,
    },
  })

  // resolve cors
  win.webContents.session.webRequest.onBeforeSendHeaders(
    (details, callback) => {
      callback({ requestHeaders: { ...details.requestHeaders, Origin: '*' } });
    },
  );

  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Access-Control-Allow-Origin': ['*'],
        'Access-Control-Allow-Credentials': ['true'],
        'Access-Control-Allow-Methods': ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        'Access-Control-Allow-Headers': ['Content-Type', 'Authorization'],
      },
    });
  });

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

  // Auto update
  update(win)
}

app.whenReady().then(onReady)

app.on("window-all-closed", async () => {
  win = null
  if (process.platform !== "darwin") {
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

app.on("activate", () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
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

ipcMain.handle("api:port", async () => {
  return port
})

ipcMain.handle("api:getResources", async (_, p: string) => {
  return app.isPackaged ? path.join(process.resourcesPath, p) : p
})

ipcMain.handle("fs:openScriptsDir", async () => {
  shell.openPath(scriptsDir)
})

ipcMain.handle("api:fillPathToConfig", async (_, _config: string) => {
  try {
    const { mcpServers: servers } = JSON.parse(_config) as {mcpServers: Record<string, {enabled: boolean, command: string, args: string[]}>}
    const mcpServers = Object.keys(servers).reduce((acc, server) => {
      const { args } = servers[server]
      const pathToScript = args.find((arg) => arg.endsWith("js") || arg.endsWith("ts"))
      if (!pathToScript)
        return acc

      const isScriptsExist = fse.existsSync(pathToScript)
      if (isScriptsExist)
        return acc

      const argsIndex = args.reduce((acc, arg, index) => pathToScript === arg ? index : acc, -1)
      if (fse.existsSync(path.join(scriptsDir, pathToScript))) {
        args[argsIndex] = path.join(scriptsDir, pathToScript)
      }

      const filename = path.parse(pathToScript).base
      if (fse.existsSync(path.join(scriptsDir, filename))) {
        args[argsIndex] = path.join(scriptsDir, filename)
      }

      acc[server] = {
        ...servers[server],
        args,
      }

      return acc
    }, servers)

    return JSON.stringify({ mcpServers })
  } catch (error) {
    return _config
  }
})

ipcMain.handle("api:openaiModelList", async (_, apiKey: string) => {
  try {
    const client = new OpenAI({ apiKey })
    const models = await client.models.list()
    return models.data.map((model) => model.id)
  } catch (error) {
    return []
  }
})

ipcMain.handle("api:anthropicModelList", async (_, apiKey: string, baseURL: string) => {
  try {
    const client = new Anthropic({ apiKey, baseURL })
    const models = await client.models.list()
    return models.data.map((model) => model.id)
  } catch (error) {
    return []
  }
})

ipcMain.handle("api:ollamaModelList", async (_, baseURL: string) => {
  try {
    const ollama = new Ollama({ host: baseURL })
    const list = await ollama.list()
    return list.models.map((model) => model.name)
  } catch (error) {
    return []
  }
})

ipcMain.handle("api:openaiCompatibleModelList", async (_, apiKey: string, baseURL: string) => {
  try {
    const client = new OpenAI({ apiKey, baseURL })
    const list = await client.models.list()
    return list.data.map((model) => model.id)
  } catch (error) {
    return []
  }
})

ipcMain.handle("show-selection-context-menu", () => {
  selectionMenu.popup()
})

ipcMain.handle("show-input-context-menu", () => {
  inputMenu.popup()
})