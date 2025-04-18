import spawn from "cross-spawn"
import path from "path"
import { fileURLToPath } from "url"
import fse from "fs-extra"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const httpdScript = `# -*- coding: utf-8 -*-
import re
import sys
from dive_mcp_host.httpd._main import main
if __name__ == '__main__':
    sys.argv[0] = re.sub(r'(-script\\.pyw|\\.exe)?$', '', sys.argv[0])
    sys.exit(main())`

const PLATFORM = process.argv[2]
if (!PLATFORM) {
  throw new Error("Platform is required")
}

function promiseSpawn(command: string, args: string[], cwd: string) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" })
    child.on("close", resolve)
    child.on("error", e => {
      console.error(e)
      reject(e)
    })
  })
}

function pipInstall(hostPath: string, sitePackagesPath: string, pyExec: string, platform: string) {
  const pipParam = ["pip", "install", ".", "--target", sitePackagesPath, "--python", pyExec]

  if (platform === "darwin-x64" && process.arch === "arm64" && process.platform === "darwin") {
    const cmd = path.join(__dirname, "../bin/uv/darwin-x64/uv")
    return promiseSpawn("arch", ["-x86_64", ...[cmd, ...pipParam]], hostPath)
  }

  if (platform === "darwin-arm64" && process.arch === "x64" && process.platform === "darwin") {
    const cmd = path.join(__dirname, "../bin/uv/darwin-arm64/uv")
    return promiseSpawn("arch", ["-arm64", ...[cmd, ...pipParam]], hostPath)
  }

  return promiseSpawn("uv", pipParam, hostPath)
}

function installToPlatformPython(platform: string) {
  const hostPath = path.join(__dirname, `../mcp-host`)
  const pythonPath = path.join(__dirname, `../bin/python/${platform}`)
  const sitePackagesPath = path.join(pythonPath, platform.startsWith("win") ? "Lib/site-packages" : "lib/python3.12/site-packages")
  const pyExec = platform.startsWith("win") ? path.join(pythonPath, "python.exe") : path.join(pythonPath, "bin", "python3")

  return pipInstall(hostPath, sitePackagesPath, pyExec, platform).then(() => {
    fse.ensureFileSync(path.join(pythonPath, "bin", "dive_httpd"))
    fse.writeFileSync(path.join(pythonPath, "bin", "dive_httpd"), httpdScript)
  })
}

if (!PLATFORM.startsWith("darwin")) {
  await installToPlatformPython(PLATFORM)
} else {
  await installToPlatformPython("darwin-x64")
  await installToPlatformPython("darwin-arm64")
}
