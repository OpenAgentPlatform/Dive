import { isElectron, isTauri } from "./env"
import { fetch as tauriFetch } from "@tauri-apps/plugin-http"
import { watch, readTextFile, exists } from "@tauri-apps/plugin-fs"
import * as path from "@tauri-apps/api/path"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { setHost } from "./oap"

async function waitHostBus(): Promise<number> {
  const home = await path.homeDir()
  const file = await path.join(home, ".dive", "host_cache", "bus")
  const read = async (file: string) => {
    const body = await readTextFile(file)
    if (!body) {
      return
    }

    const content = JSON.parse(body)
    if (content?.server?.listen?.port) {
      return content.server.listen.port
    }
  }

  if (await exists(file)) {
    const port = await read(file)
    if (port) {
      return port
    }
  }

  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      const port = await read(file)
      if (port) {
        unwatch.then(unwatch => unwatch())
        clearInterval(interval)
        resolve(port)
      }
    }, 5000)

    const unwatch = watch(
      file,
      async () => {
        const port = await read(file)
        if (port) {
          unwatch.then(unwatch => unwatch())
          clearInterval(interval)
          resolve(port)
        }
      },
      { delayMs: 100 }
    )
  })
}

async function getPort() {
  if (isElectron) {
    return new Promise<number>((resolve) => {
      window.ipcRenderer.onReceivePort((port) => {
        resolve(port)
      })

      const i = setInterval(() => {
      window.ipcRenderer.port().then(port => {
          if (+port) {
            resolve(port)
            clearInterval(i)
          }
        })
      }, 1000)
    })
  }

  return waitHostBus()
}

export async function initFetch() {
  const port = await getPort()
  console.log("host port", port)
  setHost(`http://localhost:${port}`)

  if (isElectron) {
    return initElectronFetch(+port)
  }

  if (isTauri) {
    return initTauriFetch(+port)
  }

  return globalThis.fetch
}

async function initElectronFetch(port: number) {
  const originalFetch = window.fetch
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    return originalFetch(`http://localhost:${port}${input}`, {
      ...init,
      headers: {
        ...init?.headers,
        "X-Requested-With": "dive-desktop",
      },
    })
  }
}

async function initTauriFetch(port: number) {
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    console.log(input, init)
    return tauriFetch(`http://localhost:${port}${input}`, {
      ...init,
      headers: {
        ...init?.headers,
        "X-Requested-With": "dive-desktop",
      },
    })
  }
}

export async function startReceiveDownloadDependencyLog() {
  if (isElectron) {
    return
  }

  return invoke("start_recv_download_dependency_log")
}

export async function onReceiveDownloadDependencyLog(callback: (log: string) => void): Promise<() => void> {
  if (isElectron) {
    return window.ipcRenderer.onReceiveInstallHostDependenciesLog(callback)
  }

  return listen<{ type: string; data: any }>("install-host-dependencies-log", (event) => {
    switch (event.payload.type) {
      case "output":
        callback(event.payload.data)
        break
      case "error":
        callback(event.payload.data)
        break
      case "progress":
        // ignore
        break
      case "finished":
        callback("finish")
        break
    }
  })
}
