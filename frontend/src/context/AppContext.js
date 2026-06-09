import { createContext, useContext } from 'react'

/** @type {import('react').Context<object | null>} */
export const AppContext = createContext(null)

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) {
    throw new Error('useApp must be used within AppProvider')
  }
  return ctx
}
