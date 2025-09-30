import { convertFileSrc, invoke } from "@tauri-apps/api/core"
import { isElectron } from "./env"
import { openUrl as tauriOpenUrl } from "@tauri-apps/plugin-opener"

export function copyBlobImage(img: HTMLImageElement) {
  if (isElectron){
    return copyImage(img.src)
  }

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

        resolve(invoke("copy_image", { data: await b.bytes() }))
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