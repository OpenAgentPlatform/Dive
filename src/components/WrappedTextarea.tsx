import React, { forwardRef } from "react"
import TextareaAutosize from "react-textarea-autosize"

const WrappedTextarea = forwardRef<HTMLTextAreaElement, Omit<React.ComponentProps<"textarea">, "style"> & {
  autoheight?: boolean
}>((props, ref) => {
  const { autoheight, ...restProps } = props

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!e.altKey && !e.ctrlKey && !e.metaKey) {
      e.stopPropagation()
    }

    if (props.onKeyDown) {
      props.onKeyDown(e)
    }
  }

  if(autoheight) {
    return (
      <TextareaAutosize
        spellCheck={false}
        {...restProps}
        ref={ref}
        onKeyDown={onKeyDown}
      />
    )
  }

  return (
    <textarea
      spellCheck={false}
      {...restProps}
      ref={ref}
      onKeyDown={onKeyDown}
    />
  )
})

WrappedTextarea.displayName = "WrappedTextarea"

export default React.memo(WrappedTextarea)