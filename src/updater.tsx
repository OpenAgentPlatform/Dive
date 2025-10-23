import { useCallback, useEffect, useRef } from "react"
import { useSetAtom } from "jotai"
import { newVersionAtom } from "./atoms/globalState"
import { invokeIPC, isElectron, listenIPC } from "./ipc"
import { check } from "@tauri-apps/plugin-updater"
import { getClientInfo } from "./ipc/util"

export const getAutoDownload = () => !!localStorage.getItem("autoDownload")
export const setAutoDownload = (value: boolean) => localStorage.setItem("autoDownload", value?"1":"")

function ElectronUpdater() {
  const setNewVersion = useSetAtom(newVersionAtom)
  const newVersion = useRef("")

  const handleUpdateAvailable = useCallback((event: Electron.IpcRendererEvent, arg: { update: boolean, version: string, newVersion: string }) => {
    if (!arg.update || !arg.newVersion) {
      return
    }

    newVersion.current = arg.newVersion

    const autoDownload = getAutoDownload()
    if (window.PLATFORM !== "darwin" && autoDownload) {
      invokeIPC("start-download")
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
    const unlistenUpdateAvailable = listenIPC("update-can-available", handleUpdateAvailable)
    const unlistenUpdateDownloaded = listenIPC("update-downloaded", handleUpdateDownloaded)

    return () => {
      unlistenUpdateAvailable()
      unlistenUpdateDownloaded()
    }
  }, [handleUpdateAvailable, handleUpdateDownloaded])

  return null
}

function TauriUpdater() {
  const setNewVersion = useSetAtom(newVersionAtom)
  const newVersion = useRef("")
  const timer = useRef<NodeJS.Timeout | null>(null)

  const checkUpdate = async () => {
    const clientInfo = await getClientInfo()
    const update = await check({
      headers: {
        "User-Agent": `DiveDesktop/${clientInfo.version}`,
        "X-Dive-Id": clientInfo.client_id,
      }
    })

    if (!update) {
      return
    }

    setNewVersion(update.version)
    newVersion.current = update.version

    const autoDownload = getAutoDownload()
    if (window.PLATFORM !== "darwin" && autoDownload) {
      await update.downloadAndInstall()
      return
    }
  }

  useEffect(() => {
    timer.current = setInterval(checkUpdate, 1000 * 60 * 60)
    return () => {
      if (timer.current) {
        clearInterval(timer.current)
      }
    }
  }, [])

  return null
}

export default function Updater() {
  if (isElectron) {
    return <ElectronUpdater />
  }

  return <TauriUpdater />
}
