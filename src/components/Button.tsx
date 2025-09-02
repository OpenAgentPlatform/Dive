import React, { forwardRef } from "react"
import "@/styles/components/_Button.scss"

interface Props{
  type?: "button" | "submit" | "reset"
  children: React.ReactNode
  color?: "white" | "gray" | "success-green" | "green" | "blue"
  size?: "fit" | "normal" | "full" | "round"
  padding?: "xxs" | "xs" | "s" | "n" | "l" | "xl" | "xxl"
  border?: "none" | "normal"
  minHeight?: string
  className?: string
  disabled?: boolean
  loading?: boolean
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
}

const Button = forwardRef<HTMLButtonElement, Props>(({
  type = "button",
  children,
  color = "white",
  size = "normal",
  padding = "n",
  border = "normal",
  minHeight,
  className = "",
  disabled = false,
  loading = false,
  onClick,
  ...rest
}, ref) => {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={`custom-button ${className} ${color} ${size} padding-${padding} border-${border} ${disabled ? "disabled" : ""} ${loading ? "loading" : ""}`}
      style={{ minHeight: minHeight || "" }}
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