interface Props{
  checked: boolean
  name?: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  disabled?: boolean
  size?: "small" | "normal" | "medium"
  color?: "primary" | "danger"
}

export default function Switch({
  checked,
  name,
  onChange,
  disabled,
  size = "normal",
  color = "primary"
}: Props){
  return (
    <>
      <label className={`switch-label ${disabled ? "disabled" : ""} ${size} ${color}`} htmlFor={name}>
        <input className="switch-input" type="checkbox" id={name} checked={checked} onChange={onChange} disabled={disabled} />
        <span className="switch-slider"></span>
      </label>
    </>
  )
}