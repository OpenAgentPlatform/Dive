import { invoke } from "@tauri-apps/api/core"
import { isElectron } from "./env"
import { ApiResponse, MCPServerSearchParam, OAPMCPServer, OAPModelDescription, OAPModelDescriptionParam, OAPUsage, OAPUser } from "../../types/oap"
import { listenIPC } from "."

export function setHost(host: string) {
    if (isElectron) {
        return
    }

    return invoke("set_host", { host })
}

export function openOapLoginPage(regist: boolean) {
    if (isElectron) {
        return window.ipcRenderer.oapLogin(regist)
    }

    return invoke("open_oap_login_page", { regist })
}

export function oapLogout() {
    if (isElectron) {
        return window.ipcRenderer.oapLogout()
    }

    return invoke("oap_logout")
}

export function oapGetToken(): Promise<string> {
    if (isElectron) {
        return window.ipcRenderer.oapGetToken()
    }

    return invoke("oap_get_token")
}

export function oapGetMe(): Promise<ApiResponse<OAPUser>> {
    if (isElectron) {
        return window.ipcRenderer.oapGetMe()
    }

    return invoke("oap_get_me")
}

export function oapGetUsage(): Promise<ApiResponse<OAPUsage>> {
    if (isElectron) {
        return window.ipcRenderer.oapGetUsage()
    }

    return invoke("oap_get_usage")
}

export function oapSearchMCPServer(params: MCPServerSearchParam): Promise<ApiResponse<OAPMCPServer[]>> {
    if (isElectron) {
        return window.ipcRenderer.oapSearchMCPServer(params)
    }

    return invoke("oap_search_mcp_server", { params })
}

export function oapApplyMCPServer(ids: string[]): Promise<void> {
    if (isElectron) {
        return window.ipcRenderer.oapApplyMCPServer(ids)
    }

    return invoke("oap_apply_mcp_server", { ids })
}

export function oapGetMCPServers(): Promise<ApiResponse<OAPMCPServer[]>> {
    if (isElectron) {
        return window.ipcRenderer.oapGetMCPServers()
    }

    return invoke("oap_get_mcp_servers")
}

type BackendEvent = "login" | "logout" | "refresh" | "mcp.install"
export function registBackendEvent(event: BackendEvent, callback: (...args: any[]) => void) {
    if (isElectron) {
        switch (event) {
            case "login":
                return window.ipcRenderer.oapRegistEvent("login", callback)
            case "logout":
                return window.ipcRenderer.oapRegistEvent("logout", callback)
            case "refresh":
                return window.ipcRenderer.listenRefresh(callback)
            case "mcp.install":
                return window.ipcRenderer.listenMcpApply(callback)
        }
    }

    const listener = (data: any) => callback(data.payload)
    switch (event) {
        case "login":
        case "logout":
        case "refresh":
            return listenIPC(`oap:${event}`, listener)
        case "mcp.install":
            return listenIPC("mcp:install", listener)
    }
}

export function oapModelDescription(params: OAPModelDescriptionParam): Promise<ApiResponse<OAPModelDescription[]>> {
    if (isElectron) {
        return window.ipcRenderer.oapModelDescription(params)
    }

    return invoke("oap_get_model_description", { params })
}