import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FlipVertical2,
  Gauge,
  Mic,
  Palette,
  Type,
  VolumeX,
  X,
} from 'lucide-react'

import { scaleRem, scaleSize } from '../utils/scaleFont.js'
import { DeveloperDetails } from './DeveloperDetails.jsx'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from './ui/sheet.jsx'

/** @typedef {import('../hooks/useColorTheme.js').ColorTheme} ColorTheme */
/** @typedef {import('../hooks/useColorTheme.js').ThemeColors} ThemeColors */

const THEME_OPTIONS = [
  { value: 'white-on-black', label: 'White on Black', bg: '#000000', fg: '#FFFFFF' },
  { value: 'black-on-white', label: 'Black on White', bg: '#FFFFFF', fg: '#000000' },
  { value: 'yellow-on-black', label: 'Yellow on Black', bg: '#000000', fg: '#FFFF00' },
  { value: 'green-on-black', label: 'Green on Black', bg: '#000000', fg: '#00FF00' },
]

/**
 * @param {{
 *   value: boolean,
 *   onChange: (v: boolean) => void,
 *   colors: ThemeColors,
 *   feedback: { buttonPress: () => void },
 *   ariaLabel: string,
 *   fontSize: number,
 * }} props
 */
function BigToggle({ value, onChange, colors, feedback, ariaLabel, fontSize }) {
  return (
    <button
      type="button"
      onClick={() => {
        feedback.buttonPress()
        onChange(!value)
      }}
      role="switch"
      aria-checked={value}
      aria-label={ariaLabel}
      className="relative rounded-full transition-colors"
      style={{
        width: scaleSize(4.5, fontSize),
        height: scaleSize(2.5, fontSize),
        flexShrink: 0,
        backgroundColor: value ? colors.accent : colors.muted,
      }}
    >
      <span
        className="absolute rounded-full transition-transform"
        style={{
          width: scaleSize(2, fontSize),
          height: scaleSize(2, fontSize),
          top: '50%',
          left: scaleSize(0.125, fontSize),
          transform: value
            ? `translate(${scaleSize(2.25, fontSize)}, -50%)`
            : 'translate(0, -50%)',
          backgroundColor: value ? colors.background : colors.surface,
        }}
      />
    </button>
  )
}

/**
 * @param {{
 *   options: typeof THEME_OPTIONS,
 *   value: ColorTheme,
 *   onChange: (v: ColorTheme) => void,
 *   colors: ThemeColors,
 *   feedback: { buttonPress: () => void },
 *   fontSize: number,
 * }} props
 */
function ThemeCarousel({ options, value, onChange, colors, feedback, fontSize }) {
  const idx = options.findIndex((o) => o.value === value)
  const current = options[idx]
  const arrowSize = scaleSize(6.5, fontSize)
  const iconSize = scaleRem(3.5, fontSize)

  const prev = () => {
    feedback.buttonPress()
    onChange(/** @type {ColorTheme} */ (options[(idx - 1 + options.length) % options.length].value))
  }
  const next = () => {
    feedback.buttonPress()
    onChange(/** @type {ColorTheme} */ (options[(idx + 1) % options.length].value))
  }

  return (
    <div
      className="flex items-center"
      style={{ gap: scaleSize(1, fontSize) }}
    >
      <button
        type="button"
        onClick={prev}
        aria-label="Previous colour theme"
        className="active:scale-90 transition-transform flex items-center justify-center rounded-full flex-shrink-0"
        style={{
          width: arrowSize,
          height: arrowSize,
          backgroundColor: colors.surface,
          color: colors.text,
          border: `3px solid ${colors.border}`,
        }}
      >
        <ChevronLeft style={{ width: iconSize, height: iconSize }} />
      </button>

      <div
        className="flex-1 flex flex-col items-center justify-center rounded-2xl"
        style={{
          height: scaleSize(9, fontSize),
          backgroundColor: current.bg,
          color: current.fg,
          border: `5px solid ${current.fg}`,
        }}
        aria-label={`Current theme: ${current.label}`}
        aria-live="polite"
      >
        <span
          style={{
            fontSize: scaleRem(1.6, fontSize),
            fontWeight: 900,
            letterSpacing: '0.04em',
          }}
        >
          {current.label}
        </span>
        <span
          style={{
            fontSize: scaleRem(1, fontSize),
            opacity: 0.6,
            marginTop: scaleSize(0.25, fontSize),
          }}
        >
          {idx + 1} / {options.length}
        </span>
      </div>

      <button
        type="button"
        onClick={next}
        aria-label="Next colour theme"
        className="active:scale-90 transition-transform flex items-center justify-center rounded-full flex-shrink-0"
        style={{
          width: arrowSize,
          height: arrowSize,
          backgroundColor: colors.surface,
          color: colors.text,
          border: `3px solid ${colors.border}`,
        }}
      >
        <ChevronRight style={{ width: iconSize, height: iconSize }} />
      </button>
    </div>
  )
}

/**
 * @param {{
 *   icon: import('react').ReactNode,
 *   text: string,
 *   colors: ThemeColors,
 *   fontSize: number,
 * }} props
 */
function SectionLabel({ icon, text, colors, fontSize }) {
  return (
    <div
      className="flex items-center"
      style={{
        gap: scaleSize(0.75, fontSize),
        marginBottom: scaleSize(1, fontSize),
      }}
    >
      <span style={{ color: colors.accent }}>{icon}</span>
      <span
        style={{
          fontSize: scaleRem(1.25, fontSize),
          fontWeight: 800,
          color: colors.text,
          letterSpacing: '0.04em',
        }}
      >
        {text}
      </span>
    </div>
  )
}

/**
 * @param {{
 *   fontSize: number,
 *   colors: ThemeColors,
 * }} props
 */
function SliderThumbStyles({ fontSize, colors }) {
  const thumb = scaleSize(2.5, fontSize)
  const track = scaleSize(0.75, fontSize)
  const border = scaleSize(0.25, fontSize)
  const radius = scaleSize(0.375, fontSize)

  return (
    <style>{`
      .settings-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: ${thumb};
        height: ${thumb};
        border-radius: 50%;
        background: ${colors.accent};
        border: ${border} solid ${colors.background};
        box-shadow: 0 0 0 2px ${colors.accent};
        cursor: pointer;
      }
      .settings-slider::-moz-range-thumb {
        width: ${thumb};
        height: ${thumb};
        border-radius: 50%;
        background: ${colors.accent};
        border: ${border} solid ${colors.background};
        box-shadow: 0 0 0 2px ${colors.accent};
        cursor: pointer;
      }
      .settings-slider::-webkit-slider-runnable-track {
        height: ${track};
        border-radius: ${radius};
        background: transparent;
      }
      .settings-slider::-moz-range-track {
        height: ${track};
        border-radius: ${radius};
        background: transparent;
      }
    `}</style>
  )
}

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   speechRate: number,
 *   onSpeechRateChange: (rate: number) => void,
 *   fontSize: number,
 *   onFontSizeChange: (size: number) => void,
 *   colorTheme: ColorTheme,
 *   onColorThemeChange: (theme: ColorTheme) => void,
 *   voiceEnabled: boolean,
 *   onVoiceEnabledChange: (enabled: boolean) => void,
 *   layoutInverted: boolean,
 *   onLayoutInvertedChange: (inverted: boolean) => void,
 *   onTestSpeech: () => void,
 *   speechTestError: string | null,
 *   connectionStatus: string,
 *   streamError: string | null,
 *   active: boolean,
 *   colors: ThemeColors,
 *   feedback: ReturnType<import('../hooks/useInteractionFeedback.js').useInteractionFeedback>,
 *   developerDetails: object,
 * }} props
 */
export function SettingsDrawer({
  open,
  onClose,
  speechRate,
  onSpeechRateChange,
  fontSize,
  onFontSizeChange,
  colorTheme,
  onColorThemeChange,
  voiceEnabled,
  onVoiceEnabledChange,
  layoutInverted,
  onLayoutInvertedChange,
  onTestSpeech,
  speechTestError,
  connectionStatus,
  streamError,
  active,
  colors,
  feedback,
  developerDetails,
}) {
  const iconMd = scaleRem(1.75, fontSize)
  const iconLg = scaleRem(2, fontSize)
  const closeSize = scaleSize(3.5, fontSize)
  const sliderHeight = scaleSize(3.5, fontSize)
  const sliderTrack = scaleSize(0.625, fontSize)
  const toggleRowHeight = scaleSize(5.5, fontSize)
  const sectionPadding = scaleSize(1.25, fontSize)
  const sectionGap = scaleSize(2.5, fontSize)
  const innerGap = scaleSize(0.75, fontSize)
  const rowGap = scaleSize(1, fontSize)

  const connectionLabel = active
    ? connectionStatus === 'active'
      ? 'Analyzing live frames'
      : connectionStatus === 'starting'
        ? 'Starting live analysis...'
        : connectionStatus === 'waiting_camera'
          ? 'Waiting for camera frames...'
          : connectionStatus === 'analyzing'
            ? 'Analyzing latest frame...'
            : connectionStatus === 'error'
              ? 'Live analysis error'
              : 'Preparing live analysis'
    : 'Inactive'

  return (
    <Sheet
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <SheetContent
        side="bottom"
        className="rounded-t-3xl overflow-y-auto"
        style={{
          backgroundColor: colors.background,
          color: colors.text,
          borderTop: `3px solid ${colors.border}`,
          maxHeight: '90vh',
        }}
      >
        <SheetHeader
          style={{
            paddingTop: sectionPadding,
            paddingBottom: scaleSize(0.5, fontSize),
            paddingLeft: sectionPadding,
            paddingRight: sectionPadding,
          }}
        >
          <div className="flex items-center justify-between">
            <SheetTitle
              style={{
                color: colors.text,
                fontSize: scaleRem(1.6, fontSize),
                fontWeight: 900,
                letterSpacing: '0.04em',
              }}
            >
              SETTINGS
            </SheetTitle>
            <button
              type="button"
              onClick={onClose}
              className="active:opacity-70"
              style={{
                width: closeSize,
                height: closeSize,
                borderRadius: scaleSize(1, fontSize),
                backgroundColor: colors.surface,
                color: colors.text,
                border: `2px solid ${colors.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
              aria-label="Close settings"
            >
              <X style={{ width: iconMd, height: iconMd }} />
            </button>
          </div>
        </SheetHeader>

        <SliderThumbStyles fontSize={fontSize} colors={colors} />

        <div
          style={{
            paddingLeft: sectionPadding,
            paddingRight: sectionPadding,
            paddingBottom: scaleSize(2, fontSize),
            display: 'flex',
            flexDirection: 'column',
            gap: sectionGap,
          }}
        >
          <section>
            <SectionLabel
              icon={<Palette style={{ width: iconMd, height: iconMd }} />}
              text="COLOUR THEME"
              colors={colors}
              fontSize={fontSize}
            />
            <ThemeCarousel
              options={THEME_OPTIONS}
              value={colorTheme}
              onChange={onColorThemeChange}
              colors={colors}
              feedback={feedback}
              fontSize={fontSize}
            />
          </section>

          <section>
            <SectionLabel
              icon={<Gauge style={{ width: iconMd, height: iconMd }} />}
              text="SPEECH RATE"
              colors={colors}
              fontSize={fontSize}
            />
            <div
              className="flex flex-col rounded-2xl"
              style={{
                gap: innerGap,
                padding: sectionPadding,
                backgroundColor: colors.surface,
                border: `2px solid ${colors.border}`,
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  style={{
                    fontSize: scaleRem(1, fontSize),
                    color: colors.muted,
                    fontWeight: 600,
                  }}
                >
                  SLOW
                </span>
                <span
                  style={{
                    fontSize: scaleRem(1.8, fontSize),
                    fontWeight: 900,
                    color: colors.accent,
                  }}
                >
                  {speechRate.toFixed(1)}×
                </span>
                <span
                  style={{
                    fontSize: scaleRem(1, fontSize),
                    color: colors.muted,
                    fontWeight: 600,
                  }}
                >
                  FAST
                </span>
              </div>
              <div className="relative flex items-center" style={{ height: sliderHeight }}>
                <div
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    left: 0,
                    right: 0,
                    height: sliderTrack,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    backgroundColor: colors.background,
                  }}
                />
                <div
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    left: 0,
                    width: `${((speechRate - 0.5) / 1.5) * 100}%`,
                    height: sliderTrack,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    backgroundColor: colors.accent,
                  }}
                />
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={speechRate}
                  onChange={(e) => {
                    onSpeechRateChange(parseFloat(e.target.value))
                    feedback.sliderChange()
                  }}
                  className="settings-slider relative w-full"
                  style={{
                    height: sliderHeight,
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    zIndex: 1,
                  }}
                  aria-label={`Speech rate, currently ${speechRate.toFixed(1)} times`}
                />
              </div>
            </div>
          </section>

          <section>
            <SectionLabel
              icon={<Type style={{ width: iconMd, height: iconMd }} />}
              text="TEXT SIZE"
              colors={colors}
              fontSize={fontSize}
            />
            <div
              className="flex flex-col rounded-2xl"
              style={{
                gap: innerGap,
                padding: sectionPadding,
                backgroundColor: colors.surface,
                border: `2px solid ${colors.border}`,
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  style={{
                    fontSize: scaleRem(0.9, fontSize),
                    color: colors.muted,
                    fontWeight: 600,
                  }}
                >
                  SMALL
                </span>
                <span
                  style={{
                    fontSize: scaleRem(1.8, fontSize),
                    fontWeight: 900,
                    color: colors.accent,
                  }}
                >
                  {fontSize.toFixed(1)}×
                </span>
                <span
                  style={{
                    fontSize: scaleRem(1.1, fontSize),
                    color: colors.muted,
                    fontWeight: 600,
                  }}
                >
                  LARGE
                </span>
              </div>
              <div className="relative flex items-center" style={{ height: sliderHeight }}>
                <div
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    left: 0,
                    right: 0,
                    height: sliderTrack,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    backgroundColor: colors.background,
                  }}
                />
                <div
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    left: 0,
                    width: `${((fontSize - 0.5) / 1.5) * 100}%`,
                    height: sliderTrack,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    backgroundColor: colors.accent,
                  }}
                />
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={fontSize}
                  onChange={(e) => {
                    onFontSizeChange(parseFloat(e.target.value))
                    feedback.sliderChange()
                  }}
                  className="settings-slider relative w-full"
                  style={{
                    height: sliderHeight,
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    zIndex: 1,
                  }}
                  aria-label={`Text size, currently ${fontSize.toFixed(1)} times`}
                />
              </div>
            </div>
          </section>

          <section style={{ display: 'flex', flexDirection: 'column', gap: rowGap }}>
            <div
              className="flex items-center justify-between rounded-2xl"
              style={{
                minHeight: toggleRowHeight,
                paddingLeft: sectionPadding,
                paddingRight: sectionPadding,
                backgroundColor: colors.surface,
                border: `2px solid ${colors.border}`,
              }}
            >
              <div className="flex items-center" style={{ gap: rowGap }}>
                <Mic
                  style={{ width: iconLg, height: iconLg, color: colors.accent, flexShrink: 0 }}
                />
                <div>
                  <p
                    style={{
                      fontSize: scaleRem(1.15, fontSize),
                      fontWeight: 800,
                      color: colors.text,
                    }}
                  >
                    VOICE COMMANDS
                  </p>
                  <p
                    style={{
                      fontSize: scaleRem(0.85, fontSize),
                      color: colors.muted,
                      marginTop: scaleSize(0.125, fontSize),
                    }}
                  >
                    Say &quot;Start&quot;, &quot;Stop&quot;, &quot;Louder&quot;, &quot;Repeat&quot;
                  </p>
                </div>
              </div>
              <BigToggle
                value={voiceEnabled}
                onChange={onVoiceEnabledChange}
                colors={colors}
                feedback={feedback}
                ariaLabel="Toggle voice commands"
                fontSize={fontSize}
              />
            </div>

            <div
              className="flex items-center justify-between rounded-2xl"
              style={{
                minHeight: toggleRowHeight,
                paddingLeft: sectionPadding,
                paddingRight: sectionPadding,
                backgroundColor: colors.surface,
                border: `2px solid ${colors.border}`,
              }}
            >
              <div className="flex items-center" style={{ gap: rowGap }}>
                <FlipVertical2
                  style={{ width: iconLg, height: iconLg, color: colors.accent, flexShrink: 0 }}
                />
                <div>
                  <p
                    style={{
                      fontSize: scaleRem(1.15, fontSize),
                      fontWeight: 800,
                      color: colors.text,
                    }}
                  >
                    CONTROLS ON TOP
                  </p>
                  <p
                    style={{
                      fontSize: scaleRem(0.85, fontSize),
                      color: colors.muted,
                      marginTop: scaleSize(0.125, fontSize),
                    }}
                  >
                    Swap button positions
                  </p>
                </div>
              </div>
              <BigToggle
                value={layoutInverted}
                onChange={onLayoutInvertedChange}
                colors={colors}
                feedback={feedback}
                ariaLabel="Toggle controls on top"
                fontSize={fontSize}
              />
            </div>
          </section>

          <section>
            <button
              type="button"
              onClick={() => {
                feedback.buttonPress()
                onTestSpeech()
              }}
              className="w-full rounded-2xl font-bold flex items-center justify-center active:opacity-80"
              style={{
                gap: innerGap,
                paddingTop: sectionPadding,
                paddingBottom: sectionPadding,
                paddingLeft: sectionPadding,
                paddingRight: sectionPadding,
                backgroundColor: colors.surface,
                color: colors.text,
                border: `2px solid ${colors.border}`,
                fontSize: scaleRem(1.1, fontSize),
                letterSpacing: '0.04em',
              }}
              aria-label="Test speech output"
            >
              <VolumeX style={{ width: iconMd, height: iconMd }} />
              TEST SPEECH
            </button>
            {speechTestError && (
              <p
                role="alert"
                style={{
                  color: colors.accent,
                  fontSize: scaleRem(0.875, fontSize),
                  marginTop: scaleSize(0.5, fontSize),
                }}
              >
                {speechTestError}
              </p>
            )}
          </section>

          <section>
            <div
              className="flex items-start rounded-2xl"
              style={{
                gap: rowGap,
                padding: sectionPadding,
                backgroundColor: colors.surface,
                border: `2px solid ${colors.border}`,
              }}
            >
              <AlertCircle
                style={{
                  width: iconMd,
                  height: iconMd,
                  flexShrink: 0,
                  marginTop: scaleSize(0.125, fontSize),
                  color: streamError ? colors.accent : colors.muted,
                }}
              />
              <div>
                <p
                  style={{
                    fontSize: scaleRem(1.1, fontSize),
                    fontWeight: 800,
                    color: colors.text,
                  }}
                >
                  LIVE ANALYSIS
                </p>
                <p
                  style={{
                    fontSize: scaleRem(0.9, fontSize),
                    color: colors.muted,
                    marginTop: scaleSize(0.25, fontSize),
                  }}
                >
                  {connectionLabel}
                </p>
                {streamError && (
                  <p
                    style={{
                      color: colors.text,
                      fontSize: scaleRem(0.875, fontSize),
                      marginTop: scaleSize(0.5, fontSize),
                    }}
                  >
                    {streamError}
                  </p>
                )}
              </div>
            </div>
          </section>

          <DeveloperDetails {...developerDetails} fontSize={fontSize} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
