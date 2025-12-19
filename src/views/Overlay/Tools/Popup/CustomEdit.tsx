//@ts-nocheck
import jsonlint from "jsonlint-mod"
import CodeMirror, { EditorView } from "@uiw/react-codemirror"
import { json } from "@codemirror/lang-json"
import { linter, lintGutter } from "@codemirror/lint"
import { systemThemeAtom, themeAtom } from "../../../../atoms/themeState"
import { mcpServersProps } from ".."
import { MCPConfig, toolsAtom } from "../../../../atoms/toolState"
import { useTranslation } from "react-i18next"
import { useAtomValue, useSetAtom } from "jotai"
import { showToastAtom } from "../../../../atoms/toastState"
import { useState, useEffect, useRef, useMemo } from "react"
import React from "react"
import Tooltip from "../../../../components/Tooltip"
import PopupConfirm from "../../../../components/PopupConfirm"
import Button from "../../../../components/Button"
import Switch from "../../../../components/Switch"
import Input from "../../../../components/Input"
import Select from "../../../../components/Select"

export interface customListProps {
  name: string
  mcpServers: mcpServersProps & Record<string, any>
  jsonString: string
  isError: { isError: boolean, text: string, name?: string }
  isRangeError: { isError: boolean, text: string, fieldKey: string, value: number }
  editing?: boolean
}

interface customEditPopupProps {
  _type: "add" | "add-json" | "edit" | "edit-json"
  _config: Record<string, any>
  _toolName?: string
  onDelete?: (toolName: string) => Promise<void>
  onCancel: () => void
  onSubmit: (config: {mcpServers: MCPConfig}) => Promise<void>
  onAdd: (config: {mcpServers: MCPConfig}) => Promise<void>
  onConnect: (mcp: customListProps) => Promise<void>
  onDisconnect: (mcp: customListProps) => Promise<void>
  toolLog?: Array<LogType>
}

interface LogType {
  body: string
  client_state: string
  event: string
  mcp_server_name: string
  timestamp: string
}

export const FieldType = {
  "enabled": {
    type: "boolean",
    error: "tools.jsonFormatError.booleanError",
    required: false,
  },
  "command": {
    type: "string",
    error: "tools.jsonFormatError.stringError",
    required: false,
  },
  "args": {
    type: "array",
    error: "tools.jsonFormatError.arrayError",
    required: false,
  },
  "env": {
    type: "object",
    error: "tools.jsonFormatError.objectError",
    required: false,
  },
  "headers": {
    type: "object",
    error: "tools.jsonFormatError.objectError",
    required: false,
  },
  "url": {
    type: "string",
    error: "tools.jsonFormatError.stringError",
    required: false,
  },
  "transport": {
    type: "select",
    options: ["stdio", "sse", "streamable", "websocket"] as const,
    error: "tools.jsonFormatError.optionError",
    required: false,
  },
  "initialTimeout": {
    type: "number",
    min: 10,
    minError: "tools.jsonFormatError.minRange",
    maxError: "tools.jsonFormatError.maxRange",
    required: false,
    error: "tools.jsonFormatError.floatError"
  },
  "toolCallTimeout": {
    type: "number",
    default: 600,
    min: 0,
    minError: "tools.jsonFormatError.minRange",
    maxError: "tools.jsonFormatError.maxRange",
    required: false,
    error: "tools.jsonFormatError.floatError"
  }
} as const

interface JsonLintError {
  errorType: "ToolNumber" | "NameEmpty" | "NameExist" | "Required" | "Options" | "FieldType" | "MinRange" | "MaxRange" | "JsonError",
  from: number
  to: number
  message: string
  severity: "error"
}

const emptyCustom = (): customListProps => {
  const _emptyCustom : customListProps = {
    name: "",
    mcpServers: {},
    jsonString: "",
    isError: { isError: false, text: "" },
    isRangeError: { isError: false, text: "", fieldKey: "", value: 0 }
  }

  Object.keys(FieldType).forEach((fieldKey) => {
    if("min" in FieldType[fieldKey as keyof typeof FieldType] && !_emptyCustom.mcpServers[fieldKey]) {
      _emptyCustom.mcpServers[fieldKey] = FieldType[fieldKey as keyof typeof FieldType].min
    }
    if("default" in FieldType[fieldKey as keyof typeof FieldType] && !_emptyCustom.mcpServers[fieldKey]) {
      _emptyCustom.mcpServers[fieldKey] = FieldType[fieldKey as keyof typeof FieldType].default
    }
  })

  return _emptyCustom
}

const CustomEdit = React.memo(({ _type, _config, _toolName, onDelete, onCancel, onSubmit, onConnect, onDisconnect, toolLog }: customEditPopupProps) => {
  const _tools = useAtomValue(toolsAtom)
  const [type, setType] = useState<customEditPopupProps["_type"]>(_type)
  const { t } = useTranslation()
  const [tmpCustom, setTmpCustom] = useState<customListProps>(emptyCustom())
  const [customList, setCustomList] = useState<customListProps[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [isFormatError, setIsFormatError] = useState(false)
  const [isRangeError, setIsRangeError] = useState(false)
  const theme = useAtomValue(themeAtom)
  const systemTheme = useAtomValue(systemThemeAtom)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showToast = useSetAtom(showToastAtom)
  const logContentRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const initialScrollDone = useRef(false)
  const originalCustomListRef = useRef<customListProps[]>([])

  useEffect(() => {
    if(!_config.mcpServers) {
      return
    }
    const newCustomList: customListProps[] = []
    const newConfig = JSON.parse(JSON.stringify(_config))

    // remove disabled field
    Object.keys(newConfig.mcpServers).forEach((toolName) => {
      delete newConfig.mcpServers[toolName].disabled
    })

    Object.keys(newConfig.mcpServers)
    .filter((toolName) => !newConfig.mcpServers[toolName]?.extraData?.oap)
    .sort((a, b) => {
      const aEnabled = newConfig.mcpServers[a]?.enabled
      const bEnabled = newConfig.mcpServers[b]?.enabled
      if (aEnabled && !bEnabled)
        return -1
      if (!aEnabled && bEnabled)
        return 1
      return 0
    })
    .forEach((toolName) => {
      const _tool = _tools.find(tool => tool.name === toolName)
      const newJson = {
        mcpServers: {
          [toolName]: newConfig.mcpServers[toolName]
        }
      }

      newCustomList.push({
        name: toolName,
        mcpServers: encodeMcpServers(newConfig.mcpServers[toolName]),
        jsonString: JSON.stringify(newJson, null, 2),
        isError: { isError: false, text: "" },
        isRangeError: { isError: false, text: "", fieldKey: "", value: 0 },
        has_credential: _tool ? _tool.has_credential : false,
        status: _tool ? _tool.status : "unauthorized"
      })
    })
    handleError(tmpCustom, newCustomList)
    const index = newCustomList.findIndex(mcp => mcp.name === _toolName)
    setCurrentIndex(index)
    setCustomList(newCustomList)
    originalCustomListRef.current = JSON.parse(JSON.stringify(newCustomList))
  }, [])

  useEffect(() => {
    if (initialScrollDone.current || currentIndex < 0 || !listRef.current) {
      return
    }
    // +1 because the first item is "Add" button
    const item = listRef.current.querySelector(`.tool-edit-list-item:nth-child(${currentIndex + 2})`)
    if (item) {
      item.scrollIntoView({ block: "center" })
      initialScrollDone.current = true
    }
  }, [currentIndex, customList])

  useEffect(() => {
    if(!type.includes("add")) {
      return
    }
    try {
      let newTmpCustomServers = JSON.parse(tmpCustom.jsonString)
      if(Object.keys(newTmpCustomServers)[0] === "mcpServers") {
        newTmpCustomServers = newTmpCustomServers.mcpServers
      }
      const newToolNames = Object.keys(newTmpCustomServers)
      let newType = type
      if(newType.includes("add")) {
        try {
          if(newToolNames.length > 1 && type === "add") {
            newType = "add-json"
          } else if(newToolNames.length < 2 && type === "add-json") {
            newType = "add"
          }
        } catch(_e) {
          newType = "add"
        }
      }
      if(newType !== type) {
        setType(newType)
      }
    } catch(_e) {
      setType("add")
    }
  }, [currentIndex])

  useEffect(() => {
    if(logContentRef.current) {
      logContentRef.current.scrollTop = logContentRef.current.scrollHeight
    }
  }, [toolLog])

  const handleError = (newTmpCustom: customListProps, newCustomList: customListProps[]) => {
    try {
      let newTmpCustomServers = {} as Record<string, any>
      if(newTmpCustom.jsonString !== "") {
        newTmpCustomServers = JSON.parse(newTmpCustom.jsonString)
        if(newTmpCustomServers.mcpServers) {
          newTmpCustomServers = newTmpCustomServers.mcpServers
        }
      }
      const newTmpCustomNames = Object.keys(newTmpCustomServers)
      let newTmpCustomError = { isError: false, text: "" } as Record<string, any>
      for(const newTmpCustomName of newTmpCustomNames) {
        // tmpCustomNames are from parsed jsonString, so NO need to check duplicate name in tmpCustom
        const nameError = !isValidName(newCustomList, newTmpCustom, -1, newTmpCustomName)
        const typeError = !isValidType(newTmpCustomServers[newTmpCustomName])
        const fieldError = !isValidField(newTmpCustomServers[newTmpCustomName])
        const requiredError = isValidCommandOrUrl(newTmpCustomServers[newTmpCustomName])
        nameError && console.log("nameError:", newTmpCustomName)
        typeError && console.log("typeError:", newTmpCustomName)
        fieldError && console.log("fieldError:", newTmpCustomName)
        requiredError?.isError && console.log("requiredError:", newTmpCustomName)
        if(nameError) {
          newTmpCustomError = { isError: true, text: "tools.jsonFormatError.nameExist", name: newTmpCustomName }
        } else if(requiredError?.isError) {
          newTmpCustomError = { isError: true, text: "tools.jsonFormatError.requiredError", mcp: newTmpCustomName, fieldKey: requiredError.fieldKey }
        } else if(typeError || fieldError) {
          newTmpCustomError = { isError: true, text: "tools.jsonFormatError.format" }
        }
        if(newTmpCustomError.isError) {
          break
        }
      }
      //separate jsonError for showing other error first
      if(!newTmpCustomError.isError) {
        const jsonError = jsonLinterError(newTmpCustomNames.length < 2 ? "add" : "add-json", newTmpCustom.jsonString, newCustomList, newTmpCustom, -1)
        // jsonError.length > 0 && console.log("jsonError:", jsonError)
        if(jsonError.length > 0) {
          newTmpCustomError = { isError: true, text: "tools.jsonFormatError.jsonError" }
        }
      }
      if(newTmpCustomNames.length === 1) {
        // if there is only one MCP, jsonString will be original tmpCustom.jsonString
        // but mcpServers will be changed, so need to check again
        newTmpCustomError = {
          isError: newTmpCustomError.isError || !isValidField(newTmpCustom.mcpServers),
          text: newTmpCustomError.text || (!isValidField(newTmpCustom.mcpServers) ? "tools.jsonFormatError.format" : ""),
          mcp: newTmpCustomError.mcp,
          fieldKey: newTmpCustomError.fieldKey,
          name: newTmpCustomError.name
        }
      }
      let newTmpCustomRangeError = { isError: false, text: "", fieldKey: "", value: 0 } as Record<string, any>
      for(const newTmpCustomName of newTmpCustomNames) {
        newTmpCustomRangeError = isValidRange(newTmpCustomServers[newTmpCustomName])
        if(newTmpCustomRangeError?.isError) {
          break
        }
      }
      setTmpCustom({
        ...newTmpCustom,
        isError: newTmpCustomError as { isError: boolean, text: string, name?: string, mcp?: string, fieldKey?: string },
        isRangeError: newTmpCustomRangeError as { isError: boolean, text: string, fieldKey: string, value: number }
      })
      newCustomList.forEach((mcp, index) => {
        let newMcpError = { isError: false, text: "" }
        const nameError = !isValidName(newCustomList, newTmpCustom, index, mcp.name)
        const fieldError = !isValidField(mcp.mcpServers)
        const typeError = !isValidType(decodeMcpServers(mcp.mcpServers))
        const toolNumberError = isValidToolNumber("edit", mcp.jsonString)
        const jsonError = jsonLinterError(type, mcp.jsonString, newCustomList, newTmpCustom, index)
        const requiredError = isValidCommandOrUrl(mcp.mcpServers)
        // nameError && console.log("nameError:", mcp.name)
        // typeError && console.log("typeError:", mcp.name)
        // fieldError && console.log("fieldError:", mcp.name)
        // toolNumberError.length > 0 && console.log("toolNumberError:", mcp.name)
        // jsonError.length > 0 && console.log("jsonError:", jsonError)
        if(nameError) {
          newMcpError = { isError: true, text: "tools.jsonFormatError.nameExist" }
        } else if(toolNumberError.length > 0) {
          newMcpError = { isError: true, text: toolNumberError }
        } else if(requiredError?.isError) {
          newMcpError = { isError: true, text: "tools.jsonFormatError.requiredError", mcp: mcp.name, fieldKey: requiredError.fieldKey }
        } else if(typeError || fieldError) {
          newMcpError = { isError: true, text: "tools.jsonFormatError.format" }
        } else if(jsonError.length > 0) {
          newMcpError = { isError: true, text: "tools.jsonFormatError.jsonError" }
        }
        mcp.isError = newMcpError
        mcp.isRangeError = isValidRange(mcp.mcpServers) as { isError: boolean, text: string, fieldKey: string, value: number }
      })
      setCustomList(newCustomList)
    } catch(_e) {
      // console.log("handleError error", _e)
      setTmpCustom({
        ...newTmpCustom,
        isError: { isError: true, text: "tools.jsonFormatError.format" },
        isRangeError: { isError: false, text: "", fieldKey: "", value: 0 }
      })
      newCustomList.forEach((mcp, index) => {
        let newMcpError = { isError: false, text: "" }
        const nameError = !isValidName(newCustomList, newTmpCustom, index, mcp.name)
        const fieldError = !isValidField(mcp.mcpServers)
        const typeError = !isValidType(decodeMcpServers(mcp.mcpServers))
        const toolNumberError = isValidToolNumber("edit", mcp.jsonString)
        const jsonError = jsonLinterError(mcp.jsonString, newCustomList, newTmpCustom, index)
        const requiredError = isValidCommandOrUrl(mcp.mcpServers)
        // nameError && console.log("nameError:", mcp.name)
        // typeError && console.log("typeError:", mcp.name)
        // fieldError && console.log("fieldError:", mcp.name)
        // toolNumberError.length > 0 && console.log("toolNumberError:", mcp.name)
        // jsonError.length > 0 && console.log("jsonError:", jsonError)
        if(nameError) {
          newMcpError = { isError: true, text: "tools.jsonFormatError.nameExist" }
        } else if(toolNumberError.length > 0) {
          newMcpError = { isError: true, text: toolNumberError }
        } else if(requiredError?.isError) {
          newMcpError = { isError: true, text: "tools.jsonFormatError.requiredError", mcp: mcp.name, fieldKey: requiredError.fieldKey }
        } else if(typeError || fieldError || jsonError.length > 0) {
          newMcpError = { isError: true, text: "tools.jsonFormatError.format" }
        }
        mcp.isError = newMcpError
        mcp.isRangeError = isValidRange(mcp.mcpServers) as { isError: boolean, text: string, fieldKey: string, value: number }
      })
      setCustomList(newCustomList)
    }
  }

  const handleCustomChange = (key: string, value: any) => {
    //"add-json" will not show Field, so there is no need to check error of "add-json" in handleCustomChange
    if(type === "add") {
      const newMcpServers = JSON.parse(JSON.stringify(tmpCustom.mcpServers))
      let newName = tmpCustom.name

      if(key === "name") {
        newName = value
      } else {
        if(!FieldType[key].required) {
          if((FieldType[key]?.type === "number" && isNaN(value))
            || ((FieldType[key]?.type === "array" || FieldType[key]?.type === "object") && value.length === 0)
            || (FieldType[key]?.type !== "number" && FieldType[key]?.type !== "array" && !value)) {
            delete newMcpServers[key]
          } else {
            newMcpServers[key] = value
          }
        } else {
          newMcpServers[key] = value
        }
      }

      const newJsonString = { mcpServers: { [newName]: decodeMcpServers(newMcpServers) } }
      const newTmpCustom = {
        name: newName,
        mcpServers: newMcpServers,
        // if field is unValid, there will be error in JSON.stringify, use original tmpCustom.jsonString
        jsonString: isValidField(newMcpServers) ? JSON.stringify(newJsonString, null, 2) : tmpCustom.jsonString,
        editing: isTmpEditing(newName, isValidField(newMcpServers) ? JSON.stringify(newJsonString, null, 2) : tmpCustom.jsonString)
      }
      handleError(newTmpCustom as customListProps, customList)
    } else {
      const newMcpServers = JSON.parse(JSON.stringify(customList[currentIndex].mcpServers))
      let newName = customList[currentIndex].name

      if(key === "name") {
        newName = value
      } else {
        if(!FieldType[key].required) {
          if((FieldType[key]?.type === "number" && isNaN(value))
            || ((FieldType[key]?.type === "array" || FieldType[key]?.type === "object") && value.length === 0)
            || (FieldType[key]?.type !== "number" && FieldType[key]?.type !== "array" && !value)) {
            delete newMcpServers[key]
          } else {
            newMcpServers[key] = value
          }
        } else {
          newMcpServers[key] = value
        }
      }

      const newJsonString = { mcpServers: { [newName]: decodeMcpServers(newMcpServers) } }
      const newCustomList = [...customList]
      const updatedItem = {
        ...newCustomList[currentIndex],
        name: newName,
        mcpServers: newMcpServers,
        jsonString: isValidField(newMcpServers) ? JSON.stringify(newJsonString, null, 2) : newCustomList[currentIndex].jsonString
      }
      newCustomList[currentIndex] = {
        ...updatedItem,
        editing: isEditing(currentIndex, updatedItem)
      }
      handleError(tmpCustom as customListProps, newCustomList)
    }
  }

  const jsonLinterError = (_type: "add" | "add-json" | "edit", jsonString: string, _customList: customListProps[], _tmpCustom: customListProps, _index?: number, _view?: EditorView): JsonLintError[] => {
    const jsonError: JsonLintError[] = []
    try{
      let parsed = jsonlint.parse(jsonString)

      // handle when the json is not start with 'mcpServers' object
      if (Object.keys(parsed)[0] !== "mcpServers") {
        parsed = { mcpServers: parsed }
      }
      const newNames = Object.keys(parsed.mcpServers)

      // "edit" mode: mcpServers must contain exactly one tool
      if (newNames.length !== 1 && _type === "edit") {
        setIsFormatError(true)
        jsonError.push({
          errorType: "ToolNumber",
          from: 0,
          to: jsonString.length,
          message: t("tools.jsonFormatError.toolNumberError"),
          severity: "error",
        })
      }

      // tool name cannot be empty
      if (newNames.some(key => key === "")) {
        setIsFormatError(true)
        jsonError.push({
          errorType: "NameEmpty",
          from: 0,
          to: jsonString.length,
          message: t("tools.jsonFormatError.nameEmpty"),
          severity: "error",
        })
      }

      // Check for duplicate names in customList
      let showDuplicateError
      for(const newName of newNames) {
        // there is NO need to check duplicate name in tmpCustom self
        // because this error will be blocked by parse error
        if(!isValidName(_customList, _tmpCustom, _index ?? currentIndex, newName)) {
          showDuplicateError = newName
          break
        }
      }
      if (showDuplicateError) {
        setIsFormatError(true)
        jsonError.push({
          errorType: "NameExist",
          from: 0,
          to: jsonString.length,
          message: t("tools.jsonFormatError.nameExist", { mcp: showDuplicateError }),
          severity: "error",
        })
      }

      // check field type
      for(const newName of newNames) {
        for(const fieldKey of Object.keys(FieldType) as Array<keyof typeof FieldType>) {
          if(FieldType[fieldKey].required && (!(fieldKey in parsed.mcpServers[newName]) || !parsed.mcpServers[newName])) {
            setIsFormatError(true)
            jsonError.push({
              errorType: "Required",
              from: 0,
              to: jsonString.length,
              message: t("tools.jsonFormatError.requiredError", { mcp: newName, field: fieldKey }),
              severity: "error",
            })
          }
          const fieldType = Array.isArray(parsed.mcpServers[newName][fieldKey]) ? "array" : typeof parsed.mcpServers[newName][fieldKey]
          if(parsed.mcpServers[newName]?.[fieldKey] && FieldType[fieldKey].type === "select") {
            const field = FieldType[fieldKey]
            if("options" in field && !field.options?.includes(parsed.mcpServers[newName][fieldKey])) {
              setIsFormatError(true)
              jsonError.push({
                errorType: "Options",
                from: 0,
                to: jsonString.length,
                message: t(FieldType[fieldKey].error, { mcp: newName, field: fieldKey, options: field.options.flat().join(" / ") }),
                severity: "error",
              })
            }
          } else if(parsed.mcpServers[newName]?.[fieldKey] && FieldType[fieldKey]?.type !== fieldType) {
            setIsFormatError(true)
            jsonError.push({
              errorType: "FieldType",
              from: 0,
              to: jsonString.length,
              message: t(FieldType[fieldKey].error, { mcp: newName, field: fieldKey }),
              severity: "error",
            })
          } else if(FieldType[fieldKey].type === "url") {
            try {
              if(parsed.mcpServers[newName]?.[fieldKey]) {
                new URL(parsed.mcpServers[newName][fieldKey] as string)
              }
            } catch (_err) {
              setIsFormatError(true)
              jsonError.push({
                errorType: "FieldType",
                from: 0,
                to: jsonString.length,
                message: t(FieldType[fieldKey].error, { mcp: newName, field: fieldKey }),
                severity: "error",
              })
            }
          } else if(FieldType[fieldKey].type === "number") {
            if("min" in FieldType[fieldKey] && "minError" in FieldType[fieldKey] && (isNaN(parsed.mcpServers[newName][fieldKey]) || (parsed.mcpServers[newName][fieldKey] as number) < (FieldType[fieldKey] as any).min)) {
              if(!FieldType[fieldKey].required && !(fieldKey in parsed.mcpServers[newName])) {
                continue
              }
              setIsRangeError(true)
              jsonError.push({
                errorType: "MinRange",
                from: 0,
                to: jsonString.length,
                message: t(FieldType[fieldKey].minError, { mcp: newName, field: fieldKey, value: FieldType[fieldKey].min }),
                severity: "error",
              })
            } else if("max" in FieldType[fieldKey] && "maxError" in FieldType[fieldKey] && (parsed.mcpServers[newName][fieldKey] as number) > (FieldType[fieldKey] as any).max) {
              setIsRangeError(true)
              jsonError.push({
                errorType: "MaxRange",
                from: 0,
                to: jsonString.length,
                message: t(FieldType[fieldKey].maxError, { mcp: newName, field: fieldKey, value: FieldType[fieldKey].max }),
                severity: "error",
              })
            }
          }
        }
        const requiredError = isValidCommandOrUrl(parsed.mcpServers[newName])
        if(requiredError?.isError) {
          setIsFormatError(true)
          jsonError.push({
            errorType: "CommandOrUrl",
            from: 0,
            to: jsonString.length,
            message: t(requiredError.text, { mcp: newName, field: requiredError.fieldKey }),
            severity: "error",
          })
        }
      }

      setIsFormatError(false)
      setIsRangeError(false)
      return jsonError as JsonLintError[]
    } catch (e: any) {
      if(jsonString.trim() === "") {
        return jsonError as JsonLintError[]
      }
      if(!_view) {
        jsonError.push({
          from: 0,
          to: jsonString.length,
          message: e.message,
          severity: "error",
          errorType: "JsonError",
        })
        return jsonError as JsonLintError[]
      }
      const lineMatch = e.message.match(/line\s+(\d+)/)
      const line = lineMatch ? parseInt(lineMatch[1]) : 1
      const linePos = _view.state.doc.line(line)
      setIsFormatError(true)

      jsonError.push({
        from: linePos.from,
        to: linePos.to,
        message: e.message,
        severity: "error",
        errorType: "JsonError",
      })
      return jsonError as JsonLintError[]
    }
  }

  // input  : object
  // output : array [[key, value, isError],...]
  const encodeMcpServers = (mcpServers: mcpServersProps & { env?: Record<string, unknown> }) => {
    const newMcpServers = JSON.parse(JSON.stringify(mcpServers))
    Object.keys(newMcpServers).forEach((fieldKey) => {
      if(newMcpServers[fieldKey] && FieldType[fieldKey as keyof typeof FieldType]?.type === "object" && !Array.isArray(newMcpServers[fieldKey])) {
        const newField = Object.entries(newMcpServers[fieldKey])
                              .map(([key, value]) => [key, value, false] as [string, unknown, boolean])
        newMcpServers[fieldKey] = newField
      }
    })
    return newMcpServers
  }

  // input  : array [[key, value, isError],...]
  // output : object
  const decodeMcpServers = (mcpServers: mcpServersProps) => {
    const newMcpServers = JSON.parse(JSON.stringify(mcpServers))
    Object.keys(newMcpServers).forEach((fieldKey) => {
      if(newMcpServers[fieldKey] && FieldType[fieldKey as keyof typeof FieldType]?.type === "object" && Array.isArray(newMcpServers[fieldKey])) {
        newMcpServers[fieldKey] = Object.fromEntries(newMcpServers[fieldKey])
      }
    })
    return newMcpServers
  }

  // check duplicate name in customList
  const isValidName = (_customList: customListProps[], _tmpCustom: customListProps, index: number, newName: string) => {
    let tmpCustomNames: string[] = []
    try {
      let newTmpCustomServers: Record<string, any> = {}
      if(_tmpCustom.jsonString !== "") {
        newTmpCustomServers = JSON.parse(_tmpCustom.jsonString)
        if(newTmpCustomServers.mcpServers) {
          newTmpCustomServers = newTmpCustomServers.mcpServers
        }
      }
      const newTmpCustomNames = Object.keys(newTmpCustomServers)
      tmpCustomNames = newTmpCustomNames
    } catch(_e) {
      tmpCustomNames = []
    }
    return !_customList.some((custom, i) => i !== index && custom.name === newName)
        && (index === -1 || !tmpCustomNames.includes(newName))
  }

  // only allow multiple MCPs in type includes "json"
  const isValidToolNumber = (type: customEditPopupProps["_type"], jsonString: string) => {
    try {
      let newMcpServers = JSON.parse(jsonString)
      if(newMcpServers.mcpServers) {
        newMcpServers = newMcpServers.mcpServers
      }
      if(!type.includes("json") && Object.keys(newMcpServers)?.length !== 1) {
        return "tools.jsonFormatError.toolNumberError"
      }
      if(Object.keys(newMcpServers)?.some(key => key === "")) {
        return "tools.jsonFormatError.nameEmpty"
      }
      return ""
    } catch(_e) {
      if(type === "edit" && jsonString.trim() === "") {
        return "tools.jsonFormatError.nameEmpty"
      }
      return "tools.jsonFormatError.jsonError"
    }
  }

  // check type of SINGLE decoded MCP
  // input  : SINGLE mcpServers
  // output : boolean
  const isValidType = (_newMcpServers: Record<string, any>) => {
    const newMcpServers = decodeMcpServers(_newMcpServers)
    for(const fieldKey of Object.keys(FieldType) as Array<keyof typeof FieldType>) {
      if(FieldType[fieldKey].required && !(fieldKey in newMcpServers)) {
        return false
      }

      if(newMcpServers[fieldKey]) {
        const fieldType = Array.isArray(newMcpServers[fieldKey]) ? "array" : typeof newMcpServers[fieldKey]
        if(FieldType[fieldKey].type === "select") {
          const field = FieldType[fieldKey]
          if("options" in field && !field.options?.includes(newMcpServers[fieldKey])) {
            return false
          }
        } else if(FieldType[fieldKey].typ === "url") {
          try {
            if(newMcpServers[fieldKey]) {
              new URL(newMcpServers[fieldKey] as string)
            }
          } catch (_err) {
            return false
          }
        } else if(FieldType[fieldKey].type !== fieldType) {
          return false
        }
      }
    }
    return true
  }

  // before field transfer to jsonString
  // check field of SINGLE unEncoded mcpServers Object key is valid
  // input  : SINGLE mcpServers
  // output : boolean
  const isValidField = (_newMcpServers: Record<string, any>) => {
    const newMcpServers = encodeMcpServers(_newMcpServers)
    // [key, value, isError]
    try {
      for(const fieldKey of Object.keys(FieldType) as Array<keyof typeof FieldType>) {
        if(newMcpServers[fieldKey]) {
          if(FieldType[fieldKey].type === "object") {
            const keys = newMcpServers[fieldKey].map(([key]: [string]) => key)
            const duplicateIndex = keys.findIndex((key: string, index: number) => keys.indexOf(key) !== index)

            if(duplicateIndex !== -1) {
              newMcpServers[fieldKey][duplicateIndex][2] = true
              return false
            }
          } else if(FieldType[fieldKey].type === "select") {
            const field = FieldType[fieldKey]
            if("options" in field && !field.options?.includes(newMcpServers[fieldKey])) {
              newMcpServers[fieldKey][2] = true
              return false
            }
          }
        }
      }
      return true
    } catch(_e) {
      console.log("isValidField error:", _e)
      return false
    }
  }

  const isValidRange = (value: Record<string, any>, field?: keyof typeof FieldType) => {
    try {
      let newMcpServers = value
      if(newMcpServers.mcpServers) {
        newMcpServers = newMcpServers.mcpServers
      }

      // check value is in range
      // if field is required but not in newMcpServers, this error is in isValidField, not in isValidRange
      for(const fieldKey of Object.keys(FieldType) as Array<keyof typeof FieldType>) {
        if(field && fieldKey !== field) {
          continue
        }
        if(FieldType[fieldKey].type === "number") {
          if(!FieldType[fieldKey].required && !(fieldKey in newMcpServers)) {
            continue
          }
          if("min" in FieldType[fieldKey] && (newMcpServers[fieldKey] ?? 0) < (FieldType[fieldKey].min as number)) {
            if(!FieldType[fieldKey].required && !(fieldKey in newMcpServers)) {
              continue
            }
            return { isError: true, text: "tools.jsonFormatError.minRange", fieldKey: fieldKey, value: FieldType[fieldKey].min as number }
          }
          if("max" in FieldType[fieldKey] && (newMcpServers[fieldKey] ?? 0) > (FieldType[fieldKey].max as number)) {
            return { isError: true, text: "tools.jsonFormatError.maxRange", fieldKey: fieldKey, value: FieldType[fieldKey].max }
          }
        }
      }
      return { isError: false, text: "", fieldKey: "", value: 0 }
    } catch(_e) {
      return { isError: true, text: "", fieldKey: "", value: 0 }
    }
  }

  // Check if command or url is required based on transport type
  const isValidCommandOrUrl = (value: Record<string, any>) => {
    let newMcpServers = value
    if(newMcpServers.mcpServers) {
      newMcpServers = newMcpServers.mcpServers
    }
    // If transport is streamable, check if url is valid
    if(newMcpServers.transport === "streamable" | newMcpServers.transport === "sse") {
      const urlValue = newMcpServers.url?.trim() || ""
      if(!urlValue) {
        return { isError: true, text: `tools.jsonFormatError.urlRequired${newMcpServers.transport}`, fieldKey: "url" }
      }
      try {
        new URL(urlValue)
      } catch (_err) {
        return { isError: true, text: "tools.jsonFormatError.urlInvalid", fieldKey: "url" }
      }
      return { isError: false, text: "", fieldKey: "" }
    }
    // command and url must have at least one non-empty value
    const hasCommand = newMcpServers.command && newMcpServers.command.trim() !== ""
    const hasUrl = newMcpServers.url && newMcpServers.url.trim() !== ""
    if(!hasCommand && !hasUrl) {
      return { isError: true, text: "tools.jsonFormatError.commandOrUrlRequired", fieldKey: "command" }
    }
    return { isError: false, text: "", fieldKey: "" }
  }

  // check if the data is different from the original data
  const isEditing = (index: number, mcp: customListProps) => {
    const original = originalCustomListRef.current[index]
    if (!original) {
      return true
    }
    if (original.name !== mcp.name) {
      return true
    }
    if (original.jsonString !== mcp.jsonString) {
      return true
    }
    return false
  }

  // check if tmpCustom has any content (for add mode)
  const isTmpEditing = (name: string, jsonString: string) => {
    if (name && name.trim() !== "") {
      return true
    }
    if (jsonString && jsonString.trim() !== "" && jsonString.trim() !== "{}" && jsonString.trim() !== "{\n \"mcpServers\":{}\n}") {
      return true
    }
    return false
  }

  const handleConnector = async (mcp: customListProps) => {
    if(mcp.isError?.isError || isSubmitting) {
      return
    }
    try {
      setIsSubmitting(true)
      if(mcp.status === "running") {
        await onDisconnect(mcp.name)
      } else {
        await onConnect(mcp)
      }
    } catch (err) {
      showToast({
        message: err as string,
        type: "error"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async () => {
    try {
      if (customList.some(mcp => mcp.isError.isError || mcp.isRangeError?.isError || isValidCommandOrUrl(mcp.mcpServers).isError)
        || tmpCustom.isError.isError || tmpCustom.isRangeError?.isError)
        return

      const newConfig: {mcpServers: MCPConfig} = { mcpServers: {} }
      if(tmpCustom.jsonString !== "") {
        let processedJsonString = tmpCustom.jsonString.trim()
        if (!processedJsonString.startsWith("{")) {
          processedJsonString = `{${processedJsonString}}`
        }
        let newMcpServers = JSON.parse(processedJsonString)
        if(newMcpServers.mcpServers) {
          newMcpServers = newMcpServers.mcpServers
        }
        newConfig.mcpServers = newMcpServers
      }
      for(const mcp of customList) {
        newConfig.mcpServers[mcp.name] = decodeMcpServers(mcp.mcpServers)
      }

      //clear env empty key
      Object.keys(newConfig.mcpServers).forEach(mcpName => {
        if(newConfig.mcpServers[mcpName].env) {
          newConfig.mcpServers[mcpName].env = Object.entries(newConfig.mcpServers[mcpName].env)
            .reduce((acc, [k, v]) => {
              if(k) {
                acc[k] = v
              }
              return acc
            }, {} as Record<string, any>)
        }
      })

      // add oap servers to newConfig, otherwise "enabled" of oap servers will be reset to true
      const oapServers = Object.keys(_config.mcpServers).filter((mcp: string) => _config.mcpServers[mcp].extraData?.oap)
      for(const oap of oapServers) {
        newConfig.mcpServers[oap] = _config.mcpServers[oap]
      }

      setIsSubmitting(true)
      await onSubmit(newConfig)
    } catch (err) {
      if (err instanceof SyntaxError) {
        showToast({
          message: t("tools.invalidJson"),
          type: "error"
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const mcpNameMask = (name: string, maxLength: number = 18) => {
    return name.length > maxLength ? `${name.slice(0, maxLength)}...` : name
  }

  const CustomList = useMemo(() => {
    if(type === "edit-json") {
      return null
    }

    return (
      <div className="tool-edit-list" ref={listRef}>
        <Tooltip
          disabled={!tmpCustom.isError.isError && !tmpCustom.isRangeError?.isError}
          content={(tmpCustom.isRangeError?.isError && tmpCustom.isRangeError.fieldKey !== "") ? t(tmpCustom.isRangeError.text, { mcp: tmpCustom.name, field: tmpCustom.isRangeError.fieldKey, value: tmpCustom.isRangeError.value }) : t(tmpCustom.isError.text, { mcp: tmpCustom.isError.name ?? tmpCustom.name, field: tmpCustom.isError.fieldKey })}
          side="right"
        >
          <div
            className={`tool-edit-list-item ${(tmpCustom.isError.isError || tmpCustom.isRangeError?.isError) && "error"} ${currentIndex === -1 && type.includes("add") && "active"}`}
            onClick={() => {
              setType("add")
              setCurrentIndex(-1)
            }}
          >
            <div className="tool-edit-list-item-content">
              <div className="left">
                <label>
                  {`+ ${t("tools.custom.listAdd")}`}
                </label>
              </div>
              <div className="right">
                {(tmpCustom.isError.isError || tmpCustom.isRangeError?.isError) ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"></circle>
                    <line x1="12" y1="6" x2="12" y2="14" stroke="currentColor" strokeWidth="2"></line>
                    <circle cx="12" cy="17" r="1.5" fill="currentColor"></circle>
                  </svg>
                ) : (tmpCustom.editing && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M2.72705 12.4257V17.2725H17.2725" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2.72683 12.3623L11.3847 3.7462C12.7266 2.41073 14.9023 2.41073 16.2442 3.7462C17.5862 5.08167 17.5862 7.24688 16.2442 8.58235L7.58639 17.1985" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ))}
              </div>
            </div>
          </div>
        </Tooltip>
        {customList && customList.map((mcp, index) => (
          (mcp.isError?.isError || mcp.isRangeError?.isError) ? (
            <Tooltip
              key={index}
              content={(mcp.isRangeError?.isError && mcp.isRangeError.fieldKey !== "") ? t(mcp.isRangeError.text, { mcp: mcp.name, field: mcp.isRangeError.fieldKey, value: mcp.isRangeError.value }) : t(mcp.isError.text, { mcp: mcp.name, field: mcp.isError.fieldKey })}
              side="right"
            >
              <div
                className={`tool-edit-list-item error ${index === currentIndex ? "active" : ""}`}
                onClick={() => {
                  setType("edit")
                  setCurrentIndex(index)
                }}
              >
                <div className="tool-edit-list-item-content">
                  <div className="left">
                    <label>
                      {mcpNameMask(mcp.name, 18)}
                    </label>
                  </div>
                  <div className="right">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"></circle>
                      <line x1="12" y1="6" x2="12" y2="14" stroke="currentColor" strokeWidth="2"></line>
                      <circle cx="12" cy="17" r="1.5" fill="currentColor"></circle>
                    </svg>
                  </div>
                </div>
              </div>
            </Tooltip>
          ) : (
            <Tooltip
              key={index}
              content={t("tools.connector.listTooltip")}
              disabled={mcp.mcpServers.transport != "streamable" || mcp.editing}
              side="right"
            >
              <div
                key={index}
                className={`tool-edit-list-item ${index === currentIndex ? "active" : ""}`}
                onClick={() => {
                  setType("edit")
                  setCurrentIndex(index)
                }}
              >
                <div className="tool-edit-list-item-content">
                  <div className="left">
                    <label>
                      {mcpNameMask(mcp.name, 21)}
                    </label>
                  </div>
                  <div className="right">
                    {mcp.editing ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M2.72705 12.4257V17.2725H17.2725" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M2.72683 12.3623L11.3847 3.7462C12.7266 2.41073 14.9023 2.41073 16.2442 3.7462C17.5862 5.08167 17.5862 7.24688 16.2442 8.58235L7.58639 17.1985" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      mcp.mcpServers.transport === "streamable" ? (
                        mcp.status === "running" ? (
                          <svg className="success" xmlns="http://www.w3.org/2000/svg" width="20" height="10" viewBox="0 0 20 10" fill="none">
                            <path d="M9 10H5C3.61667 10 2.4375 9.5125 1.4625 8.5375C0.4875 7.5625 0 6.38333 0 5C0 3.61667 0.4875 2.4375 1.4625 1.4625C2.4375 0.4875 3.61667 0 5 0H9V2H5C4.16667 2 3.45833 2.29167 2.875 2.875C2.29167 3.45833 2 4.16667 2 5C2 5.83333 2.29167 6.54167 2.875 7.125C3.45833 7.70833 4.16667 8 5 8H9V10ZM6 6V4H14V6H6ZM11 10V8H15C15.8333 8 16.5417 7.70833 17.125 7.125C17.7083 6.54167 18 5.83333 18 5C18 4.16667 17.7083 3.45833 17.125 2.875C16.5417 2.29167 15.8333 2 15 2H11V0H15C16.3833 0 17.5625 0.4875 18.5375 1.4625C19.5125 2.4375 20 3.61667 20 5C20 6.38333 19.5125 7.5625 18.5375 8.5375C17.5625 9.5125 16.3833 10 15 10H11Z" fill="currentColor"/>
                          </svg>
                        ) : (
                          <svg className={mcp.status === "failed" ? "error" : ""} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 21 20" fill="none">
                            <path d="M17.85 13.65L16.35 12.1C17.0167 11.9167 17.5583 11.5625 17.975 11.0375C18.3917 10.5125 18.6 9.9 18.6 9.2C18.6 8.36667 18.3083 7.65833 17.725 7.075C17.1417 6.49167 16.4333 6.2 15.6 6.2H11.6V4.2H15.6C16.9833 4.2 18.1625 4.6875 19.1375 5.6625C20.1125 6.6375 20.6 7.81667 20.6 9.2C20.6 10.15 20.3542 11.025 19.8625 11.825C19.3708 12.625 18.7 13.2333 17.85 13.65ZM14.45 10.2L12.45 8.2H14.6V10.2H14.45ZM18.4 19.8L0 1.4L1.4 0L19.8 18.4L18.4 19.8ZM9.6 14.2H5.6C4.21667 14.2 3.0375 13.7125 2.0625 12.7375C1.0875 11.7625 0.6 10.5833 0.6 9.2C0.6 8.05 0.95 7.025 1.65 6.125C2.35 5.225 3.25 4.63333 4.35 4.35L6.2 6.2H5.6C4.76667 6.2 4.05833 6.49167 3.475 7.075C2.89167 7.65833 2.6 8.36667 2.6 9.2C2.6 10.0333 2.89167 10.7417 3.475 11.325C4.05833 11.9083 4.76667 12.2 5.6 12.2H9.6V14.2ZM6.6 10.2V8.2H8.225L10.2 10.2H6.6Z" fill="currentColor"/>
                          </svg>
                        )
                      ) : null
                    )}
                  </div>
                </div>
              </div>
            </Tooltip>
          )
        ))}
      </div>
    )
  }, [customList, tmpCustom, currentIndex])

  const Field = useMemo(() => {
    if(type === "edit-json" || type === "add-json") {
      return null
    }

    // wait for customList and currentIndex, so show container first
    if (type !== "add" && (!customList || !customList[currentIndex] || !customList[currentIndex])) {
      return (
        <div className="tool-edit-field"></div>
      )
    }

    let currentMcp: customListProps | undefined
    let currentMcpServers: mcpServersProps | undefined

    if(type.includes("add")) {
      currentMcp = tmpCustom
      currentMcpServers = tmpCustom.mcpServers
    } else {
      currentMcp = customList[currentIndex]
      currentMcpServers = currentMcp?.mcpServers
    }

    const handleObjectChange = (newObject: [string, unknown, boolean][], type: "env" | "headers") => {
      const keys = newObject.map(([key]) => key)
      keys.forEach((key, index) => {
        newObject[index][2] = false
        if(keys.filter(k => k === key).length > 1) {
          newObject[index][2] = true
        }
      })
      handleCustomChange(type, newObject)
    }

    return (
      <div className="tool-edit-field">
        <div className="tool-edit-title">
          {t("tools.fieldTitle")}
          <Tooltip content={t("tools.fieldTitleAlt")} side="bottom" align="start" maxWidth={402}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7.5" stroke="currentColor"/>
              <path d="M8.73 6.64V12H7.85V6.64H8.73ZM8.3 4.63C8.43333 4.63 8.55 4.67667 8.65 4.77C8.75667 4.85667 8.81 4.99667 8.81 5.19C8.81 5.37667 8.75667 5.51667 8.65 5.61C8.55 5.70333 8.43333 5.75 8.3 5.75C8.15333 5.75 8.03 5.70333 7.93 5.61C7.83 5.51667 7.78 5.37667 7.78 5.19C7.78 4.99667 7.83 4.85667 7.93 4.77C8.03 4.67667 8.15333 4.63 8.3 4.63Z" fill="currentColor"/>
            </svg>
          </Tooltip>
        </div>
        <div className="field-content">
          {/* Name */}
          <div className="field-item">
            <label>Name</label>
            <Input
              placeholder={t("tools.namePlaceholder")}
              size="small"
              type="text"
              error={!isValidName(customList, tmpCustom, currentIndex, currentMcp.name)}
              value={currentMcp.name}
              onChange={(e) => handleCustomChange("name", e.target.value)}
            />
          </div>
          {/* Command */}
          <div className="field-item">
            <label>Command</label>
            <div className="key-input-wrapper">
              <Input
                placeholder={t("tools.commandPlaceholder")}
                size="small"
                type="text"
                value={currentMcpServers.command || ""}
                error={currentMcp.name && isValidCommandOrUrl(currentMcpServers)?.isError && isValidCommandOrUrl(currentMcpServers)?.fieldKey === "command"}
                onChange={(e) => handleCustomChange("command", e.target.value)}
              />
              {currentMcp.name && isValidCommandOrUrl(currentMcpServers)?.isError && isValidCommandOrUrl(currentMcpServers)?.fieldKey === "command" ? (
                <Tooltip content={t(isValidCommandOrUrl(currentMcpServers)?.text, { mcp: currentMcp.name })} side="left">
                  <div
                    className="key-input-error"
                    onClick={(e) => {
                      const input = e.currentTarget.parentElement?.parentElement?.querySelector("input")
                      if (input) {
                        input.focus()
                      }
                    }}
                  />
                </Tooltip>
              ) : null}
            </div>
          </div>
          {/* Transport */}
          <div className="field-item">
            <label>Transport</label>
            <Select
              options={FieldType.transport.options.map((option) => ({
                value: option,
                label: (
                    <div className="model-select-label" key={option}>
                      <span className="model-select-label-text">
                        {option}
                      </span>
                    </div>
                  )
                })
              )}
              placeholder={t("tools.transportPlaceholder")}
              value={currentMcpServers.transport ?? FieldType.transport.options[0]}
              onSelect={(value) => handleCustomChange("transport", value)}
            />
          </div>
          {/* Args */}
          <div className="field-item">
            <label>
              <Tooltip content={t("tools.argsTitleAlt")}>
                <div className="field-item-title-label">
                  ARGS
                </div>
              </Tooltip>
              <button onClick={() => handleCustomChange("args", [...(currentMcpServers.args || []), ""])}>
                + {t("tools.addArg")}
              </button>
            </label>
            <div className={`field-item-array ${(currentMcpServers?.args && currentMcpServers.args.length > 0) ? "no-border" : ""}`}>
              {currentMcpServers?.args && currentMcpServers.args.map((arg: string, index: number) => (
                <div key={index} className="field-item-array-item">
                  <Input
                    placeholder={t("tools.argsPlaceholder")}
                    size="small"
                    type="text"
                    value={arg}
                    onChange={(e) => handleCustomChange("args", currentMcpServers.args?.map((arg: string, i: number) => i === index ? e.target.value : arg))}
                  />
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 18 18"
                    width="22"
                    height="22"
                    className="field-item-array-item-clear"
                    onClick={() => handleCustomChange("args", currentMcpServers.args?.filter((_: string, i: number) => i !== index))}
                  >
                    <path stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="m13.91 4.09-9.82 9.82M13.91 13.91 4.09 4.09"></path>
                  </svg>
                </div>
              ))}
            </div>
          </div>
          {/* env */}
          <div className="field-item">
            <label>
              <Tooltip content={t("tools.envTitleAlt")}>
                <div className="field-item-title-label">
                  ENV
                </div>
              </Tooltip>
              <button onClick={() => {
                const newEnv = Array.isArray(currentMcpServers?.env)
                  ? [...currentMcpServers.env]
                  : []
                let index = 0
                while(newEnv.some(([key]) => key === `key${index}`)) {
                  index++
                }
                const nextKey = `key${index}`
                newEnv.push([nextKey, "", false] as [string, unknown, boolean])
                handleObjectChange(newEnv, "env")
              }}>
                + {t("tools.addEnv")}
              </button>
            </label>
            <div className={`field-item-array ${(currentMcpServers?.env && currentMcpServers.env.length > 0) ? "no-border" : ""}`}>
              {(currentMcpServers?.env && currentMcpServers.env.length > 0) && currentMcpServers?.env.map(([envKey, envValue, isError]: [string, unknown, boolean], index: number) => (
                  <div key={index} className="field-item-array-item">
                    <div className="key-input-wrapper">
                      <Input
                        className="env-key"
                        size="small"
                        type="text"
                        placeholder={t("tools.envKey")}
                        value={envKey}
                        error={isError}
                        onChange={(e) => {
                          const newEnv = [...(currentMcpServers.env || [])]
                          newEnv[index][0] = e.target.value
                          newEnv[index][2] = false
                          handleObjectChange(newEnv, "env")
                        }}
                      />
                      {isError ? (
                        <Tooltip content={t("tools.inputKeyError", { name: "ENV" })} side="left">
                          <div
                            className="key-input-error"
                            onClick={(e) => {
                              const input = e.currentTarget.parentElement?.parentElement?.querySelector("input")
                              if (input) {
                                input.focus()
                              }
                            }}
                          />
                        </Tooltip>
                      ) : null}
                    </div>
                    <Input
                      className="env-value"
                      size="small"
                      type="text"
                      placeholder={t("tools.envValue")}
                      value={envValue as string}
                      onChange={(e) => {
                        const newEnv = [...(currentMcpServers.env || [])]
                        newEnv[index][1] = e.target.value
                        newEnv[index][2] = false
                        handleObjectChange(newEnv, "env")
                      }}
                    />
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 18 18"
                      width="22"
                      height="22"
                      className="field-item-array-item-clear"
                      onClick={() => {
                        const newEnv = (currentMcpServers.env || []).filter((_, i) => i !== index)
                        handleObjectChange(newEnv, "env")
                      }}
                    >
                      <path stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="m13.91 4.09-9.82 9.82M13.91 13.91 4.09 4.09"></path>
                    </svg>
                  </div>
              ))}
            </div>
          </div>
          {/* headers */}
          <div className="field-item">
            <label>
              <Tooltip content={t("tools.headersTitleAlt")}>
                <div className="field-item-title-label">
                  HDRS
                </div>
              </Tooltip>
              <button onClick={() => {
                const newHeaders = Array.isArray(currentMcpServers?.headers)
                  ? [...currentMcpServers.headers]
                  : []
                let index = 0
                while(newHeaders.some(([key]) => key === `key${index}`)) {
                  index++
                }
                const nextKey = `key${index}`
                newHeaders.push([nextKey, "", false] as [string, unknown, boolean])
                handleObjectChange(newHeaders, "headers")
              }}>
                + {t("tools.addHeaders")}
              </button>
            </label>
            <div className={`field-item-array ${(currentMcpServers?.headers && currentMcpServers.headers.length > 0) ? "no-border" : ""}`}>
              {(currentMcpServers?.headers && currentMcpServers.headers.length > 0) && currentMcpServers?.headers.map(([headersKey, headersValue, isError]: [string, unknown, boolean], index: number) => (
                  <div key={index} className="field-item-array-item">
                    <div className="key-input-wrapper">
                      <Input
                        className="env-key"
                        size="small"
                        type="text"
                        placeholder={t("tools.headersKey")}
                        value={headersKey}
                        error={isError}
                        onChange={(e) => {
                          const newHeaders = [...(currentMcpServers.headers || [])]
                          newHeaders[index][0] = e.target.value
                          newHeaders[index][2] = false
                          handleObjectChange(newHeaders, "headers")
                        }}
                      />
                      {isError ? (
                        <Tooltip content={t("tools.inputKeyError", { name: "Header" })} side="left">
                          <div
                            className="key-input-error"
                            onClick={(e) => {
                              const input = e.currentTarget.parentElement?.parentElement?.querySelector("input")
                              if (input) {
                                input.focus()
                              }
                            }}
                          />
                        </Tooltip>
                      ) : null}
                    </div>
                    <Input
                      className="env-value"
                      size="small"
                      type="text"
                      placeholder={t("tools.headersValue")}
                      value={headersValue as string}
                      onChange={(e) => {
                        const newHeaders = [...(currentMcpServers.headers || [])]
                        newHeaders[index][1] = e.target.value
                        newHeaders[index][2] = false
                        handleObjectChange(newHeaders, "headers")
                      }}
                    />
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 18 18"
                      width="22"
                      height="22"
                      className="field-item-array-item-clear"
                      onClick={() => {
                        const newHeaders = (currentMcpServers.headers || []).filter((_, i) => i !== index)
                        handleObjectChange(newHeaders, "headers")
                      }}
                    >
                      <path stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="m13.91 4.09-9.82 9.82M13.91 13.91 4.09 4.09"></path>
                    </svg>
                  </div>
              ))}
            </div>
          </div>
          {/* Url */}
          <div className="field-item">
            <label>URL</label>
            <div className="key-input-wrapper">
              <Input
                placeholder={t("tools.urlPlaceholder")}
                size="small"
                type="text"
                value={currentMcpServers.url || ""}
                error={currentMcp.name && isValidCommandOrUrl(currentMcpServers)?.isError && isValidCommandOrUrl(currentMcpServers)?.fieldKey === "url"}
                onChange={(e) => handleCustomChange("url", e.target.value)}
              />
              {currentMcp.name && isValidCommandOrUrl(currentMcpServers)?.isError && isValidCommandOrUrl(currentMcpServers)?.fieldKey === "url" ? (
                <Tooltip content={t(isValidCommandOrUrl(currentMcpServers)?.text, { mcp: currentMcp.name })} side="left">
                  <div
                    className="key-input-error"
                    onClick={(e) => {
                      const input = e.currentTarget.parentElement?.parentElement?.querySelector("input")
                      if (input) {
                        input.focus()
                      }
                    }}
                  />
                </Tooltip>
              ) : null}
            </div>
          </div>
          {/* Initial Timeout (s) */}
          <div className="field-item">
            <div className="field-item-title">
              <label>Initial Timeout (s)</label>
              <Tooltip content={t("tools.initialTimeoutAlt")} side="bottom" align="start" maxWidth={402}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7.5" stroke="currentColor"/>
                  <path d="M8.73 6.64V12H7.85V6.64H8.73ZM8.3 4.63C8.43333 4.63 8.55 4.67667 8.65 4.77C8.75667 4.85667 8.81 4.99667 8.81 5.19C8.81 5.37667 8.75667 5.51667 8.65 5.61C8.55 5.70333 8.43333 5.75 8.3 5.75C8.15333 5.75 8.03 5.70333 7.93 5.61C7.83 5.51667 7.78 5.37667 7.78 5.19C7.78 4.99667 7.83 4.85667 7.93 4.77C8.03 4.67667 8.15333 4.63 8.3 4.63Z" fill="currentColor"/>
                </svg>
              </Tooltip>
            </div>
            <div className="key-input-wrapper">
              <Input
                placeholder={t("tools.initialTimeoutPlaceholder")}
                size="small"
                type="number"
                value={currentMcpServers.initialTimeout}
                error={isValidRange(currentMcpServers, "initialTimeout")?.isError}
                onChange={(e) => handleCustomChange("initialTimeout", parseFloat(e.target.value))}
              />
              {isValidRange(currentMcpServers, "initialTimeout")?.isError ? (
                <Tooltip content={t("tools.initialTimeoutError")} side="left">
                  <div
                    className="key-input-error"
                    onClick={(e) => {
                      const input = e.currentTarget.parentElement?.parentElement?.querySelector("input")
                      if (input) {
                        input.focus()
                      }
                    }}
                  />
                </Tooltip>
              ) : null}
            </div>
          </div>
          {/* Tool call Timeout (m) */}
          <div className="field-item">
            <div className="field-item-title">
              <label>Tool call Timeout (s)</label>
              <Tooltip content={t("tools.toolCallTimeoutAlt")} side="bottom" align="start" maxWidth={402}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7.5" stroke="currentColor"/>
                  <path d="M8.73 6.64V12H7.85V6.64H8.73ZM8.3 4.63C8.43333 4.63 8.55 4.67667 8.65 4.77C8.75667 4.85667 8.81 4.99667 8.81 5.19C8.81 5.37667 8.75667 5.51667 8.65 5.61C8.55 5.70333 8.43333 5.75 8.3 5.75C8.15333 5.75 8.03 5.70333 7.93 5.61C7.83 5.51667 7.78 5.37667 7.78 5.19C7.78 4.99667 7.83 4.85667 7.93 4.77C8.03 4.67667 8.15333 4.63 8.3 4.63Z" fill="currentColor"/>
                </svg>
              </Tooltip>
            </div>
            <div className="key-input-wrapper">
              <Input
                placeholder={t("tools.toolCallTimeoutPlaceholder")}
                size="small"
                type="number"
                value={currentMcpServers.toolCallTimeout}
                error={isValidRange(currentMcpServers, "toolCallTimeout")?.isError}
                onChange={(e) => handleCustomChange("toolCallTimeout", parseFloat(e.target.value))}
              />
              {isValidRange(currentMcpServers, "toolCallTimeout")?.isError ? (
                <Tooltip content={t("tools.toolCallTimeoutError")} side="left">
                  <div
                    className="key-input-error"
                    onClick={(e) => {
                      const input = e.currentTarget.parentElement?.parentElement?.querySelector("input")
                      if (input) {
                        input.focus()
                      }
                    }}
                  />
                </Tooltip>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    )
  }, [customList, tmpCustom, currentIndex, type])

  const JSONEditor = useMemo(() => {
    const copyJson = () => {
      navigator.clipboard.writeText(customList[currentIndex]?.jsonString)
      showToast({
        message: t("tools.jsonCopied"),
        type: "success"
      })
    }

    const downloadJson = () => {
      const blob = new Blob([customList[currentIndex]?.jsonString], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${customList[currentIndex]?.name?.length > 0 ? "mcpServers-"+customList[currentIndex]?.name : "mcpServers"}.json`
      a.click()
    }

    const inputTheme = EditorView.theme({
      ".cm-content": {
        color: "var(--text-strong)",
        paddingBottom: "10px",
      },
      ".cm-lineNumbers": {
        color: "var(--text-strong)",
      },
      ".cm-gutters": {
        paddingBottom: "10px",
      }
    })

    const createJsonLinter = () => {
      return linter((view) => {
        const doc = view.state.doc.toString()
        if (!doc.trim())
          return []

        return jsonLinterError(type, doc, customList, tmpCustom, currentIndex, view)
      })
    }

    const handleJsonChangeCustom = async (value: string) => {
      let newType = type
      try {
        let newJson = jsonlint.parse(value)
        if(Object.keys(newJson)[0] !== "mcpServers") {
          newJson = { mcpServers: newJson }
        }
        const newMcpServers = newJson.mcpServers
        const newMcpNames = Object.keys(newMcpServers)
        if(newType.includes("add")) {
          try {
            if(newMcpNames.length > 1 && type === "add") {
              newType = "add-json"
            } else if(newMcpNames.length < 2 && type === "add-json") {
              newType = "add"
            }
          } catch(_e) {
            newType = "add"
          }
        }
        setType(newType)
        if(newType === "add-json") {
          const newTmpCustom = emptyCustom()
          newTmpCustom.jsonString = value
          newTmpCustom.editing = isTmpEditing("", value)
          handleError(newTmpCustom as customListProps, customList)
        } else if(newType === "add") {
          for(const fieldKey of Object.keys(FieldType) as Array<keyof typeof FieldType>) {
            if("min" in FieldType[fieldKey] && !(fieldKey in newMcpServers[newMcpNames[0]])) {
              newMcpServers[newMcpNames[0]][fieldKey] = FieldType[fieldKey].min
            }
          }
          // If the only error is NameExist or CommandOrUrl, syncing data between the field and the JSON editor should still be allowed.
          // Because when the NameExist error is fixed, it can't decide which data should be recovered and which should be overwritten.
          const jsonError = jsonLinterError(newType, value, customList, tmpCustom, currentIndex)
          const allowSync = jsonError.length === 0 || (jsonError.length === 1 && (jsonError[0].errorType === "NameExist" || jsonError[0].errorType === "CommandOrUrl"))
          const newName = allowSync ? (newMcpNames[0] ?? "") : tmpCustom.name
          const newTmpCustom = {
            jsonString: value,
            name: newName,
            mcpServers: allowSync ? encodeMcpServers(newMcpServers[newMcpNames[0]]) : tmpCustom.mcpServers,
            editing: isTmpEditing(newName, value)
          }
          handleError(newTmpCustom as customListProps, customList)
        } else {
          const jsonError = jsonLinterError(newType, value, customList, tmpCustom, currentIndex)
          const allowSync = jsonError.length === 0 || (jsonError.length === 1 && (jsonError[0].errorType === "NameExist" || jsonError[0].errorType === "CommandOrUrl"))
          const newCustomList = [...customList]
          const updatedItem = {
            ...newCustomList[currentIndex],
            jsonString: value,
            name: newMcpNames[0],
            mcpServers: allowSync ? encodeMcpServers(newMcpServers[newMcpNames[0]]) : newCustomList[currentIndex].mcpServers
          }
          newCustomList[currentIndex] = {
            ...updatedItem,
            editing: isEditing(currentIndex, updatedItem)
          }
          handleError(tmpCustom as customListProps, newCustomList)
        }
      } catch(_e) {
        console.log("error:", _e)
        if(newType === "add-json") {
          newType = "add"
        }
        setType(newType)
        if(newType === "add") {
          let newTmpCustom
          if(value.trim() === "") {
            newTmpCustom = emptyCustom()
            newTmpCustom.jsonString = value
            newTmpCustom.editing = false
          } else {
            newTmpCustom = {
              ...tmpCustom,
              jsonString: value,
              editing: isTmpEditing(tmpCustom.name, value)
            }
          }
          handleError(newTmpCustom as customListProps, customList)
        } else {
          const newCustomList = [...customList]
          const updatedItem = {
            ...newCustomList[currentIndex],
            jsonString: value
          }
          newCustomList[currentIndex] = {
            ...updatedItem,
            editing: isEditing(currentIndex, updatedItem)
          }
          handleError(tmpCustom, newCustomList)
        }
      }
    }

    const logTime = (timestamp: string) => {
      const date = new Date(timestamp)
      return date.toLocaleString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      })
    }

    return (
      <div className={`tool-edit-json-editor ${type} ${(toolLog && toolLog.length > 0) ? "submitting" : ""}`}>
        <div className="tool-edit-title">
          JSON
          <div className="tool-edit-desc">
            {t("tools.jsonDesc")}
          </div>
        </div>
        <div className="tool-edit-json-editor-wrap">
          <CodeMirror
            minWidth={(type === "edit-json" || type === "add-json") ? "670px" : "400px"}
            placeholder={"{\n \"mcpServers\":{}\n}"}
            theme={theme === "system" ? systemTheme : theme}
            value={type.includes("add") ? tmpCustom.jsonString : customList[currentIndex]?.jsonString}
            extensions={[
              json(),
              lintGutter(),
              createJsonLinter(),
              inputTheme
            ]}
            onChange={(value) => {
              let newJsonString = value
              if(!value.trim().startsWith("{") && value.trim().length > 0) {
                newJsonString = `{\n ${value}\n}`
              }
              handleJsonChangeCustom(newJsonString)
            }}
          />
          <div className="tool-edit-json-editor-copy">
            <Tooltip
              content={t("tools.jsonCopy")}
              side="bottom"
            >
              <div onClick={copyJson}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18px" height="18px" viewBox="0 0 22 22" fill="transparent">
                  <path d="M13 20H2V6H10.2498L13 8.80032V20Z" fill="transparent" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinejoin="round"/>
                  <path d="M13 9H10V6L13 9Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 3.5V2H17.2498L20 4.80032V16H16" fill="transparent" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinejoin="round"/>
                  <path d="M20 5H17V2L20 5Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </Tooltip>
            <Tooltip
              content={t("tools.jsonDownload")}
              side="bottom"
            >
              <div onClick={downloadJson}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 1.81836L10 12.7275" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M6.33105 9.12305L9.99973 12.7917L13.6684 9.12305" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2.72754 13.6367V16.2731C2.72754 16.8254 3.17526 17.2731 3.72754 17.2731H16.273C16.8253 17.2731 17.273 16.8254 17.273 16.2731V13.6367" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </Tooltip>
          </div>
        </div>
        {toolLog && toolLog.length > 0 &&
          <div className="tool-edit-json-editor-log">
            <div className="tool-edit-json-editor-log-title">
              {t("tools.logTitle")}
              <div className="tool-edit-json-editor-log-title-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="17" viewBox="0 0 14 17" fill="none">
                  <path d="M0.502643 8.22159C0.502643 8.49773 0.726501 8.72159 1.00264 8.72159C1.27879 8.72159 1.50264 8.49773 1.50264 8.22159L0.502643 8.22159ZM12.9297 6.58454L11.8635 0.910342L7.48259 4.67079L12.9297 6.58454ZM1.00264 8.22159L1.50264 8.22159C1.50264 5.37117 3.81769 2.875 6.61537 2.875L6.61537 2.375L6.61537 1.875C3.21341 1.875 0.502643 4.87236 0.502643 8.22159L1.00264 8.22159ZM6.61537 2.375L6.61537 2.875C7.89483 2.875 8.9093 3.12599 9.75157 3.60453L9.99857 3.1698L10.2456 2.73507C9.22264 2.15388 8.02979 1.875 6.61537 1.875L6.61537 2.375Z" fill="currentColor"/>
                  <path d="M13.427 8.77841C13.427 8.50227 13.2032 8.27841 12.927 8.27841C12.6509 8.27841 12.427 8.50227 12.427 8.77841L13.427 8.77841ZM1 10.4155L2.06619 16.0897L6.4471 12.3292L1 10.4155ZM12.927 8.77841L12.427 8.77841C12.427 11.6288 10.112 14.125 7.31432 14.125L7.31432 14.625L7.31432 15.125C10.7163 15.125 13.427 12.1276 13.427 8.77841L12.927 8.77841ZM7.31432 14.625L7.31432 14.125C6.03486 14.125 5.02039 13.874 4.17811 13.3955L3.93112 13.8302L3.68412 14.2649C4.70705 14.8461 5.8999 15.125 7.31432 15.125L7.31432 14.625Z" fill="currentColor"/>
                </svg>
                {t("tools.logProcessing")}
              </div>
            </div>
            <div className="tool-edit-json-editor-log-content" ref={logContentRef}>
              {toolLog?.map((log, index) => (
                <div className="log-entry" key={index}>
                  <span className="timestamp">[{logTime(log.timestamp)}]</span>
                  <span className="debug-label">[{log.event}]</span>
                  <span className="log-mcp-server-name">"{log.mcp_server_name}"</span>
                  <span className="log-content">{log.body}</span>
                </div>
              ))}
              <div className="log-dots"></div>
            </div>
          </div>
        }
      </div>
    )
  }, [theme, systemTheme, customList, tmpCustom, currentIndex, type, toolLog, isSubmitting])

  const customTitle = (type: string) => {
    switch(type) {
      case "edit":
        return t("tools.custom.titleEdit", { tool: customList[currentIndex]?.name })
      case "add":
        case "add-json":
        return t("tools.custom.titleAdd")
      case "edit-json":
        return t("tools.custom.titleEditJson")
    }
  }

  return (
    <PopupConfirm
      overlay
      className={`tool-edit-popup-container ${type}`}
      onConfirm={handleSubmit}
      onCancel={onCancel}
      disabled={isFormatError || isRangeError || tmpCustom.isError?.isError || tmpCustom.isRangeError?.isError || customList.some(custom => custom.isError?.isError || custom.isRangeError?.isError) || isSubmitting}
      zIndex={1000}
      listenHotkey={false}
      confirmText={isSubmitting ? (
        <div className="loading-spinner"></div>
      ) : t("tools.save")}
      footerHint={ type.startsWith("edit") &&
        <div className="tool-edit-popup-footer-hint">
          {onDelete && !isSubmitting &&
            <Button
              theme="Color"
              color="neutralGray"
              size="medium"
              onClick={() => onDelete(customList[currentIndex]?.name)}
            >
              {t("tools.delete")}
            </Button>
          }
          {customList[currentIndex]?.mcpServers.transport === "streamable" &&
            !customList[currentIndex]?.mcpServers.has_credential &&
            customList[currentIndex]?.status === "running" &&
            !customList[currentIndex]?.editing &&
            <Button
              theme="Color"
              color="neutralGray"
              size="medium"
              disabled={true}
              noFocus
            >
              {t("tools.connector.noNeedCredential")}
            </Button>
          }
          {(customList[currentIndex]?.mcpServers.transport === "streamable" &&
            customList[currentIndex]?.mcpServers.enabled &&
            (customList[currentIndex]?.status != "running" ||
            customList[currentIndex]?.editing)
          ) &&
            <Tooltip
              content={(!customList[currentIndex]?.editing && customList[currentIndex]?.status === "failed") ? t("tools.custom.connectBtnFailed") : t("tools.custom.connectBtnSaveFirst")}
              disabled={!customList.some(custom => custom.isError?.isError || custom.isRangeError?.isError || custom.editing) || customList[currentIndex]?.status === "failed"}
              side="top"
            >
              <Button
                theme="Color"
                color="primary"
                size="medium"
                onClick={() => handleConnector(customList[currentIndex])}
                loading={isSubmitting}
                disabled={isSubmitting || customList.some(custom => custom.isError?.isError || custom.isRangeError?.isError || custom.editing) || customList[currentIndex]?.status === "failed"}
              >
                {t("tools.connector.connect")}
              </Button>
            </Tooltip>
          }
          {customList[currentIndex]?.mcpServers.transport === "streamable" &&
            customList[currentIndex]?.mcpServers.has_credential &&
            customList[currentIndex]?.mcpServers.enabled &&
            customList[currentIndex]?.status === "running" &&
            <Tooltip
              content={t("tools.connector.saveFirst")}
              disabled={!customList.some(custom => custom.isError?.isError || custom.isRangeError?.isError || custom.editing)}
              side="top"
            >
              <Button
                theme="Color"
                color="neutralGray"
                size="medium"
                onClick={() => handleConnector(customList[currentIndex])}
                loading={isSubmitting}
                disabled={isSubmitting || customList.some(custom => custom.isError?.isError || custom.isRangeError?.isError || custom.editing)}
              >
                {t("tools.connector.disconnect")}
              </Button>
            </Tooltip>
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
        {t("tools.custom.headerBtn")}
      </div>
      <div className="tool-edit-popup">
        {CustomList}
        <div className="tool-edit-popup-content">
          <div className="tool-edit-header">
            <span>{customTitle(type)}</span>
            <Tooltip content={t("tools.toogleToolAlt")} side="bottom" disabled={type !== "edit"}>
              <div className="tool-edit-header-actions">
                {type === "edit" &&
                  <Switch
                    checked={customList[currentIndex]?.mcpServers.enabled || false}
                    onChange={() => handleCustomChange("enabled", !customList[currentIndex]?.mcpServers.enabled)}
                  />}
              </div>
            </Tooltip>
          </div>
          <div className="tool-edit-content">
            {Field}
            {JSONEditor}
          </div>
        </div>
      </div>
    </PopupConfirm>
  )
})

export default React.memo(CustomEdit)