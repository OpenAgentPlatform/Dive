import packageJson from "../../package.json"
import { ApiResponse, OAPModelDescriptionParam, MCPServerSearchParam, OAPUsage, OAPUser, OAPModelDescription } from "../../types/oap"
import { OAPMCPServer } from "../../types/oap"
import { serviceStatus } from "./service"
import { oapStore as store } from "./store"
import EventEmitter from "node:events"
import { OAP_ROOT_URL } from "../../shared/oap"
import WebSocket from "ws"
import { readFileSync, writeFileSync } from "node:fs"
import { existsSync } from "node:fs"
import { randomUUID } from "node:crypto"
import { appDir } from "./constant"
import path from "node:path"

export type WebsocketMessageType =
  "user.account.subscription.update" |
  "user.account.coupon.update" |
  "user.settings.mcps.updated"

export type WebsocketMessage = {
  type: WebsocketMessageType
  data: any
}

export const getToken = () => store.get("token") as string | undefined
export const setToken = (token: string) => store.set("token", token)

const CLIENT_ID = (() => {
  const clientIdPath = path.join(appDir, ".client")
  if (existsSync(clientIdPath)) {
    return readFileSync(clientIdPath, "utf-8")
  } else {
    const id = randomUUID().slice(0, 16)
    writeFileSync(clientIdPath, id)
    return id
  }
})()

class OAPClient {
  public loggedIn: boolean
  private eventEmitter = new EventEmitter()
  socket: WebSocket | null = null
  onReceiveWebSocketMessageCB: (message: WebsocketMessage) => void = () => {}

  constructor() {
    const token = getToken()
    this.loggedIn = !!token
    if (token) {
      this.openWebSocket(token)
    }
  }

  onReceiveWebSocketMessage(cb: (message: any) => void) {
    this.onReceiveWebSocketMessageCB = cb
  }

  registEvent(event: "login" | "logout", callback: () => void) {
    this.eventEmitter.on(event, callback)
  }

  openWebSocket(token: string) {
    try {
      if (this.socket) {
        this.closeWebSocket()
      }

      console.log(`wss://${OAP_ROOT_URL.split("://")[1]}/api/v1/socket`)
      this.socket = new WebSocket(`wss://${OAP_ROOT_URL.split("://")[1]}/api/v1/socket`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      this.socket.on("message", (message) => {
        this.onReceiveWebSocketMessageCB(JSON.parse(message.toString()) as WebsocketMessage)
      })

      this.socket.on("open", () => {
        console.log("oap socket connected")
      })

      this.socket.on("close", () => {
        console.log("oap socket closed")
      })

      this.socket.on("error", (error) => {
        console.error("oap socket error", error)
      })
    } catch (error) {
      console.error("openWebSocket", error)
    }
  }

  closeWebSocket() {
    try {
      if (this.socket) {
        this.socket.close()
        this.socket = null
      }
    } catch (error) {
      console.error("closeWebSocket", error)
    }
  }

  login(token: string) {
    setToken(token)
    this.loggedIn = true
    this.eventEmitter.emit("login")
    this.openWebSocket(token)
  }

  async logout() {
    const token = getToken()
    if (token) {
      await this.fetch("/api/v1/user/logout").catch(console.error)
    }

    setToken("")
    this.loggedIn = false
    this.eventEmitter.emit("logout")

    const url = `http://${serviceStatus.ip}:${serviceStatus.port}`
    fetch(`${url}/api/plugins/oap-platform/auth`, { method: "DELETE" })
      .then((res) => console.log("oap logout", res.status))

    this.closeWebSocket()
  }

  fetch<T>(url: string, options: RequestInit = {}) {
    const token = getToken()
    if (!token) {
      this.logout()
      throw new Error("not logged in")
    }

    return fetch(`${OAP_ROOT_URL}${url}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
        "User-Agent": `Dive Desktop(${CLIENT_ID})-${packageJson.version}`,
      },
    }).then((res) => res.text() as Promise<T>)
    .then(text => {
      try {
        return JSON.parse(text as string) as T
      } catch (_error) {
        return text as T
      }
    })
  }

  getMCPServers() {
    return this.fetch<ApiResponse<OAPMCPServer[]>>("/api/v1/user/mcp/configs")
  }

  searchMCPServer(params: MCPServerSearchParam) {
    const form = new FormData()
    Object.entries(params).forEach(([key, value]) => {
      form.append(key, `${value}`)
    })

    return this.fetch<ApiResponse<OAPMCPServer[]>>("/api/v1/user/mcp/search", {
      method: "POST",
      body: form,
    })
  }

  modelDescription(params?: OAPModelDescriptionParam) {
    if (params && params?.models.length > 0) {
      return this.fetch<ApiResponse<OAPModelDescription[]>>("/api/v1/llms/query", {
        method: "POST",
        body: JSON.stringify(params),
      })
    } else {
      return this.fetch<ApiResponse<OAPModelDescription[]>>("/api/v1/llms")
    }
  }

  applyMCPServer(ids: string[]) {
    return this.fetch<ApiResponse<OAPMCPServer>>("/api/v1/user/mcp/apply", {
      method: "POST",
      body: JSON.stringify(ids),
    })
  }

  getMe() {
    return this.fetch<ApiResponse<OAPUser>>("/api/v1/user/me")
  }

  getUsage() {
    return this.fetch<ApiResponse<OAPUsage>>("/api/v1/user/usage")
  }
}

export const oapClient = new OAPClient()