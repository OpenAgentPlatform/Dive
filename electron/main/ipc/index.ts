import { BrowserWindow } from "electron"
import { ipcEnvHandler } from "./env"
import { ipcSystemHandler } from "./system"
import { ipcUtilHandler } from "./util"
import { ipcLlmHandler } from "./llm"
import { ipcMenuHandler } from "./menu"
import { ipcOapHandler } from "./oap"
import { ipcLocalIPCHandler } from "./lipc"

export function ipcHandler(win: BrowserWindow) {
  ipcEnvHandler(win)
  ipcSystemHandler(win)
  ipcUtilHandler(win)
  ipcLlmHandler(win)
  ipcMenuHandler(win)
  ipcOapHandler(win)
  ipcLocalIPCHandler(win)
}
