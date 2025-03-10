import { BrowserWindow } from "electron"
import { ipcEnvHandler } from "./env"
import { ipcSystemHandler } from "./system"
import { ipcUtilHandler } from "./util"
import { ipcLlmHandler } from "./llm"
import { ipcMenuHandler } from "./menu"

export function ipcHandler(win: BrowserWindow) {
  ipcEnvHandler(win)
  ipcSystemHandler(win)
  ipcUtilHandler(win)
  ipcLlmHandler(win)
  ipcMenuHandler(win)
}