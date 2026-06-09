import { useEffect, useState } from 'react'

/**
 * @param {{ message: string, duration?: number, colors: import('../hooks/useColorTheme.js').ThemeColors }} props
 */
export function FeedbackToast({ message, duration = 2000, colors }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
    }, duration)

    return () => clearTimeout(timer)
  }, [duration])

  if (!visible) return null

  return (
    <div
      className="fixed top-20 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg z-[60] animate-fade-in"
      style={{
        backgroundColor: colors.surface,
        color: colors.text,
        border: `2px solid ${colors.border}`,
      }}
    >
      <p className="font-semibold text-center">{message}</p>
    </div>
  )
}
