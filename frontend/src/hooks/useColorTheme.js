import { useEffect, useState } from 'react'

/** @typedef {'white-on-black' | 'black-on-white' | 'yellow-on-black' | 'green-on-black'} ColorTheme */

/** @typedef {{ background: string, text: string, border: string, surface: string, surfaceHover: string, accent: string, accentHover: string, muted: string }} ThemeColors */

/** @type {Record<ColorTheme, ThemeColors>} */
const THEME_COLORS = {
  'white-on-black': {
    background: '#000000',
    text: '#FFFFFF',
    border: '#FFFFFF',
    surface: '#1a1a1a',
    surfaceHover: '#2a2a2a',
    accent: '#FFFFFF',
    accentHover: '#E0E0E0',
    muted: '#999999',
  },
  'black-on-white': {
    background: '#FFFFFF',
    text: '#000000',
    border: '#000000',
    surface: '#F5F5F5',
    surfaceHover: '#E5E5E5',
    accent: '#000000',
    accentHover: '#333333',
    muted: '#666666',
  },
  'yellow-on-black': {
    background: '#000000',
    text: '#FFFF00',
    border: '#FFFF00',
    surface: '#1a1a00',
    surfaceHover: '#2a2a00',
    accent: '#FFFF00',
    accentHover: '#E0E000',
    muted: '#999900',
  },
  'green-on-black': {
    background: '#000000',
    text: '#00FF00',
    border: '#00FF00',
    surface: '#001a00',
    surfaceHover: '#002a00',
    accent: '#00FF00',
    accentHover: '#00E000',
    muted: '#009900',
  },
}

/**
 * @param {ColorTheme} [initialTheme]
 */
export function useColorTheme(initialTheme = 'white-on-black') {
  const [theme, setTheme] = useState(initialTheme)
  const colors = THEME_COLORS[theme]

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--theme-bg', colors.background)
    root.style.setProperty('--theme-text', colors.text)
    root.style.setProperty('--theme-border', colors.border)
    root.style.setProperty('--theme-surface', colors.surface)
    root.style.setProperty('--theme-surface-hover', colors.surfaceHover)
    root.style.setProperty('--theme-accent', colors.accent)
    root.style.setProperty('--theme-accent-hover', colors.accentHover)
    root.style.setProperty('--theme-muted', colors.muted)
  }, [colors])

  return { theme, setTheme, colors }
}
