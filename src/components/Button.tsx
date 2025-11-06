import React, { forwardRef } from "react"
import "@/styles/components/_Button.scss"

interface Props{
  children: React.ReactNode
  type?: "button" | "submit" | "reset"
  theme?: "Color" | "ColorShadows" | "Outline" | "TextOnly"
  color?: "primary" | "neutral" | "neutralGray" | "success" | "warning" | "danger"
  size?: "large" | "medium" | "small"
  shape?: "pill" | "round" | ""
  svgFill?: "none" | "currentColor"
  noFocus?: boolean
  className?: string
  disabled?: boolean
  loading?: boolean
  active?: boolean
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
}

const Button = forwardRef<HTMLButtonElement, Props>(({
  children,
  type = "button",
  theme = "Color",
  color = "primary",
  size = "medium",
  shape = "",
  svgFill = "currentColor",
  noFocus = false,
  className = "",
  disabled = false,
  loading = false,
  active = false,
  onClick,
  ...rest
}, ref) => {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={`custom-button ${className} ${theme} ${color} ${size} ${shape} ${disabled ? "disabled" : ""} ${loading ? "loading" : ""} ${active ? "active" : ""} ${svgFill ? `svg-fill-${svgFill}` : ""} ${noFocus ? "no-focus" : ""}`}
      onClick={(e) => {
        if (disabled || loading) {
          return
        }
        if (onClick) {
          onClick(e)
        }
      }}
      {...rest}
    >
      {loading ? <div className="loading-spinner"></div> : children}
    </button>
  )
})

Button.displayName = "Button"

export default Button