/// <reference types="vite/client" />

type ModelResults = {
  error?: string
  results: string[]
}

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
    showSelectionContextMenu: () => Promise<void>
    showInputContextMenu: () => Promise<void>
    getHotkeyMap: () => Promise<Record<string, any>>
    getPlatform: () => Promise<string>
    getAutoLaunch: () => Promise<boolean>
    setAutoLaunch: (enable: boolean) => Promise<void>
    getMinimalToTray: () => Promise<boolean>
    setMinimalToTray: (enable: boolean) => Promise<void>
  }

  PLATFORM: "darwin" | "win32" | "linux"
}
