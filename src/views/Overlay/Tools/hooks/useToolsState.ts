import { useState, useRef } from "react"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import {
  toolsAtom,
  mcpConfigAtom,
  loadToolsAtom,
  loadMcpConfigAtom,
  Tool,
  installToolBufferAtom,
  toolsCacheAtom
} from "../../../../atoms/toolState"
import { oapToolsAtom, isLoggedInOAPAtom, loadOapToolsAtom } from "../../../../atoms/oapState"
import { showToastAtom } from "../../../../atoms/toastState"
import { closeAllOverlaysAtom } from "../../../../atoms/layerState"
import { authorizeStateAtom } from "../../../../atoms/globalState"
import { LogType } from "../utils/constants"

export const useToolsState = () => {
  // Atoms
  const [tools, setTools] = useAtom(toolsAtom)
  const [oapTools, setOapTools] = useAtom(oapToolsAtom)
  const [mcpConfig, setMcpConfig] = useAtom(mcpConfigAtom)
  const [toolsCache, setToolsCache] = useAtom(toolsCacheAtom)
  const [installToolBuffer, setInstallToolBuffer] = useAtom(installToolBufferAtom)
  const [authorizeState, setAuthorizeState] = useAtom(authorizeStateAtom)
  
  const isLoggedInOAP = useAtomValue(isLoggedInOAPAtom)
  const showToast = useSetAtom(showToastAtom)
  const loadTools = useSetAtom(loadToolsAtom)
  const loadMcpConfig = useSetAtom(loadMcpConfigAtom)
  const loadOapTools = useSetAtom(loadOapToolsAtom)
  const closeAllOverlays = useSetAtom(closeAllOverlaysAtom)

  // Local state
  const [isLoading, setIsLoading] = useState(false)
  const [isConnectorLoading, setIsConnectorLoading] = useState(false)
  const [isDisConnectorLoading, setIsDisConnectorLoading] = useState(false)
  const [loadingTools, setLoadingTools] = useState<string[]>([])
  const [currentTool, setCurrentTool] = useState<string>("")
  const [toolLog, setToolLog] = useState<LogType[]>([])
  const [toolType, setToolType] = useState<"all" | "oap" | "custom">("all")
  const [isResort, setIsResort] = useState(true)
  const [expandedSections, setExpandedSections] = useState<string[]>([])

  // Popups state
  const [showDeletePopup, setShowDeletePopup] = useState(false)
  const [showCustomEditPopup, setShowCustomEditPopup] = useState(false)
  const [showDeleteConnectorPopup, setShowDeleteConnectorPopup] = useState(false)
  const [showConnectorPopup, setShowConnectorPopup] = useState(false)
  const [showConfirmCancelConnector, setShowConfirmCancelConnector] = useState(false)
  const [showConfirmDisConnector, setShowConfirmDisConnector] = useState(false)
  const [showOapMcpPopup, setShowOapMcpPopup] = useState(false)
  const [showUnsavedSubtoolsPopup, setShowUnsavedSubtoolsPopup] = useState(false)

  // Refs
  const mcpConfigRef = useRef<any>(null)
  const changingToolRef = useRef<Tool | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const abortControllerConnectorRef = useRef<AbortController | null>(null)
  const abortDisConnectorRef = useRef<AbortController | null>(null)
  const sortedConfigOrderRef = useRef<string[]>([])

  return {
    // Atoms
    tools,
    setTools,
    oapTools,
    setOapTools,
    mcpConfig,
    setMcpConfig,
    toolsCache,
    setToolsCache,
    installToolBuffer,
    setInstallToolBuffer,
    authorizeState,
    setAuthorizeState,
    isLoggedInOAP,
    showToast,
    loadTools,
    loadMcpConfig,
    loadOapTools,
    closeAllOverlays,

    // Local state
    isLoading,
    setIsLoading,
    isConnectorLoading,
    setIsConnectorLoading,
    isDisConnectorLoading,
    setIsDisConnectorLoading,
    loadingTools,
    setLoadingTools,
    currentTool,
    setCurrentTool,
    toolLog,
    setToolLog,
    toolType,
    setToolType,
    isResort,
    setIsResort,
    expandedSections,
    setExpandedSections,

    // Popups state
    showDeletePopup,
    setShowDeletePopup,
    showCustomEditPopup,
    setShowCustomEditPopup,
    showDeleteConnectorPopup,
    setShowDeleteConnectorPopup,
    showConnectorPopup,
    setShowConnectorPopup,
    showConfirmCancelConnector,
    setShowConfirmCancelConnector,
    showConfirmDisConnector,
    setShowConfirmDisConnector,
    showOapMcpPopup,
    setShowOapMcpPopup,
    showUnsavedSubtoolsPopup,
    setShowUnsavedSubtoolsPopup,

    // Refs
    mcpConfigRef,
    changingToolRef,
    abortControllerRef,
    abortControllerConnectorRef,
    abortDisConnectorRef,
    sortedConfigOrderRef,
  }
}

