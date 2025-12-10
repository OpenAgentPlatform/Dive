import { BrowserWindow, ipcMain, shell } from "electron"
import { getToken, oapClient } from "../oap"
import os from "node:os"
import { OAP_ROOT_URL } from "../../../shared/oap"

import type { OAPModelDescriptionParam, MCPServerSearchParam, OAPLimiterCheckParam } from "../../../types/oap"

const LOGIN_URL = `${OAP_ROOT_URL}/signin`
const REGISTER_URL = `${OAP_ROOT_URL}/signup`

export function ipcOapHandler(_win: BrowserWindow) {
  ipcMain.handle("oap:login", async (_, regist: boolean) => {
    const url = `${regist ? REGISTER_URL : LOGIN_URL}?client=dive&name=${os.hostname()}&system=${process.platform}`
    shell.openExternal(url)
  })

  ipcMain.handle("oap:logout", async () => {
    oapClient.logout()
  })

  ipcMain.handle("oap:getToken", async () => {
    return await getToken()
  })

  ipcMain.handle("oap:searchMCPServer", async (_, params: MCPServerSearchParam) => {
    return await oapClient.searchMCPServer(params)
  })

  ipcMain.handle("oap:modelDescription", async (_, params?: OAPModelDescriptionParam) => {
    return await oapClient.modelDescription(params)
  })

  ipcMain.handle("oap:applyMCPServer", async (_, ids: string[]) => {
    return await oapClient.applyMCPServer(ids)
  })

  ipcMain.handle("oap:getMCPServers", async () => {
    return await oapClient.getMCPServers()
  })

  ipcMain.handle("oap:getMe", async () => {
    return await oapClient.getMe()
  })

  ipcMain.handle("oap:getUsage", async () => {
    return await oapClient.getUsage()
  })

  ipcMain.handle("oap:limiterCheck", async (_, params: OAPLimiterCheckParam) => {
    return await oapClient.limiterCheck(params)
  })
}
