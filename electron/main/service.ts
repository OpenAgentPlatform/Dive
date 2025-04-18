import { app, BrowserWindow } from "electron"
import path from "node:path"
import fse from "fs-extra"
import { compareFilesAndReplace, npmInstall } from "./util.js"
import {
  scriptsDir,
  configDir,
  DEF_MCP_SERVER_CONFIG,
  cwd,
  DEF_MODEL_CONFIG,
  DEF_DIVE_HTTPD_CONFIG,
  hostCacheDir,
  __dirname,
  legacyConfigDir,
  envPath,
  VITE_DEV_SERVER_URL,
} from "./constant.js"
import spawn from "cross-spawn"
import { ChildProcess, SpawnOptions } from "node:child_process"
import { EventEmitter } from "node:events"
import { Writable } from "node:stream"

const baseConfigDir = app.isPackaged ? configDir : path.join(__dirname, "..", "..", ".config")

export const serviceStatus = {
  port: 0,
}

let hostProcess: ChildProcess | null = null
const ipcEventEmitter = new EventEmitter()

async function initApp() {
  // create dirs
  await fse.mkdir(baseConfigDir, { recursive: true })

  await migratePrebuiltScripts().catch(console.error)
  await migrateLegacyConfig().catch(console.error)

  // create config file if not exists
  const mcpServerConfigPath = path.join(baseConfigDir, "mcp_config.json")
  await createFileIfNotExists(mcpServerConfigPath, JSON.stringify(DEF_MCP_SERVER_CONFIG, null, 2))

  // create custom rules file if not exists
  const customRulesPath = path.join(baseConfigDir, "customrules")
  await createFileIfNotExists(customRulesPath, "")

  // create model config file if not exists
  const modelConfigPath = path.join(baseConfigDir, "model_config.json")
  await createFileIfNotExists(modelConfigPath, JSON.stringify(DEF_MODEL_CONFIG, null, 2))

  // create dive_httpd config file if not exists
  const diveHttpdConfigPath = path.join(baseConfigDir, "dive_httpd.json")
  await createFileIfNotExists(diveHttpdConfigPath, JSON.stringify(DEF_DIVE_HTTPD_CONFIG, null, 2))

  // create command alias file if not exists
  const commandAliasPath = path.join(baseConfigDir, "command_alias.json")
  await createFileIfNotExists(commandAliasPath, JSON.stringify(process.platform === "win32" && app.isPackaged ? {
    "npx": path.join(process.resourcesPath, "node", "npx.cmd"),
    "npm": path.join(process.resourcesPath, "node", "npm.cmd"),
  } : {}, null, 2))
}

async function createFileIfNotExists(_path: string, content: string) {
  if (!(await fse.pathExists(_path))) {
    console.log("creating file", _path)
    await fse.ensureDir(path.dirname(_path))
    await fse.writeFile(_path, content)
  }
}

export async function initMCPClient(win: BrowserWindow) {
  const handler = (message: any) => {
    if (message.server.listen.port) {
      serviceStatus.port = message.server.listen.port
      win.webContents.send("app-port", message.server.listen.port)
      ipcEventEmitter.off("ipc", handler)
    }
  }
  ipcEventEmitter.on("ipc", handler)

  await initApp()
  await startHostService()
}

export async function cleanup() {
  console.log("cleanup")
  if (hostProcess) {
    console.log("killing host process")
    hostProcess.kill("SIGTERM")
    setTimeout(() => {
      console.log("killing host process again")
      hostProcess?.kill("SIGKILL")
    }, 3000)
  }

  // reset bus
  await fse.writeFile(path.join(hostCacheDir, "bus"), "")
}

async function migrateLegacyConfig() {
  const files = [
    "config.json",
    "model.json",
    ".customrules",
  ]

  const newFiles = [
    "mcp_config.json",
    "model_config.json",
    "customrules",
  ]

  for (let i = 0; i < files.length; i++) {
    const filePath = path.join(legacyConfigDir, files[i])
    const newFilePath = path.join(configDir, newFiles[i])
    if (await fse.pathExists(filePath) && !(await fse.pathExists(newFilePath))) {
      console.log("copying legacy config", filePath, newFilePath)
      await fse.copy(filePath, newFilePath)
    }
  }

  const modelConfigPath = path.join(configDir, "model_config.json")
  const modelConfig = await fse.readJSON(modelConfigPath)
  if (!modelConfig.enableTools && modelConfig.enable_tools) {
    modelConfig.enableTools = modelConfig.enable_tools
    delete modelConfig.enable_tools
  }

  modelConfig.configs = Object.keys(modelConfig.configs).reduce((acc, key) => {
    const config = modelConfig.configs[key]
    if (config.modelProvider === "openai" && !config.apiKey) {
      config.apiKey = ""
    }

    if ("baseURL" in config && !config.baseURL) {
      delete config.baseURL
    }

    if (config.configuration && "baseURL" in config.configuration && !config.configuration.baseURL) {
      delete config.configuration.baseURL
    }

    acc[key] = config
    return acc
  }, {} as any)

  await fse.writeJSON(modelConfigPath, modelConfig)
}

async function migratePrebuiltScripts() {
  console.log("migrating prebuilt scripts")

  // copy scripts
  const rebuiltScriptsPath = path.join(app.isPackaged ? process.resourcesPath : process.cwd(), "prebuilt/scripts")
  if(!(await fse.pathExists(scriptsDir))) {
    await fse.mkdir(scriptsDir, { recursive: true })
    await fse.copy(rebuiltScriptsPath, scriptsDir)
  }

  // update prebuilt scripts
  compareFilesAndReplace(path.join(rebuiltScriptsPath, "echo.js"), path.join(scriptsDir, "echo.js"))

  // install dependencies for prebuilt scripts
  await npmInstall(scriptsDir).catch(console.error)
  await npmInstall(scriptsDir, ["install", "express", "cors"]).catch(console.error)

  // remove echo.cjs
  if (await fse.pathExists(path.join(scriptsDir, "echo.cjs"))) {
    await fse.unlink(path.join(scriptsDir, "echo.cjs"))
  }
}

async function startHostService() {
  const isWindows = process.platform === "win32"
  const resourcePath = app.isPackaged ? process.resourcesPath : cwd
  const pyBinPath = path.join(resourcePath, "python", "bin")
  const pyPath = isWindows ? path.join(resourcePath, "python", "python.exe") : path.join(pyBinPath, "python3")

  const httpdExec = app.isPackaged ? pyPath : "uv"
  const httpdParam = app.isPackaged
      ? ["-I", path.join(pyBinPath, "dive_httpd")]
      : ["run", "dive_httpd"]

  const httpdEnv = {
    ...process.env,
    DIVE_CONFIG_DIR: baseConfigDir,
    RESOURCE_DIR: hostCacheDir,
  }

  console.log("httpd executing path: ", httpdExec)

  const busPath = path.join(hostCacheDir, "bus")
  await createFileIfNotExists(busPath, "")
  if (process.platform !== "win32") {
    await fse.chmod(busPath, 0o666)
  }

  fse.watch(busPath, async (eventType, filename) => {
    if (!filename)
      return

    if (eventType !== "change")
      return

    const buffer = Buffer.alloc(1024 * 32)
    await fse.read(await fse.open(busPath, "r"), buffer, 0, buffer.length, 0)

    if (!buffer.length)
      return

    try {
      const content = buffer.toString().trim().replace(/\0/g, "")
      if (!content)
        return

      const message = JSON.parse(content)
      if (message) {
        ipcEventEmitter.emit("ipc", message)
        console.log("received message from host service", message)
      }
    } catch (error) {
      console.error("Failed to parse bus content:", buffer.toString().trim(), error)
    }
  })

  const spawnParam = [
    ...httpdParam,
    "--port",
    "0",
    "--report_status_file",
    busPath,
    "--cors",
    "*",
    "--log_dir",
    path.join(envPath.log, "host"),
    "--log_level",
    "DEBUG",
  ]

  const options: SpawnOptions = {
    env: httpdEnv,
    stdio: VITE_DEV_SERVER_URL ? "inherit" : "pipe",
  }

  if (VITE_DEV_SERVER_URL) {
    options.cwd = path.join(__dirname, "..", "..", "mcp-host")
  }

  console.log("spawn host with", httpdExec, spawnParam.join(" "))
  hostProcess = spawn(httpdExec, spawnParam, options)

  if (app.isPackaged) {
    hostProcess?.stdout?.pipe(new Writable({
      write(chunk, encoding, callback) {
        console.log("[dived]", chunk.toString())
        callback()
      }
    }))

    hostProcess?.stderr?.pipe(new Writable({
      write(chunk, encoding, callback) {
        const str = chunk.toString()
        if (str.startsWith("INFO") || str.startsWith("DEBUG")) {
          console.log("[dived]", str)
        } else if (str.startsWith("WARNING")) {
          console.warn("[dived]", str)
        } else {
          console.error("[dived]", str)
        }
        callback()
      }
    }))
  }

  hostProcess!.on("error", (error) => {
    console.error("Failed to start host process:", error)
  })

  hostProcess!.on("close", (code) => {
    console.log(`host process exited with code ${code}`)
  })

  hostProcess!.on("spawn", () => {
    console.log("host process spawned")
  })
}
