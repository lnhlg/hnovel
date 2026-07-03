import { create } from 'zustand'

export type Theme = 'light' | 'dark'

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  initTheme: () => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'dark', // 默认深色，更像 Vela
  setTheme: (theme) => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('novelwriter-theme', theme)
    set({ theme })
  },
  toggleTheme: () => {
    set((state) => {
      const next = state.theme === 'light' ? 'dark' : 'light'
      document.documentElement.setAttribute('data-theme', next)
      localStorage.setItem('novelwriter-theme', next)
      return { theme: next }
    })
  },
  initTheme: () => {
    const stored = localStorage.getItem('novelwriter-theme') as Theme | null
    const theme = stored ?? 'dark'
    document.documentElement.setAttribute('data-theme', theme)
    set({ theme })
  }
}))
