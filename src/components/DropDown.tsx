import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { forwardRef } from 'react';

export type DropDownOptionType = {
  label: string | React.ReactNode
  icon?: React.ReactNode
  leftSlot?: React.ReactNode,
  rightSlot?: React.ReactNode,
  visible?: boolean
  disabled?: boolean
  onClick?: (e: React.MouseEvent<HTMLElement>) => void
}

type Props = {
  children: React.ReactNode
  placement?: "top" | "right" | "bottom" | "left"
  align?: "center" | "start" | "end"
  options?: DropDownOptionType[]
  content?: React.ReactNode
  contentClassName?: string
  maxHeight?: number
  size?: "m" | "l"
  width?: "auto" | "fill"
  onOpen?: () => void
  onClose?: () => void
}

const Dropdown = forwardRef<HTMLButtonElement|null, Props>(({
  children,
  placement = "bottom",
  align = "end",
  options,
  content,
  contentClassName,
  maxHeight,
  size = "l",
  width,
  onOpen,
  onClose,
  ...rest
}, ref) => {

  return (
    <DropdownMenu.Root
      onOpenChange={(isOpen) => {
        if (isOpen) {
          onOpen?.()
        } else {
          onClose?.()
        }
      }}
    >
      <DropdownMenu.Trigger asChild ref={ref} {...rest} >
        {children}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          style={maxHeight ? {maxHeight: `${maxHeight}px`} : {}}
          align={align}
          side={placement}
          collisionPadding={{ left: 16, right: 16 }}
          className={`dropdown-container-wrapper, dropdown-container-wrapper ${size} ${width === "fill" ? "fill" : ""} ${contentClassName}`}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          { content && content}
          { options && options.map((item, index) => {
            if(item.visible === false){
              return null
            }

            return (
              <DropdownMenu.Item key={index} disabled={item.disabled}>
                <div
                  className={`item ${item.disabled ? "disabled" : ""}`}
                  onClick={item.onClick}
                >
                  { item.leftSlot &&
                    <div className={"left-slot"}>
                      {item.leftSlot}
                    </div>
                  }
                  { item.icon && item.icon}
                  {item.label}
                  { item.rightSlot &&
                    <div className={"right-slot"}>
                      {item.rightSlot}
                    </div>
                  }
                </div>
              </DropdownMenu.Item>
            )
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
})

Dropdown.displayName = "Dropdown"
export default Dropdown
