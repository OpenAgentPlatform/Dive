import { ipcMain, BrowserWindow, dialog, nativeImage, clipboard, app } from "electron"
import fse from "fs-extra"
import path from "node:path"
import { configDir, scriptsDir } from "../constant"
import { CancelError, download } from "electron-dl"
import { ModelGroupSetting } from "../../../types/model"
import { refreshConfig } from "../deeplink"
import { getInstallHostDependenciesLog } from "../service"
import { CLIENT_ID } from "../oap"
import mimeTypes from "mime-types"

export function ipcUtilHandler(win: BrowserWindow) {
  ipcMain.handle("util:fillPathToConfig", async (_, _config: string) => {
    try {
      const { mcpServers: servers } = JSON.parse(_config) as {mcpServers: Record<string, {enabled: boolean, command?: string, args?: string[]}>}
      const mcpServers = Object.keys(servers).reduce((acc, server) => {
        const { args } = servers[server]

        if (!args)
          return acc

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
    } catch (_error) {
      return _config
    }
  })

  ipcMain.handle("util:download", async (event, { url }) => {
    let filename = getFilenameFromUrl(url)
    await fetch(url, { method: "HEAD" })
      .then(response => {
        const contentDisposition = response.headers.get("content-disposition")
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="([^"]+)"/)
          if (filenameMatch) {
            filename = filenameMatch[1]
          }
        }
      })
      .catch(() => {
        console.error("Failed to get filename from url")
      })

    filename = filename || "file"
    const result = await dialog.showSaveDialog({
      properties: ["createDirectory", "showOverwriteConfirmation"],
      defaultPath: filename,
    })

    if (result.canceled) {
      return
    }

    try {
      await download(win, url, { directory: path.dirname(result.filePath), filename: path.basename(result.filePath) })
    } catch (error) {
      if (error instanceof CancelError) {
        console.info("item.cancel() was called")
      } else {
        console.error(error)
      }
    }
  })

  ipcMain.handle("util:copyimage", async (_, src: string|Uint8Array) => {
    const getImageFromRemote = async (url: string) => {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
      }

      const buffer = await response.arrayBuffer()
      const image = nativeImage.createFromBuffer(Buffer.from(buffer))
      if (image.isEmpty()) {
        throw new Error("Failed to create image from buffer")
      }

      return image
    }

    const localProtocol = "local-file:///"
    let image = null
    if (typeof src === "string") {
      image = src.startsWith(localProtocol)
        ? nativeImage.createFromPath(src.substring(localProtocol.length))
        : await getImageFromRemote(src)
    } else {
      image = nativeImage.createFromBuffer(Buffer.from(src))
    }

    if (image.isEmpty()) {
      throw new Error("Failed to create image from buffer")
    }

    clipboard.writeImage(image)
  })

  ipcMain.handle("util:getModelSettings", async (_) => {
    if (!fse.existsSync(path.join(configDir, "model_settings.json"))) {
      return null
    }

    return fse.readJson(path.join(configDir, "model_settings.json"))
  })

  ipcMain.handle("util:setModelSettings", async (_, settings: ModelGroupSetting) => {
    return fse.writeJson(path.join(configDir, "model_settings.json"), settings, { spaces: 2 })
  })

  ipcMain.handle("util:refreshConfig", async () => {
    return refreshConfig()
  })

  ipcMain.handle("util:getInstallHostDependenciesLog", async () => {
    return getInstallHostDependenciesLog()
  })

  ipcMain.handle("util:getClientInfo", async () => {
    return {
      version: app.getVersion(),
      client_id: CLIENT_ID,
    }
  })

  ipcMain.handle("util:readLocalFile", async (_, filePath: string) => {
    try {
      const buffer = await fse.readFile(filePath)
      return {
        data: buffer,
        name: path.basename(filePath),
        mimeType: mimeTypes.lookup(filePath) || "application/octet-stream",
      }
    } catch (error) {
      console.error("Failed to read local file:", filePath, error)
      throw error
    }
  })
}

function getFilenameFromUrl(url: string) {
  try {
    const _url = new URL(url)
    return _url.pathname.split("/").pop()
  } catch (_error) {
    return null
  }
}
