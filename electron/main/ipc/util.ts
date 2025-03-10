import { ipcMain, BrowserWindow } from "electron"
import fse from "fs-extra"
import path from "node:path"
import { scriptsDir } from "../constant"

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
    } catch (error) {
      return _config
    }
  })
}
