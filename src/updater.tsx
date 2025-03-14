import { useCallback, useEffect, useRef } from "react"
import { useSetAtom } from "jotai"
import { newVersionAtom } from "./atoms/globalState"

export const getAutoDownload = () => !!localStorage.getItem("autoDownload")
export const setAutoDownload = (value: boolean) => localStorage.setItem("autoDownload", value?"1":"")

export default function Updater() {
  const setNewVersion = useSetAtom(newVersionAtom)
  const newVersion = useRef("")

  const handleUpdateAvailable = useCallback((event: Electron.IpcRendererEvent, arg: { update: boolean, version: string, newVersion: string }) => {
    if (!arg.update || !arg.newVersion) {
      return
    }

    newVersion.current = arg.newVersion

    const autoDownload = getAutoDownload()
    if (window.PLATFORM !== "darwin" && autoDownload) {
      window.ipcRenderer.invoke("start-download")
      return
    }

    setNewVersion(arg.newVersion)
  }, [setNewVersion])

  const handleUpdateDownloaded = useCallback(() => {
    if (newVersion.current) {
      setNewVersion(newVersion.current)
    }
  }, [setNewVersion])

  // listen new version
  useEffect(() => {
    window.ipcRenderer.on("update-can-available", handleUpdateAvailable)
    window.ipcRenderer.on("update-downloaded", handleUpdateDownloaded)

    return () => {
      window.ipcRenderer.off("update-can-available", handleUpdateAvailable)
      window.ipcRenderer.off("update-downloaded", handleUpdateDownloaded)
    }
  }, [handleUpdateAvailable])

  return null
}
