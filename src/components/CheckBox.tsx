import { InputHTMLAttributes, ReactElement, forwardRef } from 'react';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>{
  label?: string | ReactElement
  indeterminate?: boolean
  size?: 'm' | 's'
  hideHover?: boolean
}

function CheckIcon(){
  return (
    <svg viewBox="0 0 17 13" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1.49667 5.99182L6.44109 10.9362L14.8602 2.37127" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IndeterminateIcon(){
  return (
    <svg viewBox="0 0 16 4" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1.58325 2H14.4166" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )
}

const CheckBox = forwardRef<HTMLInputElement, Props>(({
  label,
  indeterminate,
  size = "m",
  hideHover,
  ...rest
}, ref) => {

  const { checked, disabled } = rest

  return (
    <div className={`checkbox-content ${size} ${hideHover ? "hideHover" : ""} ${disabled ? "disabled" : ""}`}>
      <label>
        <div className="touch-area'">
          <input type="checkbox" autoComplete="off" checked={checked} ref={ref} {...rest} />
          <span className="box" data-indeterminate={indeterminate}>
            {checked && (
              indeterminate ? <IndeterminateIcon /> : <CheckIcon />
            )}
          </span>
        </div>
        { label && <>{label}</>}
      </label>
    </div>
  )
})

CheckBox.displayName = "CheckBox"
export default CheckBox
