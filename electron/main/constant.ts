import { app } from "electron"
import envPaths from "env-paths"
import os from "os"
import path from "path"
import { fileURLToPath } from "url"

export const __dirname = path.dirname(fileURLToPath(import.meta.url))

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

export const envPath = envPaths(app.getName(), {suffix: ""})
export const legacyConfigDir = envPath.config
export const cacheDir = envPath.cache
export const homeDir = os.homedir()
export const appDir = path.join(homeDir, ".dive")
export const scriptsDir = path.join(appDir, "scripts")
export const configDir = path.join(appDir, "config")
export const hostCacheDir = path.join(appDir, "host_cache")

export const binDirList = [
  path.join(process.resourcesPath, "node"),
  path.join(process.resourcesPath, "uv"),
  path.join(process.resourcesPath, "python", "bin"),
]

export const darwinPathList = [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin",
]

export const DEF_MCP_SERVER_CONFIG = {
  "mcpServers": {
    "echo": {
      "enabled": true,
      "command": "node",
      "args": [
        path.join(scriptsDir, "echo.js")
      ]
    },
  }
}

export const DEF_MODEL_CONFIG = {
  "activeProvider": "none",
  "configs": {},
  "enableTools": true
}

const dbPath = path.join(configDir, "db.sqlite")
export const DEF_DIVE_HTTPD_CONFIG = {
  "db": {
    "uri": `sqlite:///${dbPath}`,
    "pool_size": 5,
    "pool_recycle": 60,
    "max_overflow": 10,
    "echo": false,
    "pool_pre_ping": true,
    "migrate": true
  },
  "checkpointer": {
    "uri": `sqlite:///${dbPath}`
  }
}

export const cwd = app.isPackaged ? path.join(__dirname, "../..") : process.cwd()