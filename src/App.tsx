import { RouterProvider } from "react-router-dom"
import { router } from "./router"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { removeOapConfigAtom, writeOapConfigAtom } from "./atoms/configState"
import { useEffect, useRef, useState } from "react"
import { handleGlobalHotkey } from "./atoms/hotkeyState"
import { handleWindowResizeAtom } from "./atoms/sidebarState"
import { systemThemeAtom } from "./atoms/themeState"
import Updater from "./updater"
import { loadOapToolsAtom, oapLimiterCheckAtom, oapUsageAtom, oapUserAtom, updateOAPUsageAtom } from "./atoms/oapState"
import { modelSettingsAtom } from "./atoms/modelState"
import { installToolBufferAtom, loadMcpConfigAtom, loadToolsAtom } from "./atoms/toolState"
import { useTranslation } from "react-i18next"
import { setModelSettings } from "./ipc/config"
import { oapGetMe, oapGetToken, oapLogout, registBackendEvent } from "./ipc"
import { refreshConfig } from "./ipc/host"
import { openOverlayAtom } from "./atoms/layerState"
import PopupConfirm from "./components/PopupConfirm"
import PopupElicitationRequest from "./components/PopupElicitationRequest"
import { elicitationRequestsAtom, addElicitationRequestAtom, removeElicitationRequestAtom, type ElicitationAction, type ElicitationContent } from "./atoms/chatState"
import { responseLocalIPCElicitation } from "./ipc"
import camelcaseKeys from "camelcase-keys"

function App() {
  const { t } = useTranslation()

  const setSystemTheme = useSetAtom(systemThemeAtom)
  const handleWindowResize = useSetAtom(handleWindowResizeAtom)
  const setOAPUser = useSetAtom(oapUserAtom)
  const oapLimiterCheck = useSetAtom(oapLimiterCheckAtom)
  const setOAPUsage = useSetAtom(oapUsageAtom)
  const updateOAPUsage = useSetAtom(updateOAPUsageAtom)
  const writeOapConfig = useSetAtom(writeOapConfigAtom)
  const removeOapConfig = useSetAtom(removeOapConfigAtom)
  // const reloadOapConfig = useSetAtom(reloadOapConfigAtom)
  const [modelSetting] = useAtom(modelSettingsAtom)
  // const modelGroups = useAtomValue(modelGroupsAtom)
  const loadTools = useSetAtom(loadToolsAtom)
  const { i18n } = useTranslation()
  const loadMcpConfig = useSetAtom(loadMcpConfigAtom)
  const loadOapTools = useSetAtom(loadOapToolsAtom)
  const openOverlay = useSetAtom(openOverlayAtom)

  const setInstallToolBuffer = useSetAtom(installToolBufferAtom)
  const installToolBuffer = useRef<{ name: string, config: any } | null>(null)
  const [installToolConfirm, setInstallToolConfirm] = useState(false)
  // const settings = useAtomValue(modelSettingsAtom)
  // const saveAllConfig = useSetAtom(writeRawConfigAtom)

  // Elicitation state
  const elicitationRequests = useAtomValue(elicitationRequestsAtom)
  const addElicitationRequest = useSetAtom(addElicitationRequestAtom)
  const removeElicitationRequest = useSetAtom(removeElicitationRequestAtom)

  useEffect(() => {
    console.log("set model setting", modelSetting)
    if (modelSetting) {
      setModelSettings(modelSetting)
    }
  }, [modelSetting])

  useEffect(() => {
    loadTools()
    loadMcpConfig()
    // if(localStorage.getItem("selectedModel")) {
    //   const selectedModel = JSON.parse(localStorage.getItem("selectedModel")!)
    //   if(selectedModel.group.modelProvider === "oap") {
    //     saveAllConfig(intoRawModelConfig(settings, selectedModel.group, selectedModel.model)!)
    //   }
    // }
  }, [])

  // init app
  useEffect(() => {
    window.postMessage({ payload: "removeLoading" }, "*")
    window.addEventListener("resize", handleWindowResize)
    window.addEventListener("keydown", handleGlobalHotkey)
    return () => {
      window.removeEventListener("resize", handleWindowResize)
      window.removeEventListener("keydown", handleGlobalHotkey)
    }
  }, [])

  const updateOAPUser = async () => {
    const token = await oapGetToken()
    if (token) {
      const user = await oapGetMe()
      setOAPUser(user.data)
      await updateOAPUsage()
      console.log("oap user", user.data)
      await oapLimiterCheck()
    }
  }

  const openToolPageWithMcpServerJson = (data?: { name: string, config: any }) => {
    if (!data && !installToolBuffer.current) {
      return
    }

    try {
      data = data || installToolBuffer.current!
      const { name, config } = data
      setInstallToolBuffer(prev => [...prev, { name, config }])
      openOverlay({ page: "Setting", tab: "Tools" })
    } catch(e) {
      console.error("mcp install error", e)
    }
  }

  // handle backend event
  useEffect(() => {
    const unregistLogin = registBackendEvent("login", () => {
      console.info("oap login")
      updateOAPUser()
        .catch(console.error)
        .then(() => removeOapConfig())
        .then(() => writeOapConfig())
        .catch(console.error)
    })

    const unregistLogout = registBackendEvent("logout", () => {
      console.info("oap logout")
      removeOapConfig()
      setOAPUser(null)
      setOAPUsage(null)
    })

    const unlistenRefresh = registBackendEvent("refresh", () => {
      console.info("oap refresh")
      refreshConfig()
        .then(loadTools)
        .catch(console.error)

      // updateOAPUser()
      //   .catch(console.error)
      //   .then(reloadOapConfig)
      //   .catch(console.error)
    })

    const unlistenMcpInstall = registBackendEvent("mcp.install", (data: { name: string, config: string }) => {
      const _config = JSON.parse(atob(data.config))
      if (!_config.transport) {
        return
      }

      if (_config.transport === "stdio") {
        setInstallToolConfirm(true)
        installToolBuffer.current = { name: data.name, config: _config }
        return
      }

      openToolPageWithMcpServerJson({ name: data.name, config: _config })
    })

    const unlistenMcpElicitation = registBackendEvent("mcp.elicitation", (data) => {
      const payload = camelcaseKeys(JSON.parse(data), { deep: true })
      console.log({ payload })
      addElicitationRequest(payload)
    })

    return () => {
      unregistLogin()
      unregistLogout()
      unlistenRefresh()
      unlistenMcpInstall()
      unlistenMcpElicitation()
    }
  }, [])

  // init oap user
  useEffect(() => {
    updateOAPUser().then(() => {
      setOAPUser(user => {
        if (!user) {
          console.warn("no user found, logout")
          oapLogout()
          return null
        }

        // if (user && queryGroup({ modelProvider: "oap" }, modelGroups).length === 0) {
        //   writeOapConfig().catch(console.error)
        // } else if (user) {
        //   reloadOapConfig().catch(console.error)
        // } else {
        //   removeOapConfig()
        // }

        return user
      })
    })
    .then(loadOapTools)
    .catch(console.error)
  }, [])

  // set system theme
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => {
      setSystemTheme(mediaQuery.matches ? "dark" : "light")
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [])

  useEffect(() => {
    const langCode = i18n.language || "en"
    document.documentElement.lang = langCode
  }, [i18n.language])

  const closeInstallTool = () => {
    setInstallToolConfirm(false)
    installToolBuffer.current = null
  }

  const handleElicitationRespond = async (requestId: string, action: ElicitationAction, content?: ElicitationContent) => {
    removeElicitationRequest(requestId)
    try {
      if (requestId) {
        await fetch("/api/tools/elicitation/respond", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request_id: requestId, action, content })
        })
      } else {
        let actionEnum = 0
        if (action === "accept") {
          actionEnum = 1
        } else if (action === "decline") {
          actionEnum = 2
        } else if (action === "cancel") {
          actionEnum = 3
        }
        await responseLocalIPCElicitation(actionEnum, content)
      }
    } catch (error) {
      console.error("Failed to respond to elicitation request:", error)
    }
  }

  return (
    <>
      <RouterProvider router={router} />
      <Updater />

      {installToolConfirm &&
        <PopupConfirm
          confirmText={t("common.confirm")}
          cancelText={t("common.cancel")}
          onConfirm={() => {
            openToolPageWithMcpServerJson()
            closeInstallTool()
          }}
          onCancel={closeInstallTool}
          onClickOutside={closeInstallTool}
          noBorder
          footerType="center"
          zIndex={1000}
          className="mcp-install-confirm-modal"
        >
          {t("deeplink.mcpInstallConfirm")}
          <pre>{installToolBuffer.current!.config.command} {installToolBuffer.current!.config.args.join(" ")}</pre>
        </PopupConfirm>
      }
      {elicitationRequests.length > 0 && (
        <PopupElicitationRequest
          zIndex={1000}
          requestId={elicitationRequests[0].requestId}
          message={elicitationRequests[0].message}
          requestedSchema={elicitationRequests[0].requestedSchema}
          onRespond={handleElicitationRespond}
        />
      )}
    </>
  )
}

export default App
