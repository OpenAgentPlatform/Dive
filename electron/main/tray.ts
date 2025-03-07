import { app, BrowserWindow, Menu, MenuItemConstructorOptions, Tray } from "electron"
import path from "node:path"
import AppState from "./state"

let tray: Tray | null = null

export function initTray(win: BrowserWindow) {
  const iconPath = process.platform === "win32"
    ? path.join(process.env.VITE_PUBLIC, "icon.ico")
    : path.join(process.env.VITE_PUBLIC, "icon.png")

  tray = new Tray(iconPath)
  tray.setToolTip(app.getName())

  updateTrayMenu(win)

  tray.on("click", () => {
    win.show()
  })
}

function updateTrayMenu(win: BrowserWindow) {
  const menuTemplate: MenuItemConstructorOptions[] = [
    {
      label: "Open",
      click: () => {
        win.show()
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        AppState.setIsQuitting(true)
        app.quit()
      },
    },
  ]

  const contextMenu = Menu.buildFromTemplate(menuTemplate)
  tray?.setContextMenu(contextMenu)
}