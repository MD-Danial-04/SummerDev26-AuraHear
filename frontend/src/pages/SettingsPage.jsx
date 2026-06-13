import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { DeveloperDetails } from '../components/DeveloperDetails.jsx'
import { useApp } from '../context/AppContext.js'
import { useAnnounce } from '../hooks/useAnnounce.js'
import { scaleRem } from '../utils/scaleFont.js'
import { isHorizontalSwipe } from '../utils/swipeGesture.js'

/** @typedef {import('../hooks/useColorTheme.js').ColorTheme} ColorTheme */

const COLOR_THEMES = [
  'white-on-black',
  'black-on-white',
  'yellow-on-black',
  'green-on-black',
]

const THEME_LABELS = {
  'white-on-black': 'WHITE ON BLACK',
  'black-on-white': 'BLACK ON WHITE',
  'yellow-on-black': 'YELLOW ON BLACK',
  'green-on-black': 'GREEN ON BLACK',
}

const THEME_BG = {
  'white-on-black': '#000000',
  'black-on-white': '#FFFFFF',
  'yellow-on-black': '#000000',
  'green-on-black': '#000000',
}

const THEME_FG = {
  'white-on-black': '#FFFFFF',
  'black-on-white': '#000000',
  'yellow-on-black': '#FFFF00',
  'green-on-black': '#00FF00',
}

const PAGES = [
  { key: 'colorTheme', label: 'COLOUR THEME', type: 'cycle', options: COLOR_THEMES },
  {
    key: 'volume',
    label: 'VOLUME',
    type: 'range',
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => `${Math.round(v * 100)}%`,
  },
  {
    key: 'speechRate',
    label: 'SPEECH RATE',
    type: 'range',
    min: 0.5,
    max: 2,
    step: 0.1,
    format: (v) => `${v.toFixed(1)}×`,
  },
  {
    key: 'fontSize',
    label: 'TEXT SIZE',
    type: 'range',
    min: 0.5,
    max: 2,
    step: 0.1,
    format: (v) => `${v.toFixed(1)}×`,
  },
  {
    key: 'voiceEnabled',
    label: 'VOICE COMMANDS',
    type: 'toggle',
    onLabel: 'ON',
    offLabel: 'OFF',
  },
  {
    key: 'hazardMapEnabled',
    label: 'HAZARD MAP',
    type: 'toggle',
    onLabel: 'ON',
    offLabel: 'OFF',
  },
  {
    key: 'layoutInverted',
    label: 'CONTROLS ON TOP',
    type: 'toggle',
    onLabel: 'ON',
    offLabel: 'OFF',
  },
  { key: 'developer', label: 'DEVELOPER', type: 'panel' },
]

function connectionLabel(status) {
  if (status === 'active') return 'Active'
  if (status === 'starting') return 'Starting'
  if (status === 'waiting_camera') return 'Waiting for camera'
  if (status === 'analyzing') return 'Analyzing'
  if (status === 'error') return 'Error'
  return status ?? 'Idle'
}

export function SettingsPage() {
  const navigate = useNavigate()
  const {
    colors,
    theme,
    handleThemeChange,
    volume,
    setVolume,
    speechRate,
    setSpeechRate,
    fontSize,
    setFontSize,
    voiceEnabled,
    setVoiceEnabled,
    hazardMapEnabled,
    setHazardMapEnabled,
    layoutInverted,
    setLayoutInverted,
    feedback,
    handleTestSpeech,
    speechTestError,
    analysisStatus,
    developerDetails,
  } = useApp()
  const announce = useAnnounce()

  const [pageIdx, setPageIdx] = useState(0)
  const containerRef = useRef(null)

  const page = PAGES[pageIdx]
  const totalPages = PAGES.length

  const settings = useMemo(
    () => ({
      colorTheme: theme,
      volume,
      speechRate,
      fontSize,
      voiceEnabled,
      hazardMapEnabled,
      layoutInverted,
    }),
    [
      theme,
      volume,
      speechRate,
      fontSize,
      voiceEnabled,
      hazardMapEnabled,
      layoutInverted,
    ],
  )

  const update = useCallback(
    (key, value) => {
      if (key === 'colorTheme') handleThemeChange(/** @type {ColorTheme} */ (value))
      else if (key === 'volume') setVolume(value)
      else if (key === 'speechRate') setSpeechRate(value)
      else if (key === 'fontSize') setFontSize(value)
      else if (key === 'voiceEnabled') setVoiceEnabled(value)
      else if (key === 'hazardMapEnabled') setHazardMapEnabled(value)
      else if (key === 'layoutInverted') setLayoutInverted(value)
    },
    [
      handleThemeChange,
      setVolume,
      setSpeechRate,
      setFontSize,
      setVoiceEnabled,
      setHazardMapEnabled,
      setLayoutInverted,
    ],
  )

  useEffect(() => {
    const t = setTimeout(
      () =>
        announce(
          'Settings. Swipe left or right to change setting. Swipe up to increase. Swipe down for home.',
        ),
      300,
    )
    return () => clearTimeout(t)
  }, [announce])

  useEffect(() => {
    const p = PAGES[pageIdx]
    let valueText = ''
    if (p.type === 'range') valueText = ` — ${p.format(settings[p.key])}`
    else if (p.type === 'toggle')
      valueText = ` — ${settings[p.key] ? p.onLabel : p.offLabel}`
    else if (p.type === 'cycle')
      valueText = ` — ${THEME_LABELS[settings[p.key]] ?? settings[p.key]}`
    announce(`${p.label}${valueText}`)
  }, [pageIdx, announce, settings])

  const goPrev = useCallback(() => {
    feedback.buttonPress()
    setPageIdx((i) => (i - 1 + totalPages) % totalPages)
  }, [feedback, totalPages])

  const goNext = useCallback(() => {
    feedback.buttonPress()
    setPageIdx((i) => (i + 1) % totalPages)
  }, [feedback, totalPages])

  const increaseValue = useCallback(() => {
    const p = PAGES[pageIdx]
    if (p.type === 'panel') return
    feedback.buttonPress()
    if (p.type === 'cycle') {
      const idx = p.options.indexOf(settings[p.key])
      update(p.key, p.options[(idx + 1) % p.options.length])
    } else if (p.type === 'range') {
      const cur = settings[p.key]
      update(p.key, Math.min(p.max, Math.round((cur + p.step) * 100) / 100))
    } else if (p.type === 'toggle') {
      update(p.key, !settings[p.key])
    }
  }, [pageIdx, settings, update, feedback])

  const decreaseValue = useCallback(() => {
    const p = PAGES[pageIdx]
    if (p.type === 'panel') return
    feedback.buttonPress()
    if (p.type === 'cycle') {
      const idx = p.options.indexOf(settings[p.key])
      update(
        p.key,
        p.options[(idx - 1 + p.options.length) % p.options.length],
      )
    } else if (p.type === 'range') {
      const cur = settings[p.key]
      update(p.key, Math.max(p.min, Math.round((cur - p.step) * 100) / 100))
    } else if (p.type === 'toggle') {
      update(p.key, !settings[p.key])
    }
  }, [pageIdx, settings, update, feedback])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let startX = 0
    let startY = 0
    let startTime = 0
    let pointerId = null

    const onPointerDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      pointerId = e.pointerId
      startX = e.clientX
      startY = e.clientY
      startTime = Date.now()
    }

    const onPointerUp = (e) => {
      if (pointerId !== null && e.pointerId !== pointerId) return
      pointerId = null

      const dx = e.clientX - startX
      const dy = e.clientY - startY
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)
      const dist = Math.sqrt(dx * dx + dy * dy)
      const duration = Date.now() - startTime
      const W = el.clientWidth

      if (isHorizontalSwipe(dx, dy, duration)) {
        if (dx < 0) goNext()
        else goPrev()
      } else if (absDy > 90 && absDy > absDx * 2) {
        if (dy > 0) {
          feedback.buttonPress()
          navigate('/')
        } else {
          const zone = startX / W
          if (zone > 0.25 && zone < 0.75 && page.type !== 'panel') {
            increaseValue()
          }
        }
      } else if (dist < 22 && duration < 350) {
        const zone = startX / W
        if (zone < 0.35) goPrev()
        else if (zone > 0.65) goNext()
        else if (page.type === 'toggle') increaseValue()
      }
    }

    const onPointerCancel = () => {
      pointerId = null
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerCancel)
    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerCancel)
    }
  }, [
    navigate,
    goPrev,
    goNext,
    increaseValue,
    page.type,
    feedback,
  ])

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'ArrowLeft') {
        e.preventDefault()
        goPrev()
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        goNext()
      } else if (e.code === 'ArrowUp') {
        e.preventDefault()
        increaseValue()
      } else if (e.code === 'ArrowDown') {
        e.preventDefault()
        decreaseValue()
      } else if (e.code === 'Escape') {
        navigate('/')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goPrev, goNext, increaseValue, decreaseValue, navigate])

  const renderValue = () => {
    if (page.type === 'panel') {
      return (
        <div
          className="flex flex-col items-center gap-4 w-full max-w-md px-4 overflow-y-auto max-h-[50vh]"
          style={{ pointerEvents: 'auto' }}
        >
          <p
            style={{
              color: colors.text,
              fontSize: '0.85rem',
              letterSpacing: '0.06em',
              textAlign: 'center',
            }}
          >
            Connection: {connectionLabel(analysisStatus)}
          </p>
          <button
            type="button"
            onClick={() => {
              feedback.buttonPress()
              void handleTestSpeech()
            }}
            className="w-full rounded-2xl py-4 active:opacity-80"
            style={{
              backgroundColor: colors.accent,
              color: colors.background,
              fontWeight: 900,
              letterSpacing: '0.06em',
            }}
            aria-label="Test speech output"
          >
            TEST SPEECH
          </button>
          {speechTestError && (
            <p style={{ color: colors.text, fontSize: '0.8rem', textAlign: 'center' }}>
              {speechTestError}
            </p>
          )}
          <DeveloperDetails {...developerDetails} fontSize={fontSize} />
        </div>
      )
    }

    if (page.type === 'cycle') {
      const themeKey = settings[page.key]
      return (
        <div
          className="flex flex-col items-center justify-center rounded-3xl"
          style={{
            width: '72vw',
            maxWidth: 360,
            height: '28vw',
            maxHeight: 140,
            backgroundColor: THEME_BG[themeKey],
            border: `4px solid ${THEME_FG[themeKey]}`,
          }}
        >
          <span
            style={{
              color: THEME_FG[themeKey],
              fontSize: 'clamp(1rem, 4vw, 1.6rem)',
              fontWeight: 900,
              letterSpacing: '0.04em',
              textAlign: 'center',
              padding: '0 12px',
            }}
          >
            {THEME_LABELS[themeKey]}
          </span>
        </div>
      )
    }

    if (page.type === 'range') {
      const val = settings[page.key]
      const pct = ((val - page.min) / (page.max - page.min)) * 100
      return (
        <div
          className="flex flex-col items-center gap-4"
          style={{ width: '72vw', maxWidth: 340 }}
        >
          <span
            style={{
              fontSize: 'clamp(3rem, 14vw, 6rem)',
              fontWeight: 900,
              color: colors.accent,
              lineHeight: 1,
            }}
          >
            {page.format(val)}
          </span>
          <div
            className="w-full h-3 rounded-full"
            style={{ backgroundColor: colors.surface }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: colors.accent }}
            />
          </div>
        </div>
      )
    }

    if (page.type === 'toggle') {
      const on = settings[page.key]
      return (
        <div className="flex flex-col items-center gap-4">
          <div
            className="rounded-full transition-colors"
            style={{
              width: 100,
              height: 56,
              backgroundColor: on ? colors.accent : colors.muted,
              position: 'relative',
            }}
          >
            <span
              className="absolute top-2 rounded-full transition-transform"
              style={{
                width: 40,
                height: 40,
                backgroundColor: on ? colors.background : colors.surface,
                transform: on ? 'translateX(52px)' : 'translateX(8px)',
              }}
            />
          </div>
          <span
            style={{
              fontSize: 'clamp(2rem, 10vw, 4rem)',
              fontWeight: 900,
              color: on ? colors.accent : colors.text,
            }}
          >
            {on ? page.onLabel : page.offLabel}
          </span>
        </div>
      )
    }

    return null
  }

  return (
    <div
      ref={containerRef}
      className="size-full flex flex-col overflow-hidden relative"
      style={{
        backgroundColor: colors.background,
        color: colors.text,
        touchAction: 'none',
        userSelect: 'none',
      }}
      aria-label={`Settings, page ${pageIdx + 1} of ${totalPages}: ${page.label}. Tap left or right for previous or next setting. Swipe left or right to change setting page. Swipe up to increase value. Swipe down for Home.`}
    >
      <div
        className="absolute left-0 top-0 bottom-0 flex items-center justify-center"
        style={{ width: '35%' }}
      >
        <span
          style={{
            fontSize: 'clamp(2.5rem, 10vw, 5rem)',
            color: colors.text,
            fontWeight: 100,
          }}
        >
          ‹
        </span>
      </div>

      <div
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center"
        style={{ width: '35%' }}
      >
        <span
          style={{
            fontSize: 'clamp(2.5rem, 10vw, 5rem)',
            color: colors.text,
            fontWeight: 100,
          }}
        >
          ›
        </span>
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 pointer-events-none">
        <span
          style={{
            fontSize: scaleRem(1, fontSize),
            color: colors.text,
            letterSpacing: '0.18em',
            fontWeight: 700,
          }}
        >
          {page.label}
        </span>

        {renderValue()}

        {page.type !== 'toggle' && page.type !== 'panel' && (
          <div className="flex flex-col items-center gap-0">
            <span style={{ color: colors.text, fontSize: '1.2rem', lineHeight: 1 }}>↑</span>
            <span style={{ color: colors.text, fontSize: scaleRem(0.85, fontSize), letterSpacing: '0.1em' }}>
              SWIPE TO INCREASE
            </span>
          </div>
        )}
        {page.type === 'toggle' && (
          <span
            style={{
              color: colors.text,
              fontSize: scaleRem(0.85, fontSize),
              letterSpacing: '0.1em',
            }}
          >
            TAP CENTRE TO TOGGLE
          </span>
        )}
      </div>

      <div className="absolute bottom-4 left-4 pointer-events-none">
        <span style={{ color: colors.text, fontSize: scaleRem(0.9, fontSize), letterSpacing: '0.06em' }}>
          ↓ Home
        </span>
      </div>

      <div className="absolute bottom-10 inset-x-0 flex justify-center gap-2 pointer-events-none">
        {PAGES.map((_, i) => (
          <span
            key={i}
            className="rounded-full transition-all"
            style={{
              width: i === pageIdx ? 24 : 8,
              height: 8,
              backgroundColor: i === pageIdx ? colors.accent : colors.border,
            }}
          />
        ))}
      </div>

      <div className="absolute top-5 inset-x-0 flex justify-center pointer-events-none">
        <span style={{ color: colors.text, fontSize: scaleRem(0.9, fontSize), letterSpacing: '0.12em' }}>
          {pageIdx + 1} / {totalPages}
        </span>
      </div>
    </div>
  )
}
