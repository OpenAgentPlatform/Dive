import { useCallback, useEffect } from "react"
import { useSetAtom } from "jotai"
import { newVersionAtom } from "./atoms/globalState"

export const getAutoDownload = () => !!localStorage.getItem("autoDownload")
export const setAutoDownload = (value: boolean) => localStorage.setItem("autoDownload", value.toString())

export default function Updater() {
  const setNewVersion = useSetAtom(newVersionAtom)

  const handleUpdateAvailable = useCallback((event: Electron.IpcRendererEvent, arg: { update: boolean, version: string, newVersion: string }) => {
    if (!arg.update || !arg.newVersion) {
      return
    }

    const autoDownload = getAutoDownload()
    if (window.PLATFORM !== "darwin" && autoDownload) {
      window.ipcRenderer.invoke("start-download")
      return
    }

    setNewVersion(arg.newVersion)
  }, [setNewVersion])

  // listen new version
  useEffect(() => {
    window.ipcRenderer.on("update-can-available", handleUpdateAvailable)

    return () => {
      window.ipcRenderer.off("update-can-available", handleUpdateAvailable)
    }
  }, [handleUpdateAvailable])

  return null
}
