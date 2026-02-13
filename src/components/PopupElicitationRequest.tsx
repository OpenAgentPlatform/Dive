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
import { openUrl } from "../ipc/util"
import { Behavior, useLayer } from "../hooks/useLayer"
import PopupWindow, { PopupStylePorps } from "./PopupWindow"
import Button from "./Button"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { PrismAsyncLight as SyntaxHighlighter } from "react-syntax-highlighter"
import { tomorrow, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism"
import { useAtomValue } from "jotai"
import { themeAtom } from "../atoms/themeState"

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
  const theme = useAtomValue(themeAtom)
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
            <div key={key} className="elicitation-field">
              <label className="elicitation-label">
                {label}{isRequired && <span className="elicitation-required"> *</span>}
              </label>
              {description && (
                <div className="elicitation-description">{description}</div>
              )}
              <div className="elicitation-options">
                {options.map((option) => (
                  <label key={option.value} className="elicitation-option-label">
                    <input
                      type="checkbox"
                      className="elicitation-checkbox"
                      checked={selectedValues.includes(option.value)}
                      onChange={(e) => {
                        const newValues = e.target.checked
                          ? [...selectedValues, option.value]
                          : selectedValues.filter(v => v !== option.value)
                        handleInputChange(key, newValues)
                      }}
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
            <div key={key} className="elicitation-field">
              <label className="elicitation-label">
                {label}{isRequired && <span className="elicitation-required"> *</span>}
              </label>
              {description && (
                <div className="elicitation-description">{description}</div>
              )}
              <div className="elicitation-options">
                {options.map((option) => (
                  <label key={option.value} className="elicitation-option-label">
                    <input
                      type="radio"
                      className="elicitation-radio"
                      name={key}
                      value={option.value}
                      checked={(formData[key] as string) === option.value}
                      onChange={(e) => handleInputChange(key, e.target.value)}
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
          <div key={key} className="elicitation-field">
            <label className="elicitation-label">
              {label}{isRequired && <span className="elicitation-required"> *</span>}
            </label>
            {description && (
              <div className="elicitation-description">{description}</div>
            )}
            <select
              className="elicitation-select"
              value={(formData[key] as string) || ""}
              onChange={(e) => handleInputChange(key, e.target.value)}
            >
              <option value="">
                {t("chat.elicitation.selectOption")}
              </option>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
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
          <div key={key} className="elicitation-field">
            <label className="elicitation-label elicitation-label-inline">
              <input
                type="checkbox"
                className="elicitation-checkbox"
                checked={(formData[key] as boolean) || false}
                onChange={(e) => handleInputChange(key, e.target.checked)}
              />
              {label}{isRequired && <span className="elicitation-required"> *</span>}
            </label>
            {description && (
              <div className="elicitation-description elicitation-description-indent">
                {description}
              </div>
            )}
          </div>
        )
      }

      // Handle number type
      if (isNumberSchema(schema)) {
        return (
          <div key={key} className="elicitation-field">
            <label className="elicitation-label">
              {label}{isRequired && <span className="elicitation-required"> *</span>}
            </label>
            {description && (
              <div className="elicitation-description">{description}</div>
            )}
            <input
              type="number"
              className="elicitation-input"
              value={(formData[key] as number) ?? ""}
              onChange={(e) => {
                const value = schema.type === "integer"
                  ? parseInt(e.target.value)
                  : parseFloat(e.target.value)
                handleInputChange(key, isNaN(value) ? 0 : value)
              }}
              min={schema.minimum}
              max={schema.maximum}
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
          <div key={key} className="elicitation-field">
            <label className="elicitation-label">
              {label}{isRequired && <span className="elicitation-required"> *</span>}
            </label>
            {description && (
              <div className="elicitation-description">{description}</div>
            )}
            <input
              type={inputType}
              className="elicitation-input"
              value={(formData[key] as string) || ""}
              onChange={(e) => handleInputChange(key, e.target.value)}
              minLength={schema.minLength}
              maxLength={schema.maxLength}
            />
          </div>
        )
      }

      // Fallback for unknown schema types
      return (
        <div key={key} className="elicitation-field">
          <label className="elicitation-label">
            {label}{isRequired && <span className="elicitation-required"> *</span>}
          </label>
          {description && (
            <div className="elicitation-description">{description}</div>
          )}
          <input
            type="text"
            className="elicitation-input"
            value={(formData[key] as string) || ""}
            onChange={(e) => handleInputChange(key, e.target.value)}
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
          <div className="elicitation-form-wrapper">
            <div className="elicitation-message">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a({href, children, ...props}) {
                    return (
                      <a
                        {...props}
                        href={href}
                        onClick={(e) => {
                          e.preventDefault()
                          if (href) {
                            openUrl(href)
                          }
                        }}
                      >
                        {children}
                      </a>
                    )
                  },
                  code({node, className, children, ...props}) {
                    const match = /language-(\w+)/.exec(className || "")
                    const language = match ? match[1] : ""
                    const code = String(children).replace(/\n$/, "")
                    const inline = node?.position?.start.line === node?.position?.end.line

                    if (inline) {
                      return <code className={`${className} inline-code`} {...props}>{children}</code>
                    }

                    return (
                      <div className="code-block">
                        <div className="code-header">
                          <span className="language">{language}</span>
                        </div>
                        <SyntaxHighlighter
                          language={language.toLowerCase()}
                          style={theme === "dark" ? tomorrow : oneLight}
                          codeTagProps={{
                            style: {
                              background: "none"
                            }
                          }}
                          customStyle={{
                            margin: 0,
                            padding: "12px",
                            background: "none"
                          }}
                        >
                          {code}
                        </SyntaxHighlighter>
                      </div>
                    )
                  }
                }}
              >
                {message}
              </ReactMarkdown>
            </div>
            <div ref={formContainerRef}>
              {renderFormFields()}
            </div>
          </div>
        </div>
        <div className="popup-confirm-footer center">
          <div className="elicitation-footer-buttons">
            <div className="elicitation-footer-button">
              <Button
                onClick={() => handleRespond("decline")}
                theme="Outline"
                color="neutralGray"
                size="medium"
              >
                {t("chat.elicitation.decline")}
              </Button>
            </div>
            <div className="elicitation-footer-button">
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
