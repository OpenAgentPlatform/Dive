/// <reference types="vite/client" />

interface Window {
  // expose in the `electron/preload/index.ts`
  ipcRenderer: import("electron").IpcRenderer & {
    port: () => Promise<number>
    getResourcesPath: (p: string) => Promise<string>
    openScriptsDir: () => Promise<void>
    fillPathToConfig: (config: string) => Promise<string>
    openaiModelList: (apiKey: string) => Promise<string[]>
    openaiCompatibleModelList: (apiKey: string, baseURL: string) => Promise<string[]>
    anthropicModelList: (apiKey: string, baseURL: string) => Promise<string[]>
    ollamaModelList: (baseURL: string) => Promise<string[]>
    googleGenaiModelList: (apiKey: string) => Promise<string[]>
    mistralaiModelList: (apiKey: string) => Promise<string[]>
    bedrockModelList: (accessKeyId: string, secretAccessKey: string, sessionToken: string, region: string) => Promise<string[]>
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
