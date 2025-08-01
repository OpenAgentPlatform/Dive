import { getAutoDownload } from "../updater"
import { ProgressInfo } from "electron-updater"
import { useCallback, useEffect, useState } from "react"
import { newVersionAtom } from "../atoms/globalState"
import { useAtomValue } from "jotai"
import { isElectron, listenIPC } from "../ipc"
import { openUrl } from "../ipc/util"
import { relaunch } from "@tauri-apps/plugin-process"
import { check } from "@tauri-apps/plugin-updater"

export default function useUpdateProgress(onComplete: () => void, onError: (e: { message: string, error: Error }) => void) {
  const [progress, setProgress] = useState(0)
  const newVersion = useAtomValue(newVersionAtom)

  useEffect(() => {
    if (!window.ipcRenderer) {
      return
    }

    window.ipcRenderer.invoke("check-update")
  }, [])

  const electronStartDownload = useCallback(() => {
    window.ipcRenderer.invoke("start-download")
    setProgress(0.1)
  }, [])

  const tauriStartDownload = useCallback(async (silent: boolean = false) => {
    await check().then((update) => {
      if (!update) {
        return
      }

      if (silent) {
        return update.downloadAndInstall()
      }

      const probablyFileSize = window.PLATFORM === "win32" ? 1024 * 1024 * 30 : 1024 * 1024 * 270
      let downloaded = 0

      return update.download(event => {
        switch (event.event) {
          case "Started":
            setProgress(0.1)
            break
          case "Progress":
            downloaded += event.data.chunkLength
            setProgress(Math.min(downloaded / probablyFileSize * 100, 99))
            break
          case "Finished":
            setProgress(99)
            update.install().then(() => {
              setProgress(100)
            })
            break
        }
      })
    })
  }, [])

  const update = useCallback(async () => {
    if (window.PLATFORM === "darwin") {
      openUrl("https://github.com/OpenAgentPlatform/Dive/releases/latest")
      return
    }

    if (getAutoDownload()) {
      return isElectron ? window.ipcRenderer.invoke("quit-and-install") : tauriStartDownload(true)
    }

    if (progress >= 100) {
      return isElectron ? window.ipcRenderer.invoke("quit-and-install") : relaunch()
    }

    return isElectron ? electronStartDownload() : tauriStartDownload()
  }, [progress])

  const handleDownloadProgress = useCallback((event: Electron.IpcRendererEvent, progressInfo: ProgressInfo) => {
    if (progressInfo.percent > 0) {
      setProgress(progressInfo.percent)
    }
  }, [setProgress])

  const handleError = useCallback((event: Electron.IpcRendererEvent, error: Error) => {
    setProgress(0)
    onError({
      message: error.message,
      error,
    })
  }, [onError])

  useEffect(() => {
    if (!window.ipcRenderer) {
      return
    }

    if (getAutoDownload()) {
      setProgress(0)
      return
    }

    const unlistenDownloadProgress = listenIPC("download-progress", handleDownloadProgress)
    const unlistenUpdateDownloaded = listenIPC("update-downloaded", onComplete)
    const unlistenUpdateError = listenIPC("update-error", handleError)

    return () => {
      unlistenDownloadProgress()
      unlistenUpdateDownloaded()
      unlistenUpdateError()
    }
  }, [handleDownloadProgress, onComplete, onError, handleError])

  return { progress, update, newVersion }
}
