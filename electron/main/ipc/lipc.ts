import { BrowserWindow, ipcMain } from "electron"
// import core from "core-js"

export function ipcLocalIPCHandler(_win: BrowserWindow) {
  ipcMain.handle("lipc:elicitation", async (_, _action: number, _content: any) => {
    // core.responseElicitation(action, content)
  })
}

