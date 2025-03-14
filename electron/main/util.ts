import net from "node:net"
import path from "node:path"
import { spawn } from "cross-spawn"
import { app } from "electron"
import fse from "fs-extra"

export function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()
      .once("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          resolve(true)
        }
      })
      .once("listening", () => {
        server.close()
        resolve(false)
      })
      .listen(port)
  })
}

export function npmInstall(targetPath: string, args?: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const npm = process.platform === "win32"
      ? (app.isPackaged ? path.join(process.resourcesPath, "node", "npm.cmd") : "npm.cmd")
      : "npm"

    const installation = spawn(npm, args || ["install"], {
      cwd: targetPath,
      stdio: "inherit",
      shell: process.platform === "darwin",
      windowsHide: true,
      windowsVerbatimArguments: true
    })

    installation.on("close", (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`npm install failed with code: ${code}`))
      }
    })

    installation.on("error", (err) => {
      reject(err)
    })
  })
}

export function modifyPath(customBinPath: string) {
  const connector = process.platform === "win32" ? ";" : ":"
  process.env.PATH = `${customBinPath}${connector}${process.env.PATH}`
}

export function setNodePath() {
  process.env.NODE_PATH = path.join(process.resourcesPath, "node", "node_modules")
}

export function getNvmPath(): string {
  const home = process.env.HOME
  if (!home) return ""

  const nvmPath = path.join(home, ".nvm", "versions", "node")

  try {
    if (fse.existsSync(nvmPath)) {
      const currentVersion = fse.readdirSync(nvmPath)
        .filter(dir => dir.startsWith("v"))
        .sort()
        .pop()

      if (currentVersion) {
        return path.join(nvmPath, currentVersion, "bin")
      }
    }
  } catch (error) {
    console.error("Error getting NVM path:", error)
  }

  return ""
}

export function getLatestVersion(): Promise<string> {
  return fetch("https://api.github.com/repos/OpenAgentPlatform/Dive/releases/latest")
    .then(res => res.json())
    .then(data => data.tag_name.slice(1))
}

export function compareFiles(filePath1: string, filePath2: string): boolean {
  try {
    const stat1 = fse.statSync(filePath1)
    const stat2 = fse.statSync(filePath2)

    // Compare size
    if (stat1.size !== stat2.size) {
      return false
    }

    // Compare modification time
    if (stat1.mtimeMs !== stat2.mtimeMs) {
      return false
    }

    // Files might be identical
    return true
  }
  catch (error) {
    console.error("Error comparing files:", error);
    return false
  }
}

export function compareFilesAndReplace(filePath1: string, filePath2: string) {
  if (fse.existsSync(filePath1) && !compareFiles(filePath1, filePath2) || !fse.existsSync(filePath2)) {
    fse.copyFileSync(filePath1, filePath2)
  }
}
