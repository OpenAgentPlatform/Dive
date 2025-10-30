import React, { forwardRef } from "react"
import "@/styles/components/_Input.scss"
import WrappedInput from "./WrappedInput"

interface Props{
  type?: "text" | "password" | "email" | "number" | "tel" | "url" | "search" | "date" | "time" | "datetime-local" | "month" | "week" | "color" | "file" | "hidden" | "textarea"
  size?: "medium" | "small"
  icon?: React.ReactNode
  icon2?: React.ReactNode
  icon3?: React.ReactNode
  className?: string
  label?: string
  content?: string
  information?: string
  placeholder?: string
  value?: string | number
  disabled?: boolean
  error?: boolean
  readonly?: boolean
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
}

const Input = forwardRef<HTMLInputElement, Props>(({
  type = "text",
  size = "medium",
  icon = null,
  icon2 = null,
  icon3 = null,
  className = "",
  label = "",
  content = "",
  information = "",
  placeholder = "",
  value = "",
  disabled = false,
  error = false,
  readonly = false,
  onChange,
  ...rest
}, ref) => {
  return (
    <div className={`input-container ${size} ${error ? "error" : ""} ${readonly ? "readonly" : ""} ${disabled ? "disabled" : ""} ${className}`}>
      {label && <div className="input-container-label">{label}</div>}
      <div className="input-container-content-wrapper">
        <div className="input-container-left">
          {icon && <div className="input-container-icon">{icon}</div>}
          <WrappedInput
            ref={ref}
            type={type}
            disabled={disabled }
            readOnly={readonly}
            className="input-container-input"
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            {...rest}
          />
        </div>
        <div className="input-container-right">
          {content && <div className="input-container-content">{content}</div>}
          {(icon2 || icon3) && <div className="input-container-icon-wrapper">
            {icon2 && <div className="input-container-icon">{icon2}</div>}
            {icon3 && <div className="input-container-icon">{icon3}</div>}
          </div>}
        </div>
      </div>
      {information && <div className="input-container-information">{information}</div>}
    </div>
  )
})

Input.displayName = "Input"

export default Input