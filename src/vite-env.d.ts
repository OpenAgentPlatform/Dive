/// <reference types="vite/client" />

import type { MCPServerSearchParam, OAPMCPServer, OAPUser, ApiResponse, OAPModelDescription, OAPModelDescriptionParam } from "../types/oap"
import type { ModelGroupSetting } from "../types/model"

type ModelResults = {
  error?: string
  results: string[]
}

declare global {
  interface Window {
    // expose in the `electron/preload/index.ts`
    ipcRenderer: import("electron").IpcRenderer & {
      port: () => Promise<number>
      getResourcesPath: (p: string) => Promise<string>
      openScriptsDir: () => Promise<void>
      fillPathToConfig: (config: string) => Promise<string>
      openaiModelList: (apiKey: string) => Promise<ModelResults>
      openaiCompatibleModelList: (apiKey: string, baseURL: string) => Promise<ModelResults>
      anthropicModelList: (apiKey: string, baseURL: string) => Promise<ModelResults>
      ollamaModelList: (baseURL: string) => Promise<ModelResults>
      googleGenaiModelList: (apiKey: string) => Promise<ModelResults>
      mistralaiModelList: (apiKey: string) => Promise<ModelResults>
      bedrockModelList: (accessKeyId: string, secretAccessKey: string, sessionToken: string, region: string) => Promise<ModelResults>
      azureOpenaiModelList: (apiKey: string, azureEndpoint: string, azureDeployment: string, apiVersion: string) => Promise<ModelResults>
      showSelectionContextMenu: () => Promise<void>
      showInputContextMenu: () => Promise<void>
      getHotkeyMap: () => Promise<Record<string, any>>
      getPlatform: () => Promise<string>
      getAutoLaunch: () => Promise<boolean>
      setAutoLaunch: (enable: boolean) => Promise<void>
      getMinimalToTray: () => Promise<boolean>
      setMinimalToTray: (enable: boolean) => Promise<void>
      onReceivePort: (callback: (port: number) => void) => void
      download: (url: string) => Promise<void>
      copyImage: (url: string|Uint8Array) => Promise<void>
      oapLogin: (regist?: boolean) => Promise<void>
      oapLogout: () => Promise<void>
      oapGetToken: () => Promise<string>
      oapSearchMCPServer: (params: MCPServerSearchParam) => Promise<ApiResponse<OAPMCPServer[]>>
      oapModelDescription: (params?: OAPModelDescriptionParam) => Promise<ApiResponse<OAPModelDescription[]>>
      oapApplyMCPServer: (ids: string[]) => Promise<void>
      oapGetMCPServers: () => Promise<ApiResponse<OAPMCPServer[]>>
      oapGetMe: () => Promise<ApiResponse<OAPUser>>
      oapRegistEvent: (event: "login" | "logout", callback: () => void) => () => void
      oapGetUsage: () => Promise<OAPUsage>
      getModelSettings: () => Promise<ModelGroupSetting>
      setModelSettings: (settings: ModelGroupSetting) => Promise<void>
      listenRefresh: (cb: () => void) => () => void
      listenMcpApply: (cb: (id: string) => void) => () => void
      refreshConfig: () => Promise<void>
      onReceiveInstallHostDependenciesLog: (callback: (data: string) => void) => () => void
      getInstallHostDependenciesLog: () => Promise<string[]>
    }

    PLATFORM: "darwin" | "win32" | "linux"
    isDev: boolean

    __TAURI_INTERNALS__: object
    __TAURI_METADATA__: {
      app: object
    }
  }
}
