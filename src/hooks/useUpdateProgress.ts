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
  const [downloadedFileSize, setDownloadedFileSize] = useState(0)
  const [totalFileSize, setTotalFileSize] = useState(0)
  const newVersion = useAtomValue(newVersionAtom)

  useEffect(() => {
    if (isElectron) {
      window.ipcRenderer.invoke("check-update")
    }
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
      let realFileSize = probablyFileSize
      let downloaded = 0

      return update.download(event => {
        switch (event.event) {
          case "Started":
            realFileSize = event.data.contentLength || realFileSize
            // bytes -> mb
            setTotalFileSize(realFileSize / 1024 / 1024)
            setProgress(0.1)
            break
          case "Progress":
            downloaded += event.data.chunkLength
            setProgress(Math.min(downloaded / realFileSize * 100, 99.9))
            // bytes -> mb
            setDownloadedFileSize(downloaded / 1024 / 1024)
            break
          case "Finished":
            setProgress(100)
            break
        }
      })
      .then(() => update.install())
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
    // byte -> mb
    setTotalFileSize(progressInfo.total / (1024 * 1024))
    setDownloadedFileSize(progressInfo.transferred / (1024 * 1024))
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

  return { progress, update, newVersion, downloadedFileSize, totalFileSize }
}
