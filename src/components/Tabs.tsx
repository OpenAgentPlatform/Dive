import { useEffect, useState, useRef } from "react"
import "@/styles/components/_Tabs.scss"

const Tabs = ({
  tabs,
  value,
  className,
  onChange,
}: {
  tabs: { label: React.ReactNode; value: string }[]
  value: string
  className?: string
  onChange: (value: any) => void
}) => {
  const [index, setIndex] = useState(tabs.findIndex(tab => tab.value === value))
  const [offsetLeft, setOffsetLeft] = useState(0)
  const [offsetWidth, setOffsetWidth] = useState(0)
  const [sliderTop, setSliderTop] = useState(0)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  const handleChange = (index: number) => {
    setIndex(index)
    onChange(tabs[index].value)
  }

  useEffect(() => {
    setOffsetLeft(itemRefs.current[index]?.offsetLeft ?? 0)
    setOffsetWidth(itemRefs.current[index]?.offsetWidth ?? 0)
    if(containerRef.current) {
      const _style = window.getComputedStyle(containerRef.current)
      setSliderTop(parseInt(_style.paddingTop))
    }
  }, [index])

  if(!tabs || tabs.length === 0) {
    return null
  }

  return (
    <div className={`tabs-container ${className}`} ref={containerRef}>
      {tabs.map((tab, _index) => (
        <div
          key={tab.value}
          className={`tabs-item ${value === tab.value ? "active" : ""}`}
          onClick={() => handleChange(_index)}
          ref={el => itemRefs.current[_index] = el}
        >
          {tab.label}
        </div>
      ))}
      <div
        className="tabs-item-slider"
        style={{
          transform: `translateX(${offsetLeft}px)`,
          width: `${offsetWidth}px`,
          top: `${sliderTop}px`
        }}
      />
    </div>
  )
}

export default Tabs