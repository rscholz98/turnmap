import { useCallback, useEffect, useState, useSyncExternalStore } from "react"

export type SiteTheme = "light" | "dark" | "system"

const KEY = "turnmap.theme"
const DARK_QUERY = "(prefers-color-scheme: dark)"

function stored(): SiteTheme {
  try {
    const v = localStorage.getItem(KEY)
    return v === "light" || v === "dark" ? v : "system"
  } catch {
    return "system"
  }
}

function subscribeSystemDark(onChange: () => void) {
  const mq = window.matchMedia(DARK_QUERY)
  mq.addEventListener("change", onChange)
  return () => mq.removeEventListener("change", onChange)
}

function readSystemDark() {
  return window.matchMedia(DARK_QUERY).matches
}

export function useTheme() {
  const [theme, setThemeState] = useState<SiteTheme>(stored)
  const systemDark = useSyncExternalStore(subscribeSystemDark, readSystemDark)
  const dark = theme === "dark" || (theme === "system" && systemDark)

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
  }, [dark])

  const setTheme = useCallback((next: SiteTheme) => {
    setThemeState(next)
    try {
      if (next === "system") localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, next)
    } catch {
      // ignore
    }
  }, [])

  const toggle = useCallback(
    () => setTheme(dark ? "light" : "dark"),
    [dark, setTheme]
  )

  return { theme, dark, setTheme, toggle }
}
