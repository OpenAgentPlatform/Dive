import React, { useEffect, useState, useRef, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useAtomValue, useSetAtom } from "jotai"
import { showToastAtom } from "../../../../atoms/toastState"
import Switch from "../../../../components/Switch"
import { MCPConfig, mcpConfigAtom, Tool, toolsAtom } from "../../../../atoms/toolState"
import Tooltip from "../../../../components/Tooltip"
import PopupConfirm from "../../../../components/PopupConfirm"
import { McpServersProps } from "../utils/constants"
import { customListProps } from "./CustomEdit"
import Button from "../../../../components/Button"
import Input from "../../../../components/Input"

interface connectorPopupProps {
  _connectorName: string
  _isReAuthorizing: boolean
  _tabdata: {
    currentTool: string
  }
  onDelete?: (toolName: string) => Promise<void>
  onDisconnect: (toolName?: string) => Promise<void>
  onToggle: (tool: Tool) => Promise<void>
  onCancel: () => void
  onConnect: (connector: connectorListProps) => Promise<void>
  onSubmit: (config: {mcpServers: McpServersProps}, connector: connectorListProps) => Promise<void>
}

interface connectorProps extends McpServersProps {
  transport: "streamable"
}

interface connectorListProps extends Omit<customListProps, "jsonString" | "isRangeError"> {
  mcpServers: connectorProps
  status?: Tool["status"]
  has_credential?: boolean
}

const ConnectorFieldType = {
  "name": {
    type: "string",
    required: true
  },
  "url": {
    type: "url",
    required: true
  },
  "oauthID": {
    type: "string",
    required: false
  },
  "oauthSecret": {
    type: "string",
    required: false
  }
}

const IGNORE_UNSAVE_FIELDS = ["mcpServers.enabled", "isError", "status"]

const ConnectorEdit = React.memo(({ _connectorName, _isReAuthorizing, _tabdata, onDelete, onToggle, onDisconnect, onCancel, onConnect, onSubmit }: connectorPopupProps) => {
  const _tools = useAtomValue(toolsAtom)
  const _config = useAtomValue(mcpConfigAtom)
  const { t } = useTranslation()
  const [type, setType] = useState("add")
  const [connectorList, setConnectorList] = useState<connectorListProps[]>([])
  const [otherList, setOtherList] = useState<customListProps[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const prevIndex = useRef(-1)
  const [currentConnector, setCurrentConnector] = useState<connectorListProps>({
    name: "",
    mcpServers: {
      enabled: true,
      url: "",
      transport: "streamable"
    },
    status: "unauthorized",
    isError: { isError: false, text: "" }
  })
  const [originalConnector, setOriginalConnector] = useState<connectorListProps>(JSON.parse(JSON.stringify(currentConnector)))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showToast = useSetAtom(showToastAtom)
  const [isChanging, setIsChanging] = useState(false)
  const [showUnSavePopup, setShowUnSavePopup] = useState(false)
  const [showUnSaveErrorPopup, setShowUnSaveErrorPopup] = useState(false)
  const forceSubmit = useRef<NodeJS.Timeout | null>(null)

  const clearSubmitState = (isTimeout: boolean = false) => {
    if(forceSubmit.current) {
      clearTimeout(forceSubmit.current)
    }
    if(isTimeout) {
      forceSubmit.current = setTimeout(() => {
        setIsSubmitting(false)
        forceSubmit.current = null
      }, 180000)
    } else {
      forceSubmit.current = null
    }
  }

  useEffect(() => {
    if(!_config.mcpServers) {
      return
    }
    const newConnectorList: connectorListProps[] = []
    const newOtherList: customListProps[] = []
    const newConfig = JSON.parse(JSON.stringify(_config))

    Object.keys(newConfig.mcpServers)
    .sort((a, b) => {
      const aEnabled = newConfig.mcpServers[a]?.enabled
      const bEnabled = newConfig.mcpServers[b]?.enabled
      if (aEnabled && !bEnabled)
        return -1
      if (!aEnabled && bEnabled)
        return 1
      return 0
    })
    .forEach((connectorName) => {
      if(newConfig.mcpServers[connectorName].transport === "streamable") {
        const _tool = _tools.find(tool => tool.name === connectorName)
        newConnectorList.push({
          name: connectorName,
          has_credential: _tool ? _tool.has_credential : false,
          mcpServers: newConfig.mcpServers[connectorName],
          status: _tabdata?.currentTool === connectorName ? "unauthorized" : _tool ? _tool.status : "unauthorized",
          isError: { isError: false, text: "" },
        })
      } else {
        newOtherList.push({
          name: connectorName,
          mcpServers: newConfig.mcpServers[connectorName],
          isError: { isError: false, text: "" },
          jsonString: "",
          isRangeError: { isError: false, text: "", fieldKey: "", value: 0 }
        })
      }
    })
    setConnectorList(newConnectorList)
    setOtherList(newOtherList)
    const index = newConnectorList.findIndex(connector => connector.name === _connectorName)
    if(index > -1) {
      prevIndex.current = index
      setCurrentIndex(index)
      const newConnector = { ...newConnectorList[index] }
      setCurrentConnector(JSON.parse(JSON.stringify(newConnector)))
      setOriginalConnector(JSON.parse(JSON.stringify(newConnector)))
    }
    setIsChanging(false)
  }, [_tools])

  useEffect(() => {
    if(prevIndex.current !== currentIndex && isChanging) {
      if(currentConnector.isError.isError) {
        setShowUnSaveErrorPopup(true)
      } else {
        setShowUnSavePopup(true)
      }
      setCurrentIndex(prevIndex.current)
    } else if(!isChanging) {
      prevIndex.current = currentIndex
      let newConnector = { ...connectorList[currentIndex] }
      if(currentIndex > -1) {
        setType("edit")
        newConnector = connectorList[currentIndex]
      } else {
        setType("add")
        newConnector = {
          name: "",
          has_credential: false,
          mcpServers: {
            enabled: true,
            url: "",
            transport: "streamable"
          },
          status: "unauthorized",
          isError: { isError: false, text: "" }
        }
      }
      console.log(newConnector)
      setCurrentConnector(JSON.parse(JSON.stringify(newConnector)))
      setOriginalConnector(JSON.parse(JSON.stringify(newConnector)))
    }
  }, [currentIndex])

  // useEffect(() => {
  //   let _isChanging = true
  //   if(isEqualIgnoring(originalConnector, currentConnector, IGNORE_UNSAVE_FIELDS)) {
  //     _isChanging = false
  //   }
  //   setIsChanging(_isChanging)
  // }, [currentConnector])

  useEffect(() => {
    if(isChanging) {
      currentConnector.mcpServers.enabled = true
    } else if (currentIndex > -1) {
      currentConnector.mcpServers.enabled = connectorList[currentIndex].mcpServers.enabled
    }
  }, [isChanging])

  // check if two objects are equal except the ignoreKeys
  const isEqualIgnoring = (obj1: any, obj2: any, ignoreKeys: string[]): boolean => {
    const ignoreSet = new Set(ignoreKeys)

    function compare(o1: any, o2: any, path: string[] = []): boolean {
      const keys = new Set([...Object.keys(o1), ...Object.keys(o2)])

      for (const key of keys) {
        const currentPath = [...path, key].join(".")

        if (ignoreSet.has(currentPath)) {
          continue
        }

        const v1 = (o1 as any)[key]
        const v2 = (o2 as any)[key]

        if (typeof v1 === "object" && v1 !== null && typeof v2 === "object" && v2 !== null) {
          if (!compare(v1, v2, [...path, key])) {
            return false
          }
        } else {
          if (v1 !== v2) {
            return false
          }
        }
      }
      return true
    }

    return compare(obj1, obj2)
  }

  // insert ignore fields to the connectorList
  const insertIgnoreFields = (newConnector: connectorListProps) => {
    try {
      if (newConnector.isError.isError || !isEqualIgnoring(originalConnector, newConnector, IGNORE_UNSAVE_FIELDS))
        return

      const newConnectorList = [...connectorList]
      if(currentIndex > -1) {
        newConnectorList[currentIndex] = newConnector
      }
      setConnectorList(newConnectorList)
    } catch (err) {
      showToast({
        message: err as string,
        type: "error"
      })
    }
  }

  const handleChange = (key: string, value: string | boolean) => {
    if(_isReAuthorizing || (currentConnector.mcpServers.extraData?.oap && key !== "enabled")) {
      return
    }
    let newConnector: connectorListProps = JSON.parse(JSON.stringify(currentConnector))
    if(key === "name") {
      newConnector.name = value as string
    } else {
      newConnector.mcpServers[key as keyof connectorProps] = value as never
    }

    const newConnectorList = [...connectorList]
    newConnectorList.forEach((connector, index) => {
      if(currentIndex === index) {
        connector.name = newConnector.name
      }
    })

    let _isChanging = true
    if(isEqualIgnoring(originalConnector, newConnector, IGNORE_UNSAVE_FIELDS)) {
      _isChanging = false
    }
    setIsChanging(_isChanging)

    setCurrentConnector(newConnector)
    newConnector = handleError(newConnector, newConnectorList)
    insertIgnoreFields(newConnector)
  }

  const handleError = (newConnector: connectorListProps, newConnectorList: connectorListProps[]) => {
    let newConnectorError = { isError: false, text: "" } as { isError: boolean, text: string, name?: string }
    const nameError = !isValidName(currentIndex, newConnector.name)
    const fieldError = !isValidField(currentIndex, newConnector)
    if(nameError) {
      newConnectorError = { isError: true, text: "tools.jsonFormatError.nameExist", name: newConnector.name }
    } else if(fieldError) {
      newConnectorError = { isError: true, text: "tools.jsonFormatError.format" }
    }
    setCurrentConnector({
      ...newConnector,
      isError: newConnectorError
    })
    newConnectorList.forEach((connector, index) => {
      let newConnectorListError = { isError: false, text: "" }
      const nameError = !isValidName(index, index === currentIndex ? newConnector.name : connector.name)
      const fieldError = !isValidField(index, newConnector)
      if(nameError) {
        newConnectorListError = { isError: true, text: "tools.jsonFormatError.nameExist" }
      } else if(fieldError) {
        newConnectorListError = { isError: true, text: "tools.jsonFormatError.format" }
      }
      connector.isError = newConnectorListError
    })
    setConnectorList(newConnectorList)
    return {
      ...newConnector,
      isError: newConnectorError
    }
  }

  // check duplicate name in connectorList
  const isValidName = (_index: number, newName: string) => {
    if(_index === -1 && !newName) {
      // exception for adding new connector, it still will be checked in isValidField
      return true
    }
    return !connectorList.some((connector, index) => index !== _index && connector.name === newName)
          && !otherList.some((custom) => custom.name === newName)
  }

  const isValidField = (_index: number, connector: connectorListProps) => {
    // becasuse only can change the current connector, so other connector's field is not need to be checked
    if(currentIndex !== _index) {
      return true
    }
    return Object.keys(ConnectorFieldType).every((key) => {
      // The status is correct when all fields are empty while adding a new connector
      if(currentIndex === -1) {
        if(!connector.name && !connector.mcpServers.url) {
          return true
        }
      }
      if(key === "name") {
        return !!connector.name
      } else if(ConnectorFieldType[key as keyof typeof ConnectorFieldType].required && !connector.mcpServers[key as keyof connectorProps]) {
        return false
      }
      if(ConnectorFieldType[key as keyof typeof ConnectorFieldType].type === "url") {
        try {
          if(connector.mcpServers[key as keyof connectorProps]) {
            new URL(connector.mcpServers[key as keyof connectorProps] as string)
          }
        } catch (_err) {
          return false
        }
      }
      return true
    })
  }

  const handleConnector = async () => {
    if(currentConnector.isError?.isError || isSubmitting) {
      return
    }
    try {
      setIsSubmitting(true)
      clearSubmitState(true)
      if(!isChanging && currentConnector.status === "running" && !_isReAuthorizing) {
        await onDisconnect(currentConnector.name)
      } else {
        await onConnect(currentConnector)
      }
    } catch (err) {
      showToast({
        message: err as string,
        type: "error"
      })
    } finally {
      setIsSubmitting(false)
      clearSubmitState(false)
    }
  }

  const handleSubmit = async () => {
    try {
      if (connectorList.some(connector => connector.isError.isError)
        || currentConnector.isError.isError)
        return

      const newConfig: {mcpServers: MCPConfig} = { mcpServers: {} }
      for(const connector of connectorList) {
        newConfig.mcpServers[connector.name] = connector.mcpServers as unknown as MCPConfig[keyof MCPConfig]
      }
      if(currentConnector.name) {
        newConfig.mcpServers[currentConnector.name] = currentConnector.mcpServers as unknown as MCPConfig[keyof MCPConfig]
      }

      setIsSubmitting(true)
      clearSubmitState(true)
      await onSubmit(newConfig, currentConnector)
    } catch (err) {
      showToast({
        message: err as string,
        type: "error"
      })
    } finally {
      setIsSubmitting(false)
      clearSubmitState(false)
    }
  }

  const handleToggle = async () => {
    if(isChanging || _isReAuthorizing) {
      return
    }

    try{
      handleChange("enabled", !currentConnector.mcpServers.enabled)

      setIsChanging(false)

      const _tool = {
        ...currentConnector,
        ...currentConnector.mcpServers,
        enabled: currentConnector.mcpServers.enabled
      } as Tool

      setIsSubmitting(true)
      clearSubmitState(true)
      await onToggle(_tool)
    } catch(_e) {
      setIsSubmitting(false)
      clearSubmitState(false)
    } finally {
      setIsSubmitting(false)
      clearSubmitState(false)
    }
  }

  const connectorNameMask = (name: string, maxLength: number = 15) => {
    return name.length > maxLength ? `${name.slice(0, maxLength)}...` : name
  }

  const ConnectorList = useMemo(() => {
    return (
      <div className="tool-edit-list">
        <Tooltip
          disabled={currentIndex !== -1 || !currentConnector.isError.isError}
          content={t(currentConnector.isError.text, { mcp: currentConnector.name })}
          side="right"
        >
          <div
            className={`tool-edit-list-item ${(currentIndex === -1 && currentConnector.isError.isError) && "error"} ${currentIndex === -1 && type.includes("add") && "active"}`}
            onClick={() => {
              setCurrentIndex(-1)
            }}
          >
            <div className="tool-edit-list-item-content">
              <div className="left">
                <label>
                  {`+ ${t("tools.connector.add")}`}
                </label>
                {(currentIndex === -1 && currentConnector.isError.isError) && (
                  <svg width="16px" height="16px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"></circle>
                    <line x1="12" y1="6" x2="12" y2="14" stroke="currentColor" strokeWidth="2"></line>
                    <circle cx="12" cy="17" r="1.5" fill="currentColor"></circle>
                  </svg>
                )}
              </div>
              <div className="right">
              </div>
            </div>
          </div>
        </Tooltip>
        {connectorList && connectorList.map((connector, index) => (
          (connector.isError?.isError) ? (
            <Tooltip
              key={index}
              content={t(connector.isError.text, { mcp: connector.name })}
              side="right"
            >
              <div
                className={`tool-edit-list-item error ${index === currentIndex ? "active" : ""}`}
                onClick={() => {
                  setCurrentIndex(index)
                }}
              >
                <div className="tool-edit-list-item-content">
                  <div className="left">
                    <label>
                      {connectorNameMask(connector.name, 18)}
                    </label>
                    <svg width="16px" height="16px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"></circle>
                      <line x1="12" y1="6" x2="12" y2="14" stroke="currentColor" strokeWidth="2"></line>
                      <circle cx="12" cy="17" r="1.5" fill="currentColor"></circle>
                    </svg>
                  </div>
                  <div className="right">
                    {(currentIndex === index && isChanging) ?
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 22 22" fill="none">
                        <path d="M3 13.6684V18.9998H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M2.99991 13.5986L12.5235 4.12082C13.9997 2.65181 16.3929 2.65181 17.869 4.12082V4.12082C19.3452 5.58983 19.3452 7.97157 17.869 9.44058L8.34542 18.9183" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg> :
                      (connector.mcpServers.enabled ? (
                        <svg className={`tool-edit-list-item-connect-icon ${(connector.status === "running" && !(_connectorName == connector.name && _isReAuthorizing)) ? "connected" : "unconnected"}`} width="16px" height="16px" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" fill="none">
                          <path d="M16.6735 1.32098C14.9174 -0.435119 12.0404 -0.435119 10.2843 1.32098L6.83435 4.77091C8.01754 4.43463 9.3004 4.52181 10.4213 5.04491L12.2147 3.25144C12.9122 2.55399 14.0456 2.55399 14.743 3.25144C15.4405 3.9489 15.4405 5.08227 14.743 5.77973L12.4887 8.03401L11.0066 9.51611C10.3092 10.2136 9.17581 10.2136 8.47832 9.51611L6.54785 11.4466C6.99622 11.895 7.51931 12.2312 8.06731 12.4429C9.54945 13.0283 11.2682 12.8041 12.5635 11.7828C12.688 11.6832 12.825 11.5711 12.9371 11.4465L15.2661 9.11752L16.6735 7.71015C18.4421 5.95409 18.4421 3.08954 16.6735 1.32098Z" fill="currentColor"/>
                          <path d="M7.49452 13.028L5.77578 14.7467C5.07832 15.4442 3.94496 15.4442 3.2475 14.7467C2.55004 14.0493 2.55004 12.916 3.2475 12.2185L6.98388 8.48211C7.68134 7.78465 8.81471 7.78465 9.51221 8.48211L11.4427 6.55165C10.9943 6.10328 10.4712 5.76701 9.92321 5.55528C8.36638 4.93255 6.53555 5.219 5.22782 6.38974C5.16555 6.43956 5.10327 6.50183 5.05346 6.55165L1.31707 10.288C-0.439025 12.0441 -0.439025 14.9211 1.31707 16.6772C3.07317 18.4333 5.95019 18.4333 7.70629 16.6772L11.0815 13.2646C9.36271 13.6631 8.96416 13.6134 7.49452 13.028Z" fill="currentColor"/>
                        </svg>
                      ) : "")
                    }
                  </div>
                </div>
              </div>
            </Tooltip>
          ) : (
            <div
              key={index}
              className={`tool-edit-list-item ${index === currentIndex ? "active" : ""}`}
              onClick={() => {
                setCurrentIndex(index)
              }}
            >
              <div className="tool-edit-list-item-content">
                <div className="left">
                  <label>
                    {connectorNameMask(connector.name, 21)}
                  </label>
                </div>
                <div className="right">
                  {(currentIndex === index && isChanging) ?
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 22 22" fill="none">
                      <path d="M3 13.6684V18.9998H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M2.99991 13.5986L12.5235 4.12082C13.9997 2.65181 16.3929 2.65181 17.869 4.12082V4.12082C19.3452 5.58983 19.3452 7.97157 17.869 9.44058L8.34542 18.9183" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg> :
                    (connector.mcpServers.enabled ? (
                      <svg className={`tool-edit-list-item-connect-icon ${(connector.status === "running" && !(_connectorName == connector.name && _isReAuthorizing)) ? "connected" : "unconnected"}`} width="16px" height="16px" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" fill="none">
                        <path d="M16.6735 1.32098C14.9174 -0.435119 12.0404 -0.435119 10.2843 1.32098L6.83435 4.77091C8.01754 4.43463 9.3004 4.52181 10.4213 5.04491L12.2147 3.25144C12.9122 2.55399 14.0456 2.55399 14.743 3.25144C15.4405 3.9489 15.4405 5.08227 14.743 5.77973L12.4887 8.03401L11.0066 9.51611C10.3092 10.2136 9.17581 10.2136 8.47832 9.51611L6.54785 11.4466C6.99622 11.895 7.51931 12.2312 8.06731 12.4429C9.54945 13.0283 11.2682 12.8041 12.5635 11.7828C12.688 11.6832 12.825 11.5711 12.9371 11.4465L15.2661 9.11752L16.6735 7.71015C18.4421 5.95409 18.4421 3.08954 16.6735 1.32098Z" fill="currentColor"/>
                        <path d="M7.49452 13.028L5.77578 14.7467C5.07832 15.4442 3.94496 15.4442 3.2475 14.7467C2.55004 14.0493 2.55004 12.916 3.2475 12.2185L6.98388 8.48211C7.68134 7.78465 8.81471 7.78465 9.51221 8.48211L11.4427 6.55165C10.9943 6.10328 10.4712 5.76701 9.92321 5.55528C8.36638 4.93255 6.53555 5.219 5.22782 6.38974C5.16555 6.43956 5.10327 6.50183 5.05346 6.55165L1.31707 10.288C-0.439025 12.0441 -0.439025 14.9211 1.31707 16.6772C3.07317 18.4333 5.95019 18.4333 7.70629 16.6772L11.0815 13.2646C9.36271 13.6631 8.96416 13.6134 7.49452 13.028Z" fill="currentColor"/>
                      </svg>
                    ) : "")
                  }
                </div>
              </div>
            </div>
          )
        ))}
      </div>
    )
  }, [connectorList, currentConnector, currentIndex, isChanging])

  const ConnectorField = useMemo(() => {

    return (
      <div className="tool-edit-field">
        <div className="tool-edit-field-desc">
          {t("tools.connector.description")}
        </div>
        <div className="field-content">
          {/* Name */}
          <div className="field-item">
            <Tooltip
              content={t("chat.reAuthorize.stopChange")}
              disabled={!_isReAuthorizing}
              side="left"
            >
              <Input
                label={t("tools.connector.nameTitle")}
                size="small"
                type="text"
                placeholder={t("tools.connector.namePlaceholder")}
                value={currentConnector.name}
                disabled={_isReAuthorizing}
                readonly={currentConnector.mcpServers.extraData?.oap}
                onChange={(e) => handleChange("name", e.target.value)}
              />
            </Tooltip>
          </div>
          {/* Url */}
          <div className="field-item">
            <Tooltip
              content={t("chat.reAuthorize.stopChange")}
              disabled={!_isReAuthorizing}
              side="left"
            >
              <Input
                label={t("tools.connector.urlTitle")}
                size="small"
                type="text"
                placeholder={t("tools.connector.urlPlaceholder")}
                value={currentConnector.mcpServers.url}
                disabled={_isReAuthorizing}
                readonly={currentConnector.mcpServers.extraData?.oap}
                onChange={(e) => handleChange("url", e.target.value)}
              />
            </Tooltip>
          </div>
          {/* Oauth ID */}
          {/* <div className="field-item">
            <label>Oauth ID</label>
            <Tooltip
              content={t("chat.reAuthorize.stopChange")}
              disabled={!_isReAuthorizing}
              side="left"
            >
              <input
                placeholder={t("tools.connector.oauthIDPlaceholder")}
                type="text"
                value={currentConnector.oauthID}
                onChange={(e) => handleChange("oauthID", e.target.value)}
              />
            </Tooltip>
          </div> */}
          {/* Oauth Secret */}
          {/* <div className="field-item">
            <label>Oauth Secret</label>
            <Tooltip
              content={t("chat.reAuthorize.stopChange")}
              disabled={!_isReAuthorizing}
              side="left"
            >
              <input
                placeholder={t("tools.connector.oauthSecretPlaceholder")}
                type="text"
                value={currentConnector.oauthSecret}
                onChange={(e) => handleChange("oauthSecret", e.target.value)}
              />
            </Tooltip>
          </div> */}
          <div className="oauth-alert">
            <svg width="20px" height="20px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"></circle>
              <line x1="12" y1="6" x2="12" y2="14" stroke="currentColor" strokeWidth="2"></line>
              <circle cx="12" cy="17" r="1.5" fill="currentColor"></circle>
            </svg>
            <div className="alert-content">{t("tools.oauthAlert")}</div>
          </div>
        </div>
      </div>
    )
  }, [connectorList, currentConnector, currentIndex, type, _isReAuthorizing])

  const connectorTitle = (type: string) => {
    switch(type) {
      case "edit":
        return t("tools.connector.editTitle", { name: connectorList[currentIndex]?.name })
      case "add":
        return t("tools.connector.addTitle")
    }
  }

  return (
    <>
      <PopupConfirm
        overlay
        className={`tool-edit-popup-container connector-popup-container ${type}`}
        onConfirm={_isReAuthorizing ? undefined : handleSubmit}
        onCancel={onCancel}
        disabled={currentConnector.isError?.isError || isSubmitting || !isChanging}
        zIndex={1000}
        listenHotkey={false}
        confirmText={isSubmitting ? (
          <div className="loading-spinner"></div>
        ) : t("tools.save")}
        footerHint={ type === "edit" && !isSubmitting && <div className="tool-edit-popup-footer-hint">
          {onDelete && !_isReAuthorizing &&
            <Button
              theme="Color"
              color="neutralGray"
              size="medium"
              onClick={() => onDelete(connectorList[currentIndex]?.name)}
              disabled={_isReAuthorizing}
            >
              {t("tools.delete")}
            </Button>
          }
          {/* {!isChanging && !(!currentConnector.has_credential && currentConnector.status === "running") &&
            <Button
              theme="Color"
              color={(currentConnector.status === "running" && !_isReAuthorizing) ? "neutralGray" : "primary"}
              size="medium"
              onClick={handleConnector}
              loading={isSubmitting}
              disabled={currentConnector.isError?.isError || isSubmitting}
            >
              {(currentConnector.status === "running" && !_isReAuthorizing) ? t("tools.connector.disconnect") : t("tools.connector.connect")}
            </Button>
          } */}
          {!isChanging && <>
            {!currentConnector.has_credential &&
              <Button
                theme="Color"
                color="neutralGray"
                size="medium"
                onClick={() => {}}
              >
                {t("tools.connector.noNeedCredential")}
              </Button>
            }
            {currentConnector.has_credential && currentConnector.mcpServers.enabled && currentConnector.status === "unauthorized" && !_isReAuthorizing &&
              <Button
                theme="Color"
                color="primary"
                size="medium"
                onClick={handleConnector}
                loading={isSubmitting}
                disabled={currentConnector.isError?.isError || isSubmitting}
              >
                {t("tools.connector.connect")}
              </Button>
            }
            {currentConnector.has_credential && currentConnector.mcpServers.enabled && currentConnector.status === "running" && !_isReAuthorizing &&
              <Button
                theme="Color"
                color="neutralGray"
                size="medium"
                onClick={handleConnector}
                loading={isSubmitting}
                disabled={currentConnector.isError?.isError || isSubmitting}
              >
                {t("tools.connector.disconnect")}
              </Button>
            }
          </>
          }
        </div>
        }
      >
        <div className="tool-edit-popup-header">
          <Button
            theme="TextOnly"
            color="success"
            size="small"
            shape="pill"
            svgFill="none"
            onClick={onCancel}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="22" height="22">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5"></path>
            </svg>
          </Button>
          Connector
        </div>
        <div className="tool-edit-popup">
          {ConnectorList}
          <div className="tool-edit-popup-content">
            <div className="tool-edit-header">
              <span className="tool-edit-header-title">{connectorTitle(type)}</span>
                <Tooltip content={t("chat.reAuthorize.stopChange")} side="bottom" disabled={!_isReAuthorizing}>
                  <div className="tool-edit-header-actions">
                    {type === "edit" && !isChanging &&
                      <Switch
                        disabled={_isReAuthorizing}
                        checked={currentConnector?.mcpServers.enabled || false}
                        onChange={handleToggle}
                        color={(currentConnector?.mcpServers.enabled && currentConnector.status !== "running") ? "danger" : "primary"}
                      />
                    }
                  </div>
              </Tooltip>
            </div>
            <div className="tool-edit-content">
              {ConnectorField}
            </div>
          </div>
        </div>
      </PopupConfirm>

      {showUnSavePopup && (
        <PopupConfirm
          noBorder
          className="unsaved-popup"
          footerType="center"
          zIndex={1000}
          onConfirm={() => {
            setShowUnSavePopup(false)
            handleSubmit()
          }}
          onCancel={() => {
            setShowUnSavePopup(false)
          }}
          confirmText={t("tools.unsaved.save")}
          cancelText={t("tools.unsaved.cancel")}
        >
          <div className="unsaved-content">
            <div className="unsaved-header">
              {t("tools.unsaved.title")}
            </div>
            <div className="unsaved-desc">
              {t("tools.unsaved.desc")}
            </div>
          </div>
        </PopupConfirm>
      )}

      {showUnSaveErrorPopup && (
        <PopupConfirm
          noBorder
          className="unsaved-popup"
          footerType="center"
          zIndex={1000}
          onCancel={() => {
            setShowUnSaveErrorPopup(false)
          }}
          cancelText={t("tools.unsaved.cancel")}
        >
          <div className="unsaved-content">
            <div className="unsaved-header">
              {t("tools.unsaved.errorTitle")}
            </div>
            <div className="unsaved-desc">
              {t("tools.unsaved.errorDesc")}
            </div>
          </div>
        </PopupConfirm>
      )}
    </>
  )
})

export default React.memo(ConnectorEdit)