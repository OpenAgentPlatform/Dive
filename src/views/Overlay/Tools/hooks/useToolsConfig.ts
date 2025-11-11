import { useCallback } from "react"
import { useTranslation } from "react-i18next"

interface UseToolsConfigProps {
  showToast: (toast: { message: string; type: "success" | "error" | "info"; closable?: boolean }) => void
  abortControllerRef: React.MutableRefObject<AbortController | null>
  abortDisConnectorRef: React.MutableRefObject<AbortController | null>
}

export const useToolsConfig = ({
  showToast,
  abortControllerRef,
  abortDisConnectorRef,
}: UseToolsConfigProps) => {
  const { t } = useTranslation()

  const updateMCPConfigNoAbort = useCallback(async (
    newConfig: Record<string, any> | string,
    force = false
  ) => {
    const config = typeof newConfig === "string" ? JSON.parse(newConfig) : newConfig
    Object.keys(config.mcpServers).forEach(key => {
      const cfg = config.mcpServers[key]
      if (!cfg.transport) {
        config.mcpServers[key].transport = cfg.url ? "sse" : "stdio"
      }

      if (!("enabled" in config.mcpServers[key])) {
        config.mcpServers[key].enabled = true
      }
    })

    return await fetch(`/api/config/mcpserver${force ? "?force=1" : ""}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
    })
      .then(async (response) => await response.json())
      .catch((error) => {
        if (error.name === "AbortError") {
          abortControllerRef.current = null
          showToast({
            message: t("tools.configSaveAborted"),
            type: "error"
          })
          return {}
        } else {
          showToast({
            message: error instanceof Error ? error.message : t("tools.configFetchFailed"),
            type: "error"
          })
        }
      })
  }, [t, showToast, abortControllerRef])

  const updateMCPConfig = useCallback(async (
    newConfig: Record<string, any> | string,
    force = false
  ) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    if (abortDisConnectorRef.current) {
      abortDisConnectorRef.current.abort()
    }

    abortControllerRef.current = new AbortController()
    const config = typeof newConfig === "string" ? JSON.parse(newConfig) : newConfig
    Object.keys(config.mcpServers).forEach(key => {
      const cfg = config.mcpServers[key]
      if (!cfg.transport) {
        config.mcpServers[key].transport = cfg.url ? "sse" : "stdio"
      }

      if (!("enabled" in config.mcpServers[key])) {
        config.mcpServers[key].enabled = true
      }
    })

    return await fetch(`/api/config/mcpserver${force ? "?force=1" : ""}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
      signal: abortControllerRef.current.signal
    })
      .then(async (response) => await response.json())
      .catch((error) => {
        if (error.name === "AbortError") {
          abortControllerRef.current = null
          showToast({
            message: t("tools.configSaveAborted"),
            type: "error"
          })
          return {}
        } else {
          showToast({
            message: error instanceof Error ? error.message : t("tools.configFetchFailed"),
            type: "error"
          })
        }
      })
  }, [t, showToast, abortControllerRef, abortDisConnectorRef])

  const handleUpdateConfigResponse = useCallback((
    data: { errors?: { error: string; serverName: string }[]; detail?: any[]; success?: boolean },
    mcpConfig: { mcpServers: Record<string, any> },
    setMcpConfig: (config: any) => void,
    tools: any[],
    isShowToast = false
  ) => {
    if (data.errors && data.errors.length && Array.isArray(data.errors)) {
      data.errors.forEach(({ error, serverName }: { error: string; serverName: string }) => {
        if (isShowToast) {
          showToast({
            message: t("tools.updateFailed", { serverName, error }),
            type: "error",
            closable: true
          })
        }
        setMcpConfig((prevConfig: any) => {
          const newConfig = { ...prevConfig }
          if ((newConfig.mcpServers as Record<string, any>)[serverName]) {
            (newConfig.mcpServers as Record<string, any>)[serverName].disabled = true
          }
          return newConfig
        })
      })
    }
    if (data?.detail && data.detail.filter((item: any) => item.type.includes("error")).length > 0) {
      data.detail.filter((item: any) => item.type.includes("error"))
        .forEach((e: any) => {
          const serverName = e.loc[2]
          const error = e.msg
          if (isShowToast) {
            showToast({
              message: t("tools.updateFailed", { serverName, error }),
              type: "error",
              closable: true
            })
          }
        })
    }
    if (!data.errors?.some((error: any) => tools.find(tool => tool.name === error.serverName)) &&
      !data?.detail?.some((item: any) => item.type.includes("error"))) {
      showToast({
        message: t("tools.saveSuccess"),
        type: "success"
      })
    }
  }, [t, showToast])

  return {
    updateMCPConfig,
    updateMCPConfigNoAbort,
    handleUpdateConfigResponse,
  }
}

