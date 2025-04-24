import { useAtomValue, useSetAtom } from "jotai"
import { ThemeType, setThemeAtom, userThemeAtom } from "../atoms/themeState"

const ThemeSwitch = () => {
  const theme = useAtomValue(userThemeAtom)
  const setTheme = useSetAtom(setThemeAtom)

  const updateThemeColor = (theme: ThemeType) => {
    setTheme(theme)
    const themeColor = theme === "dark" ? "#1E1E28" : "#FFFFFF"
    document.querySelector("meta[name='theme-color']")?.setAttribute("content", themeColor)
  }

  const Themes = [
    {label: "Default", value: "system", icon:
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g id="system-mode">
          <rect id="Rectangle 5880" x="4" y="4" width="14" height="14" rx="7" stroke="currentColor" strokeWidth="2"/>
          <path id="Vector 75" d="M11 17V4.99999C11 4.99999 17 4.33294 17 11C17 17.667 11 17 11 17Z" fill="currentColor"/>
        </g>
      </svg>
    },
    {label: "Light", value: "light",icon:
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g id="light-mode">
          <path id="Vector 80" d="M11 4L11 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path id="Vector 84" d="M15.9498 6.0502L17.364 4.63599" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path id="Vector 81" d="M18 11H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path id="Vector 85" d="M15.9498 15.9498L17.364 17.364" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path id="Vector 82" d="M11 20L11 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path id="Vector 86" d="M4.63608 17.3639L6.05029 15.9497" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path id="Vector 83" d="M2 11H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path id="Vector 87" d="M4.63608 4.63608L6.05029 6.05029" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <rect id="Rectangle 5880" x="5" y="5" width="12" height="12" rx="6" stroke="currentColor" strokeWidth="2"/>
        </g>
      </svg>
      },
    {label: "Dark", value: "dark",icon:
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g id="dark-mode">
          <g id="Subtract">
          <mask id="path-1-inside-1_12614_101089" fill="white">
          <path fillRule="evenodd" clipRule="evenodd" d="M11.5502 3.01862C12.0871 3.05509 12.1986 3.80144 11.818 4.18198C10.0607 5.93934 10.0607 8.78858 11.818 10.5459C13.5754 12.3033 16.4246 12.3033 18.182 10.5459C18.4592 10.2687 18.9866 10.3907 18.9971 10.7826C18.999 10.8548 19 10.9273 19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C11.1849 3 11.3684 3.00627 11.5502 3.01862Z"/>
          </mask>
          <path d="M11.818 10.5459L13.2322 9.13173L13.2322 9.13173L11.818 10.5459ZM18.182 10.5459L16.7678 9.13173L16.7678 9.13173L18.182 10.5459ZM18.9971 10.7826L16.9978 10.8359L18.9971 10.7826ZM11.818 4.18198L13.2322 5.59619L13.2322 5.59619L11.818 4.18198ZM13.2322 9.13173C12.2559 8.15542 12.2559 6.5725 13.2322 5.59619L10.4038 2.76777C7.8654 5.30617 7.8654 9.42175 10.4038 11.9602L13.2322 9.13173ZM16.7678 9.13173C15.7915 10.108 14.2085 10.108 13.2322 9.13173L10.4038 11.9602C12.9422 14.4986 17.0578 14.4986 19.5962 11.9602L16.7678 9.13173ZM16.9978 10.8359C16.9993 10.8904 17 10.9451 17 11H21C21 10.9095 20.9988 10.8192 20.9964 10.7292L16.9978 10.8359ZM17 11C17 14.3137 14.3137 17 11 17V21C16.5228 21 21 16.5228 21 11H17ZM11 17C7.68629 17 5 14.3137 5 11H1C1 16.5228 5.47715 21 11 21V17ZM5 11C5 7.68629 7.68629 5 11 5V1C5.47715 1 1 5.47715 1 11H5ZM11 5C11.1397 5 11.2779 5.00474 11.4146 5.01402L11.6857 1.02322C11.4588 1.00781 11.2302 1 11 1V5ZM19.5962 11.9602C19.1768 12.3795 18.6197 12.4648 18.1735 12.3456C17.679 12.2135 17.0212 11.7111 16.9978 10.8359L20.9964 10.7292C20.9626 9.4622 20.0358 8.70282 19.2057 8.48109C18.4238 8.27227 17.4643 8.43518 16.7678 9.13173L19.5962 11.9602ZM13.2322 5.59619C13.941 4.88745 14.154 3.90841 13.9898 3.08165C13.8146 2.19955 13.0811 1.118 11.6857 1.02322L11.4146 5.01402C11.0607 4.98998 10.7107 4.83268 10.4488 4.56735C10.2078 4.3233 10.1052 4.05575 10.0665 3.8609C9.99708 3.51157 10.0756 3.09597 10.4038 2.76777L13.2322 5.59619Z" fill="currentColor" mask="url(#path-1-inside-1_12614_101089)"/>
          </g>
        </g>
      </svg>
    },
  ]

  return (
    <div className="theme-switch-root">
      { Themes.map((item, index) => {
        return (
          <div
            key={index}
            onClick={() => updateThemeColor(item.value as ThemeType)}
            className={`theme-button ${theme === item.value ? "active" : ""}`}
          >
            {item.icon}
          </div>
        )
      })}
    </div>
  )
}

export default ThemeSwitch