import { atom } from "jotai"

export type ThemeType = "system" | "light" | "dark"

export const systemThemeAtom = atom<"light" | "dark">(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
export const userThemeAtom = atom<ThemeType>(localStorage.getItem("theme") as ThemeType || "system")

export const themeAtom = atom<ThemeType>(get => {
  const userTheme = get(userThemeAtom)
  if (userTheme === "system" || !userTheme) {
    return get(systemThemeAtom)
  }

  return userTheme
})

export const setThemeAtom = atom(
  null,
  (get, set, theme: ThemeType) => {
    set(userThemeAtom, theme)
    localStorage.setItem("theme", theme)
  }
)