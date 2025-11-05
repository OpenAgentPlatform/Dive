import { app, BrowserWindow } from "electron"
import { exec } from "node:child_process"
import path from "node:path"
import fs from "fs-extra"
import { oapClient } from "./oap"
import { serviceStatus, setServiceUpCallback } from "./service"
import { createWindow } from "."

const DESKTOP_FILE_NAME = "oaphub-dive.desktop"
type DeepLinkType = "login" | "refresh" | "mcp.install" | "unknown"

function getDeepLinkTypeFromUrl(url: string): DeepLinkType {
  if (url.startsWith("dive://signin/")) {
    return "login"
  }

  if (url.includes("refresh")) {
    return "refresh"
  }

  if (url.includes("mcp.install")) {
    return "mcp.install"
  }

  return "unknown"
}

export async function refreshConfig() {
  const url = `http://${serviceStatus.ip}:${serviceStatus.port}`
  await fetch(`${url}/api/plugins/oap-platform/config/refresh`, { method: "POST" })
    .then((res) => res.json())
    .then((res) => console.log("refresh config", res))
}

export function setOAPTokenToHost(token: string) {
  const setHostToken = async (ip: string, port: number) => {
    const url = `http://${ip}:${port}`
    await fetch(`${url}/api/plugins/oap-platform/auth`, { method: "POST", body: JSON.stringify({ token }) })
      .then((res) => res.json())
      .then((res) => console.log("set token to host", res))
      .then(refreshConfig)
      .catch(console.error)

    oapClient.login(token)
  }

  if (serviceStatus.port) {
    setHostToken(serviceStatus.ip, serviceStatus.port)
  } else {
    setServiceUpCallback(setHostToken)
  }

  oapClient.login(token)
}

function handleLoginFromDeepLink(url: string) {
  const token = url.split("/").pop()
  if (!token) {
    console.error("No token found in deep link")
    return
  }

  console.info("login from deep link")
  setOAPTokenToHost(token)
}

export async function deeplinkHandler(win: BrowserWindow|null, url: string) {
  const allWindows = BrowserWindow.getAllWindows()
  if (!win && allWindows.length) {
    win = allWindows[0]
  }

  if (win) {
    win.show()
    win.focus()
  } else {
    await createWindow().catch(console.error)
  }

  switch (getDeepLinkTypeFromUrl(url)) {
    case "login":
      handleLoginFromDeepLink(url)
      break
    case "refresh":
      win?.webContents.send("refresh")
      refreshConfig().catch(console.error)
      break
    case "mcp.install":
      const deeplink = new URL(url)
      win?.webContents.send("mcp.install", {
        name: deeplink.searchParams.get("name") || "",
        config: deeplink.searchParams.get("config") || "",
      })
      break
    default:
      break
  }
}

export async function setupAppImageDeepLink(): Promise<void> {
  // Only run on Linux and when packaged as an AppImage
  if (process.platform !== "linux" || !process.env.APPIMAGE) {
    return
  }

  try {
    const appPath = app.getPath("exe")
    if (!appPath) {
      console.error("Could not determine App path.")
      return
    }

    const homeDir = app.getPath("home")
    const applicationsDir = path.join(homeDir, ".local", "share", "applications")
    const desktopFilePath = path.join(applicationsDir, DESKTOP_FILE_NAME)

    // Ensure the applications directory exists
    await fs.mkdir(applicationsDir, { recursive: true })

    // Content of the .desktop file
    // %U allows passing the URL to the application
    // NoDisplay=true hides it from the regular application menu
    const desktopFileContent = `[Desktop Entry]
Name=Dive
Exec=${escapePathForExec(appPath)} %U
Terminal=false
Type=Application
MimeType=x-scheme-handler/dive;
NoDisplay=true
`

    // Write the .desktop file (overwrite if exists)
    await fs.writeFile(desktopFilePath, desktopFileContent, "utf-8")
    console.info(`Created/Updated desktop file: ${desktopFilePath}`)

    // Update the desktop database
    // It"s important to update the database for the changes to take effect
    try {
      const { stdout, stderr } = exec(`update-desktop-database ${escapePathForExec(applicationsDir)}`)
      if (stderr) {
        console.warn(`update-desktop-database stderr: ${stderr}`)
      }
      console.info(`update-desktop-database stdout: ${stdout}`)
      console.info("Desktop database updated successfully.")
    } catch (updateError) {
      console.error("Failed to update desktop database:", updateError)
      // Continue even if update fails, as the file is still created.
    }
  } catch (error) {
    // Log the error but don"t prevent the app from starting
    console.error("Failed to setup AppImage deep link:", error)
  }
}

/**
 * Escapes a path for safe use within the Exec field of a .desktop file
 * and for shell commands. Handles spaces and potentially other special characters
 * by quoting.
 */
function escapePathForExec(filePath: string): string {
  // Simple quoting for paths with spaces.
  return `'${filePath.replace(/'/g, "'\\''")}'`
}
