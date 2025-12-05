import { convertFileSrc, invoke } from "@tauri-apps/api/core"
import { isElectron, isTauri } from "./env"
import { openUrl as tauriOpenUrl } from "@tauri-apps/plugin-opener"
import { save } from "@tauri-apps/plugin-dialog"
import { readFile } from "@tauri-apps/plugin-fs"
import { basename } from "@tauri-apps/api/path"

export function copyBlobImage(img: HTMLImageElement) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error("Failed to get blob from image"))
    }, 5000)

    try {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")

      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight

      ctx?.drawImage(img, 0, 0)
      canvas.toBlob(async b => {
        if (!b) {
          reject(new Error("Failed to convert canvas to blob"))
          return
        }

        const buf = new Uint8Array(await b.arrayBuffer())
        if (isElectron) {
          resolve(window.ipcRenderer.copyImage(buf))
        } else {
          resolve(invoke("copy_image", { data: buf }))
        }
      })
    } catch (error) {
      reject(error)
    }
  })
}

export function copyImage(src: string) {
  if (isElectron) {
    return window.ipcRenderer.copyImage(src)
  } else {
    return invoke("copy_image", { src })
  }
}

export function convertLocalFileSrc(src: string) {
  if (isElectron) {
    return `local-file:///${src}`
  } else {
    return convertFileSrc(src)
  }
}

export function openUrl(url: string) {
  if (isElectron) {
    window.open(url, "_blank")
  } else {
    tauriOpenUrl(url)
  }
}

export function getClientInfo(): Promise<{ version: string, client_id: string }> {
  if (isElectron) {
    return window.ipcRenderer.getClientInfo()
  } else {
    return invoke("get_client_info")
  }
}

export function checkCommandExist(command: string): Promise<boolean> {
  if (isElectron) {
    return window.ipcRenderer.checkCommandExist(command)
  } else {
    return invoke("check_command_exist", { command })
  }
}

export async function downloadFile(src: string) {
  if (isTauri) {
    let filename = src.split("/").pop() ?? "file"
    if (filename.includes("?")) {
      filename = filename.split("?")[0]
    }

    const savePath = await save({ title: filename })
    if (savePath) {
      return invoke("download_file", { src, dst: savePath })
    }

    return Promise.reject(new Error("User canceled save dialog"))
  }

  return window.ipcRenderer.download(src)
}

export async function readLocalFile(filePath: string): Promise<File> {
  if (isElectron) {
    const { data, name, mimeType } = await window.ipcRenderer.readLocalFile(filePath)
    return new File([data], name, { type: mimeType })
  } else if (isTauri) {
    const data = await readFile(filePath)
    const fileName = await basename(filePath)
    const mimeType = await invoke<string>("get_mime_type", { path: filePath })
    return new File([data], fileName, { type: mimeType })
  }

  throw new Error("readLocalFile is only supported in Electron or Tauri")
}
