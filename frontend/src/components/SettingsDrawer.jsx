import {
  AlertCircle,
  FlipVertical2,
  Gauge,
  Mic,
  Palette,
  Type,
  VolumeX,
  X,
} from 'lucide-react'

import { DeveloperDetails } from './DeveloperDetails.jsx'

/** @typedef {import('../hooks/useColorTheme.js').ColorTheme} ColorTheme */
/** @typedef {import('../hooks/useColorTheme.js').ThemeColors} ThemeColors */

const THEME_OPTIONS = [
  { value: 'white-on-black', label: 'White / Black', bg: '#000000', fg: '#FFFFFF' },
  { value: 'black-on-white', label: 'Black / White', bg: '#FFFFFF', fg: '#000000' },
  { value: 'yellow-on-black', label: 'Yellow / Black', bg: '#000000', fg: '#FFFF00' },
  { value: 'green-on-black', label: 'Green / Black', bg: '#000000', fg: '#00FF00' },
]

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
  if (!open) return null

  const connectionLabel = active
    ? connectionStatus === 'connected'
      ? 'Listening for hazards'
      : connectionStatus === 'connecting'
        ? 'Connecting to alert stream...'
        : connectionStatus === 'error'
          ? 'Alert stream error'
          : 'Waiting for connection'
    : 'Inactive'

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-label="Close settings"
      />

      <div
        className="relative rounded-t-3xl overflow-y-auto max-h-[80vh]"
        style={{
          backgroundColor: colors.background,
          color: colors.text,
          borderTop: `2px solid ${colors.border}`,
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-lg font-semibold" style={{ color: colors.text }}>
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl active:scale-95"
            style={{
              backgroundColor: colors.surface,
              color: colors.text,
              border: `1px solid ${colors.border}`,
            }}
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 pb-6 space-y-6">
          <section>
            <label className="flex items-center gap-2 text-sm font-semibold mb-3">
              <Palette className="w-4 h-4" style={{ color: colors.accent }} />
              Color Theme
            </label>
            <div className="grid grid-cols-2 gap-3">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    feedback.buttonPress()
                    onColorThemeChange(/** @type {ColorTheme} */ (opt.value))
                  }}
                  className="py-3 px-4 rounded-xl font-semibold text-sm flex items-center gap-2 active:scale-95 transition-transform"
                  style={{
                    backgroundColor: opt.bg,
                    color: opt.fg,
                    border:
                      colorTheme === opt.value
                        ? `3px solid ${colors.accent}`
                        : `2px solid ${opt.fg}33`,
                  }}
                  aria-pressed={colorTheme === opt.value}
                >
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: opt.fg, border: `1px solid ${opt.fg}80` }}
                  />
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <label htmlFor="settings-rate" className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Gauge className="w-4 h-4" style={{ color: colors.accent }} />
                Speech Rate
              </span>
              <span className="text-sm font-bold" style={{ color: colors.accent }}>
                {speechRate.toFixed(1)}×
              </span>
            </label>
            <input
              id="settings-rate"
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={speechRate}
              onChange={(e) => {
                onSpeechRateChange(parseFloat(e.target.value))
                feedback.sliderChange()
              }}
              className="w-full h-3 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: colors.accent, backgroundColor: colors.surface }}
              aria-label="Adjust speech rate"
            />
            <div className="flex justify-between text-xs mt-1" style={{ color: colors.muted }}>
              <span>Slow 0.5×</span>
              <span>Fast 2.0×</span>
            </div>
          </section>

          <section>
            <label htmlFor="settings-font" className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Type className="w-4 h-4" style={{ color: colors.accent }} />
                Font Size
              </span>
              <span className="text-sm font-bold" style={{ color: colors.accent }}>
                {fontSize.toFixed(1)}×
              </span>
            </label>
            <input
              id="settings-font"
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={fontSize}
              onChange={(e) => {
                onFontSizeChange(parseFloat(e.target.value))
                feedback.sliderChange()
              }}
              className="w-full h-3 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: colors.accent, backgroundColor: colors.surface }}
              aria-label="Adjust font size"
            />
            <div className="flex justify-between text-xs mt-1" style={{ color: colors.muted }}>
              <span>Small 0.5×</span>
              <span>Large 2.0×</span>
            </div>
          </section>

          <section className="space-y-3">
            <ToggleRow
              icon={Mic}
              title="Voice Commands"
              description='"Start", "Stop", "Louder", "Repeat"'
              checked={voiceEnabled}
              onChange={() => {
                feedback.buttonPress()
                onVoiceEnabledChange(!voiceEnabled)
              }}
              colors={colors}
              ariaLabel="Toggle voice commands"
            />

            <ToggleRow
              icon={FlipVertical2}
              title="Controls on Top"
              description="Swap camera and controls position"
              checked={layoutInverted}
              onChange={() => {
                feedback.buttonPress()
                onLayoutInvertedChange(!layoutInverted)
              }}
              colors={colors}
              ariaLabel="Toggle layout position"
            />
          </section>

          <section>
            <button
              type="button"
              onClick={() => {
                feedback.buttonPress()
                onTestSpeech()
              }}
              className="w-full py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 active:scale-95"
              style={{
                backgroundColor: colors.surface,
                color: colors.text,
                border: `2px solid ${colors.border}`,
              }}
              aria-label="Test speech output"
            >
              <VolumeX className="w-5 h-5" />
              Test Speech
            </button>
            {speechTestError && (
              <p className="mt-2 text-xs" role="alert" style={{ color: colors.accent }}>
                {speechTestError}
              </p>
            )}
          </section>

          <section>
            <p className="text-sm font-semibold mb-2" style={{ color: colors.muted }}>
              Keyboard Shortcuts
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: colors.muted }}>
              {[
                ['Space', 'Start / Stop'],
                ['↑ / ↓', 'Volume'],
                ['← / →', 'Speech rate'],
                ['+ / −', 'Font size'],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center gap-2">
                  <kbd
                    className="px-2 py-0.5 rounded text-xs font-mono"
                    style={{
                      backgroundColor: colors.surface,
                      border: `1px solid ${colors.border}`,
                    }}
                  >
                    {key}
                  </kbd>
                  <span>{desc}</span>
                </div>
              ))}
            </div>
          </section>

          <div
            className="flex items-start gap-3 p-3 rounded-xl"
            style={{
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
            }}
          >
            <AlertCircle
              className="w-4 h-4 flex-shrink-0 mt-0.5"
              style={{ color: streamError ? colors.accent : colors.muted }}
            />
            <div className="text-xs">
              <p className="font-semibold mb-0.5" style={{ color: colors.text }}>
                Alert Stream
              </p>
              <p style={{ color: colors.muted }}>{connectionLabel}</p>
              {streamError && (
                <p className="mt-1" style={{ color: colors.text }}>
                  {streamError}
                </p>
              )}
            </div>
          </div>

          <DeveloperDetails {...developerDetails} />
        </div>
      </div>
    </div>
  )
}

/**
 * @param {{
 *   icon: import('lucide-react').LucideIcon,
 *   title: string,
 *   description: string,
 *   checked: boolean,
 *   onChange: () => void,
 *   colors: ThemeColors,
 *   ariaLabel: string,
 * }} props
 */
function ToggleRow({ icon: Icon, title, description, checked, onChange, colors, ariaLabel }) {
  return (
    <div
      className="flex items-center justify-between p-4 rounded-xl"
      style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5" style={{ color: colors.accent }} />
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs" style={{ color: colors.muted }}>
            {description}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onChange}
        className="relative w-12 h-7 rounded-full transition-colors"
        style={{ backgroundColor: checked ? colors.accent : colors.muted }}
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
      >
        <span
          className="absolute top-0.5 w-6 h-6 rounded-full transition-transform"
          style={{
            backgroundColor: checked ? colors.background : colors.surface,
            transform: checked ? 'translateX(22px)' : 'translateX(2px)',
          }}
        />
      </button>
    </div>
  )
}
