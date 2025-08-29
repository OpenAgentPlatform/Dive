import { convertFileSrc, invoke } from "@tauri-apps/api/core"
import { isElectron } from "./env"
import { openUrl as tauriOpenUrl } from "@tauri-apps/plugin-opener"

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