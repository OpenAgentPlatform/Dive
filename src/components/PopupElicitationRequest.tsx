import { useEffect, useCallback, useState, useRef } from "react"
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

type PopupElicitationRequestProps = PopupStylePorps & {
  overlay?: boolean
  requestId: string
  message: string
  requestedSchema: ElicitRequestFormParams["requestedSchema"]
  onRespond: (requestId: string, action: ElicitAction, content?: ElicitContent) => void
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
  // UntitledSingleSelectEnumSchema - has enum array
  if ("enum" in schema && Array.isArray(schema.enum)) {
    return schema.enum.map((value: string) => ({ value, label: value }))
  }

  // TitledSingleSelectEnumSchema - has oneOf array
  if ("oneOf" in schema && Array.isArray(schema.oneOf)) {
    return schema.oneOf.map((option: { const: string; title: string }) => ({
      value: option.const,
      label: option.title,
    }))
  }

  // MultiSelectEnumSchema - has items.enum or items.anyOf
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

// Check if all form fields are boolean type
function isBooleanOnlyForm(properties: Record<string, PrimitiveSchemaDefinition>): boolean {
  const entries = Object.values(properties)
  return entries.length > 0 && entries.every(schema => isBooleanSchema(schema))
}

export default function PopupElicitationRequest({
  overlay,
  requestId,
  message,
  requestedSchema,
  onRespond,
  zIndex,
  noBackground,
  onFinish,
}: PopupElicitationRequestProps) {
  const { t } = useTranslation()
  const formContainerRef = useRef<HTMLDivElement>(null)
  const isBooleanForm = isBooleanOnlyForm(requestedSchema.properties)
  const [formData, setFormData] = useState<NonNullable<ElicitContent>>(() => {
    // Initialize default values for boolean fields
    const defaults: NonNullable<ElicitContent> = {}
    const properties = requestedSchema.properties
    Object.entries(properties).forEach(([key, schema]) => {
      if (isBooleanSchema(schema)) {
        // Default boolean fields to false
        defaults[key] = false
      }
    })
    return defaults
  })

  useEffect(() => {
    // Auto focus the first input element
    const timer = setTimeout(() => {
      if (formContainerRef.current) {
        const firstInput = formContainerRef.current.querySelector<HTMLElement>(
          "input, select, textarea"
        )
        if (firstInput) {
          firstInput.focus()
        }
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  useLayer({
    type: "Modal",
    behavior: Behavior.autoPush,
    onClose: () => {
      onRespond(requestId, "cancel")
      onFinish?.()
    }
  })

  const handleRespond = useCallback((action: ElicitAction) => {
    if (action === "accept") {
      onRespond(requestId, action, formData)
    } else {
      onRespond(requestId, action)
    }
    onFinish?.()
  }, [requestId, onRespond, onFinish, formData])

  const handleInputChange = (key: string, value: string | number | boolean | string[]) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  // Render form fields based on schema
  const renderFormFields = () => {
    const properties = requestedSchema.properties
    const required = requestedSchema.required || []

    return Object.entries(properties).map(([key, schema]) => {
      const isRequired = required.includes(key)
      const label = schema.title || key
      const description = schema.description

      // Handle enum types (single select and multi select)
      if (isEnumSchema(schema)) {
        const options = getEnumOptions(schema)
        const isMultiSelect = isMultiSelectEnum(schema)

        if (isMultiSelect) {
          // Multi-select with checkboxes
          const selectedValues = (formData[key] as string[]) || []
          return (
            <div key={key} style={{ marginBottom: "16px" }}>
              <label style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "14px",
                fontWeight: 500,
                color: "var(--text-strong)"
              }}>
                {label}{isRequired && <span style={{ color: "var(--error)" }}> *</span>}
              </label>
              {description && (
                <div style={{ fontSize: "12px", color: "var(--text-weak)", marginBottom: "6px" }}>
                  {description}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {options.map((option) => (
                  <label key={option.value} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "14px",
                    color: "var(--text-strong)",
                    cursor: "pointer",
                  }}>
                    <input
                      type="checkbox"
                      checked={selectedValues.includes(option.value)}
                      onChange={(e) => {
                        const newValues = e.target.checked
                          ? [...selectedValues, option.value]
                          : selectedValues.filter(v => v !== option.value)
                        handleInputChange(key, newValues)
                      }}
                      style={{ width: "16px", height: "16px" }}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
          )
        }

        // Single select - use radio buttons if options < 5, otherwise use dropdown
        const useRadio = options.length < 5

        if (useRadio) {
          return (
            <div key={key} style={{ marginBottom: "16px" }}>
              <label style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "14px",
                fontWeight: 500,
                color: "var(--text-strong)"
              }}>
                {label}{isRequired && <span style={{ color: "var(--error)" }}> *</span>}
              </label>
              {description && (
                <div style={{ fontSize: "12px", color: "var(--text-weak)", marginBottom: "6px" }}>
                  {description}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {options.map((option) => (
                  <label key={option.value} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "14px",
                    color: "var(--text-strong)",
                    cursor: "pointer",
                  }}>
                    <input
                      type="radio"
                      name={key}
                      value={option.value}
                      checked={(formData[key] as string) === option.value}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      style={{ width: "16px", height: "16px" }}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
          )
        }

        // Single select dropdown
        return (
          <div key={key} style={{ marginBottom: "16px" }}>
            <label style={{
              display: "block",
              marginBottom: "6px",
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--text-strong)"
            }}>
              {label}{isRequired && <span style={{ color: "var(--error)" }}> *</span>}
            </label>
            {description && (
              <div style={{ fontSize: "12px", color: "var(--text-weak)", marginBottom: "6px" }}>
                {description}
              </div>
            )}
            <select
              value={(formData[key] as string) || ""}
              onChange={(e) => handleInputChange(key, e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid var(--text-weak)",
                backgroundColor: "var(--bg-color)",
                color: "var(--text-strong)",
                fontSize: "14px",
              }}
            >
              <option value="" style={{ backgroundColor: "var(--bg-color)", color: "var(--text-strong)" }}>
                {t("chat.elicitation.selectOption")}
              </option>
              {options.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  style={{ backgroundColor: "var(--bg-color)", color: "var(--text-strong)" }}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )
      }

      // Handle boolean type
      if (isBooleanSchema(schema)) {
        return (
          <div key={key} style={{ marginBottom: "16px" }}>
            <label style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--text-strong)",
              cursor: "pointer",
            }}>
              <input
                type="checkbox"
                checked={(formData[key] as boolean) || false}
                onChange={(e) => handleInputChange(key, e.target.checked)}
                style={{ width: "16px", height: "16px" }}
              />
              {label}{isRequired && <span style={{ color: "var(--error)" }}> *</span>}
            </label>
            {description && (
              <div style={{ fontSize: "12px", color: "var(--text-weak)", marginTop: "4px", marginLeft: "24px" }}>
                {description}
              </div>
            )}
          </div>
        )
      }

      // Handle number type
      if (isNumberSchema(schema)) {
        return (
          <div key={key} style={{ marginBottom: "16px" }}>
            <label style={{
              display: "block",
              marginBottom: "6px",
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--text-strong)"
            }}>
              {label}{isRequired && <span style={{ color: "var(--error)" }}> *</span>}
            </label>
            {description && (
              <div style={{ fontSize: "12px", color: "var(--text-weak)", marginBottom: "6px" }}>
                {description}
              </div>
            )}
            <input
              type="number"
              value={(formData[key] as number) ?? ""}
              onChange={(e) => {
                const value = schema.type === "integer"
                  ? parseInt(e.target.value)
                  : parseFloat(e.target.value)
                handleInputChange(key, isNaN(value) ? 0 : value)
              }}
              min={schema.minimum}
              max={schema.maximum}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid var(--text-weak)",
                backgroundColor: "var(--bg-color)",
                color: "var(--text-strong)",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
          </div>
        )
      }

      // Handle string type (default)
      if (isStringSchema(schema)) {
        const inputType = schema.format === "email" ? "email"
          : schema.format === "uri" ? "url"
          : schema.format === "date" ? "date"
          : schema.format === "date-time" ? "datetime-local"
          : schema.format === "password" ? "password"
          : "text"

        return (
          <div key={key} style={{ marginBottom: "16px" }}>
            <label style={{
              display: "block",
              marginBottom: "6px",
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--text-strong)"
            }}>
              {label}{isRequired && <span style={{ color: "var(--error)" }}> *</span>}
            </label>
            {description && (
              <div style={{ fontSize: "12px", color: "var(--text-weak)", marginBottom: "6px" }}>
                {description}
              </div>
            )}
            <input
              type={inputType}
              value={(formData[key] as string) || ""}
              onChange={(e) => handleInputChange(key, e.target.value)}
              minLength={schema.minLength}
              maxLength={schema.maxLength}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid var(--text-weak)",
                backgroundColor: "var(--bg-color)",
                color: "var(--text-strong)",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
          </div>
        )
      }

      // Fallback for unknown schema types
      return (
        <div key={key} style={{ marginBottom: "16px" }}>
          <label style={{
            display: "block",
            marginBottom: "6px",
            fontSize: "14px",
            fontWeight: 500,
            color: "var(--text-strong)"
          }}>
            {label}{isRequired && <span style={{ color: "var(--error)" }}> *</span>}
          </label>
          {description && (
            <div style={{ fontSize: "12px", color: "var(--text-weak)", marginBottom: "6px" }}>
              {description}
            </div>
          )}
          <input
            type="text"
            value={(formData[key] as string) || ""}
            onChange={(e) => handleInputChange(key, e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid var(--text-weak)",
              backgroundColor: "var(--bg-color)",
              color: "var(--text-strong)",
              fontSize: "14px",
              boxSizing: "border-box",
            }}
          />
        </div>
      )
    })
  }

  return (
    <PopupWindow
      overlay={overlay}
      zIndex={zIndex}
      noBackground={noBackground}
      onFinish={onFinish}
    >
      <div className="popup-confirm">
        <div className="popup-confirm-header">
          <h3>{t(isBooleanForm ? "chat.elicitation.confirmTitle" : "chat.elicitation.title")}</h3>
        </div>
        <div className="popup-confirm-content">
          <div style={{ width: "100%", maxWidth: "400px" }}>
            <div style={{
              marginBottom: "20px",
              fontSize: "14px",
              color: "var(--text-medium)",
              lineHeight: 1.5,
            }}>
              {message}
            </div>
            <div ref={formContainerRef}>
              {renderFormFields()}
            </div>
          </div>
        </div>
        <div className="popup-confirm-footer center">
          <div className="popup-confirm-footer-btn" style={{ width: "100%", display: "flex", gap: "8px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Button
                onClick={() => handleRespond("decline")}
                theme="Outline"
                color="neutralGray"
                size="medium"
              >
                {t("chat.elicitation.decline")}
              </Button>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Button
                onClick={() => handleRespond("accept")}
                theme="Color"
                color="primary"
                size="medium"
              >
                {t(isBooleanForm ? "chat.elicitation.confirm" : "chat.elicitation.submit")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </PopupWindow>
  )
}
