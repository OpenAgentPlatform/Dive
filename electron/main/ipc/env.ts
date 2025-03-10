import { app, ipcMain, BrowserWindow } from "electron"
import config from "../../config"
import { port } from "../service"
import path from "node:path"

export function ipcEnvHandler(win: BrowserWindow) {
  ipcMain.handle("env:getHotkeyMap", async () => {
    return config.keymap
  })

  ipcMain.handle("env:getPlatform", async () => {
    return process.platform
  })

  ipcMain.handle("env:port", async () => {
    return port
  })

  ipcMain.handle("env:getResourcesPath", async (_, p: string) => {
    return app.isPackaged ? path.join(process.resourcesPath, p) : p
  })
}

