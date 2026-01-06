import { useCallback, useState, useRef, useEffect } from "react"
import { useTranslation } from "react-i18next"
import type {
  ElicitRequestFormParams,
  ElicitResult,
  PrimitiveSchemaDefinition,
  StringSchema,
  NumberSchema,
  BooleanSchema,
  EnumSchema,
} from "@modelcontextprotocol/sdk/types.js"
import { Behavior, useLayer } from "../hooks/useLayer"
import PopupWindow, { PopupStylePorps } from "./PopupWindow"
import Button from "./Button"

type ElicitAction = ElicitResult["action"]
type ElicitContent = ElicitResult["content"]

interface ElicitationRequest {
  requestId: string
  message: string
  requestedSchema: ElicitRequestFormParams["requestedSchema"]
}

type PopupElicitationListProps = PopupStylePorps & {
  overlay?: boolean
  requests: ElicitationRequest[]
  onRespond: (requestId: string, action: ElicitAction, content?: ElicitContent) => void
  onRespondAll: (action: ElicitAction) => void
  onFinish?: () => void
}

// Type guards for schema types
function isStringSchema(schema: PrimitiveSchemaDefinition): schema is StringSchema {
  return schema.type === "string" && !("enum" in schema) && !("oneOf" in schema)
}

function isNumberSchema(schema: PrimitiveSchemaDefinition): schema is NumberSchema {
  return schema.type === "number" || schema.type === "integer"
}

function isBooleanSchema(schema: PrimitiveSchemaDefinition): schema is BooleanSchema {
  return schema.type === "boolean"
}

function isEnumSchema(schema: PrimitiveSchemaDefinition): schema is EnumSchema {
  return "enum" in schema || "oneOf" in schema || schema.type === "array"
}

// Helper to get enum options from various enum schema types
function getEnumOptions(schema: EnumSchema): Array<{ value: string; label: string }> {
  if ("enum" in schema && Array.isArray(schema.enum)) {
    return schema.enum.map((value: string) => ({ value, label: value }))
  }
  if ("oneOf" in schema && Array.isArray(schema.oneOf)) {
    return schema.oneOf.map((option: { const: string; title: string }) => ({
      value: option.const,
      label: option.title,
    }))
  }
  if (schema.type === "array" && "items" in schema) {
    const items = schema.items
    if ("enum" in items && Array.isArray(items.enum)) {
      return items.enum.map((value: string) => ({ value, label: value }))
    }
    if ("anyOf" in items && Array.isArray(items.anyOf)) {
      return items.anyOf.map((option: { const: string; title?: string }) => ({
        value: option.const,
        label: option.title || option.const,
      }))
    }
  }
  return []
}

function isMultiSelectEnum(schema: EnumSchema): boolean {
  return schema.type === "array"
}

function isBooleanOnlyForm(properties: Record<string, PrimitiveSchemaDefinition>): boolean {
  const entries = Object.values(properties)
  return entries.length > 0 && entries.every(schema => isBooleanSchema(schema))
}

function isEmptyForm(properties: Record<string, PrimitiveSchemaDefinition>): boolean {
  return Object.keys(properties).length === 0
}

// Single elicitation request item component
function ElicitationRequestItem({
  request,
  onRespond,
  isExpanded,
  onToggleExpand,
}: {
  request: ElicitationRequest
  onRespond: (requestId: string, action: ElicitAction, content?: ElicitContent) => void
  isExpanded: boolean
  onToggleExpand: () => void
}) {
  const { t } = useTranslation()
  const formContainerRef = useRef<HTMLDivElement>(null)
  const isBooleanForm = isBooleanOnlyForm(request.requestedSchema.properties)
  const isEmptyFormSchema = isEmptyForm(request.requestedSchema.properties)
  const [formData, setFormData] = useState<NonNullable<ElicitContent>>(() => {
    const defaults: NonNullable<ElicitContent> = {}
    const properties = request.requestedSchema.properties
    Object.entries(properties).forEach(([key, schema]) => {
      if (isBooleanSchema(schema)) {
        defaults[key] = false
      }
    })
    return defaults
  })

  const handleInputChange = (key: string, value: string | number | boolean | string[]) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const handleRespond = useCallback((action: ElicitAction) => {
    if (action === "accept") {
      onRespond(request.requestId, action, formData)
    } else {
      onRespond(request.requestId, action)
    }
  }, [request.requestId, onRespond, formData])

  const renderFormFields = () => {
    const properties = request.requestedSchema.properties
    const required = request.requestedSchema.required || []

    return Object.entries(properties).map(([key, schema]) => {
      const isRequired = required.includes(key)
      const label = schema.title || key
      const description = schema.description

      if (isEnumSchema(schema)) {
        const options = getEnumOptions(schema)
        const isMultiSelect = isMultiSelectEnum(schema)

        if (isMultiSelect) {
          const selectedValues = (formData[key] as string[]) || []
          return (
            <div key={key} style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", marginBottom: "4px", fontSize: "13px", fontWeight: 500, color: "var(--text-strong)" }}>
                {label}{isRequired && <span style={{ color: "var(--error)" }}> *</span>}
              </label>
              {description && <div style={{ fontSize: "11px", color: "var(--text-weak)", marginBottom: "4px" }}>{description}</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {options.map((option) => (
                  <label key={option.value} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--text-strong)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={selectedValues.includes(option.value)}
                      onChange={(e) => {
                        const newValues = e.target.checked ? [...selectedValues, option.value] : selectedValues.filter(v => v !== option.value)
                        handleInputChange(key, newValues)
                      }}
                      style={{ width: "14px", height: "14px" }}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
          )
        }

        const useRadio = options.length < 5
        if (useRadio) {
          return (
            <div key={key} style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", marginBottom: "4px", fontSize: "13px", fontWeight: 500, color: "var(--text-strong)" }}>
                {label}{isRequired && <span style={{ color: "var(--error)" }}> *</span>}
              </label>
              {description && <div style={{ fontSize: "11px", color: "var(--text-weak)", marginBottom: "4px" }}>{description}</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {options.map((option) => (
                  <label key={option.value} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--text-strong)", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name={`${request.requestId}-${key}`}
                      value={option.value}
                      checked={(formData[key] as string) === option.value}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      style={{ width: "14px", height: "14px" }}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
          )
        }

        return (
          <div key={key} style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontSize: "13px", fontWeight: 500, color: "var(--text-strong)" }}>
              {label}{isRequired && <span style={{ color: "var(--error)" }}> *</span>}
            </label>
            {description && <div style={{ fontSize: "11px", color: "var(--text-weak)", marginBottom: "4px" }}>{description}</div>}
            <select
              value={(formData[key] as string) || ""}
              onChange={(e) => handleInputChange(key, e.target.value)}
              style={{ width: "100%", padding: "6px 10px", borderRadius: "4px", border: "1px solid var(--text-weak)", backgroundColor: "var(--bg-color)", color: "var(--text-strong)", fontSize: "13px" }}
            >
              <option value="">{t("chat.elicitation.selectOption")}</option>
              {options.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        )
      }

      if (isBooleanSchema(schema)) {
        return (
          <div key={key} style={{ marginBottom: "12px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 500, color: "var(--text-strong)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={(formData[key] as boolean) || false}
                onChange={(e) => handleInputChange(key, e.target.checked)}
                style={{ width: "14px", height: "14px" }}
              />
              {label}{isRequired && <span style={{ color: "var(--error)" }}> *</span>}
            </label>
            {description && <div style={{ fontSize: "11px", color: "var(--text-weak)", marginTop: "2px", marginLeft: "20px" }}>{description}</div>}
          </div>
        )
      }

      if (isNumberSchema(schema)) {
        return (
          <div key={key} style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontSize: "13px", fontWeight: 500, color: "var(--text-strong)" }}>
              {label}{isRequired && <span style={{ color: "var(--error)" }}> *</span>}
            </label>
            {description && <div style={{ fontSize: "11px", color: "var(--text-weak)", marginBottom: "4px" }}>{description}</div>}
            <input
              type="number"
              value={(formData[key] as number) ?? ""}
              onChange={(e) => {
                const value = schema.type === "integer" ? parseInt(e.target.value) : parseFloat(e.target.value)
                handleInputChange(key, isNaN(value) ? 0 : value)
              }}
              min={schema.minimum}
              max={schema.maximum}
              style={{ width: "100%", padding: "6px 10px", borderRadius: "4px", border: "1px solid var(--text-weak)", backgroundColor: "var(--bg-color)", color: "var(--text-strong)", fontSize: "13px", boxSizing: "border-box" }}
            />
          </div>
        )
      }

      if (isStringSchema(schema)) {
        const inputType = schema.format === "email" ? "email"
          : schema.format === "uri" ? "url"
          : schema.format === "date" ? "date"
          : schema.format === "date-time" ? "datetime-local"
          : schema.format === "password" ? "password"
          : "text"

        return (
          <div key={key} style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontSize: "13px", fontWeight: 500, color: "var(--text-strong)" }}>
              {label}{isRequired && <span style={{ color: "var(--error)" }}> *</span>}
            </label>
            {description && <div style={{ fontSize: "11px", color: "var(--text-weak)", marginBottom: "4px" }}>{description}</div>}
            <input
              type={inputType}
              value={(formData[key] as string) || ""}
              onChange={(e) => handleInputChange(key, e.target.value)}
              minLength={schema.minLength}
              maxLength={schema.maxLength}
              style={{ width: "100%", padding: "6px 10px", borderRadius: "4px", border: "1px solid var(--text-weak)", backgroundColor: "var(--bg-color)", color: "var(--text-strong)", fontSize: "13px", boxSizing: "border-box" }}
            />
          </div>
        )
      }

      return (
        <div key={key} style={{ marginBottom: "12px" }}>
          <label style={{ display: "block", marginBottom: "4px", fontSize: "13px", fontWeight: 500, color: "var(--text-strong)" }}>
            {label}{isRequired && <span style={{ color: "var(--error)" }}> *</span>}
          </label>
          {description && <div style={{ fontSize: "11px", color: "var(--text-weak)", marginBottom: "4px" }}>{description}</div>}
          <input
            type="text"
            value={(formData[key] as string) || ""}
            onChange={(e) => handleInputChange(key, e.target.value)}
            style={{ width: "100%", padding: "6px 10px", borderRadius: "4px", border: "1px solid var(--text-weak)", backgroundColor: "var(--bg-color)", color: "var(--text-strong)", fontSize: "13px", boxSizing: "border-box" }}
          />
        </div>
      )
    })
  }

  return (
    <div style={{
      border: "1px solid var(--border-color)",
      borderRadius: "8px",
      marginBottom: "12px",
      overflow: "hidden",
      backgroundColor: "var(--bg-secondary)",
    }}>
      {/* Header - always visible */}
      <div
        onClick={onToggleExpand}
        style={{
          padding: "12px 16px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: isExpanded ? "var(--bg-tertiary)" : "transparent",
          transition: "background-color 0.2s",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: "14px",
            color: "var(--text-strong)",
            lineHeight: 1.4,
            whiteSpace: isExpanded ? "normal" : "nowrap",
            overflow: isExpanded ? "visible" : "hidden",
            textOverflow: isExpanded ? "clip" : "ellipsis",
          }}>
            {request.message}
          </div>
        </div>
        <div style={{
          marginLeft: "12px",
          transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.2s",
          color: "var(--text-weak)",
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.427 5.427a.75.75 0 0 1 1.06 0L8 7.94l2.513-2.513a.75.75 0 1 1 1.06 1.06l-3.043 3.043a.75.75 0 0 1-1.06 0L4.427 6.487a.75.75 0 0 1 0-1.06z"/>
          </svg>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div style={{ padding: "0 16px 16px" }}>
          {!isEmptyFormSchema && (
            <div ref={formContainerRef} style={{ marginBottom: "12px", maxHeight: "300px", overflowY: "auto" }}>
              {renderFormFields()}
            </div>
          )}
          <div style={{ display: "flex", gap: "8px" }}>
            <Button
              onClick={() => handleRespond("decline")}
              theme="Outline"
              color="neutralGray"
              size="small"
            >
              {t("chat.elicitation.decline")}
            </Button>
            <Button
              onClick={() => handleRespond("accept")}
              theme="Color"
              color="primary"
              size="small"
            >
              {t(isBooleanForm || isEmptyFormSchema ? "chat.elicitation.confirm" : "chat.elicitation.submit")}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PopupElicitationList({
  overlay,
  requests,
  onRespond,
  onRespondAll,
  zIndex,
  noBackground,
  onFinish,
}: PopupElicitationListProps) {
  const { t } = useTranslation()
  const [expandedIndex, setExpandedIndex] = useState<number>(0)

  useEffect(() => {
    // Auto-expand the first request
    if (requests.length > 0 && expandedIndex >= requests.length) {
      setExpandedIndex(0)
    }
  }, [requests.length, expandedIndex])

  useLayer({
    type: "Modal",
    behavior: Behavior.autoPush,
    onClose: () => {
      onRespondAll("cancel")
      onFinish?.()
    }
  })

  const handleRespondAll = useCallback((action: ElicitAction) => {
    onRespondAll(action)
    onFinish?.()
  }, [onRespondAll, onFinish])

  const handleRespond = useCallback((requestId: string, action: ElicitAction, content?: ElicitContent) => {
    onRespond(requestId, action, content)
    // If we just responded to the expanded item, expand the next one
    const currentIndex = requests.findIndex(r => r.requestId === requestId)
    if (currentIndex === expandedIndex && requests.length > 1) {
      const nextIndex = currentIndex < requests.length - 1 ? currentIndex : currentIndex - 1
      setExpandedIndex(nextIndex)
    }
  }, [onRespond, requests, expandedIndex])

  if (requests.length === 0) {
    return null
  }

  return (
    <PopupWindow
      overlay={overlay}
      zIndex={zIndex}
      noBackground={noBackground}
      onFinish={onFinish}
    >
      <div className="popup-confirm" style={{ maxWidth: "700px", width: "90vw" }}>
        <div className="popup-confirm-header">
          <h3>{t("chat.elicitation.pendingRequests", { count: requests.length })}</h3>
        </div>
        <div className="popup-confirm-content" style={{ maxHeight: "70vh", overflowY: "auto" }}>
          <div style={{ width: "100%" }}>
            {/* Batch action buttons at top */}
            {requests.length > 1 && (
              <div style={{
                display: "flex",
                gap: "8px",
                marginBottom: "16px",
                paddingBottom: "16px",
                borderBottom: "1px solid var(--border-color)",
              }}>
                <Button
                  onClick={() => handleRespondAll("decline")}
                  theme="Outline"
                  color="neutralGray"
                  size="small"
                >
                  {t("chat.elicitation.declineAll")}
                </Button>
                <Button
                  onClick={() => handleRespondAll("accept")}
                  theme="Color"
                  color="primary"
                  size="small"
                >
                  {t("chat.elicitation.acceptAll")}
                </Button>
              </div>
            )}

            {/* List of requests */}
            {requests.map((request, index) => (
              <ElicitationRequestItem
                key={request.requestId}
                request={request}
                onRespond={handleRespond}
                isExpanded={index === expandedIndex}
                onToggleExpand={() => setExpandedIndex(index === expandedIndex ? -1 : index)}
              />
            ))}
          </div>
        </div>
      </div>
    </PopupWindow>
  )
}
