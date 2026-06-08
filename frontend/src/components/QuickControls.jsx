import {
  Activity,
  Mic,
  Play,
  RotateCcw,
  Settings,
  Square,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react'

/** @typedef {import('../hooks/useColorTheme.js').ThemeColors} ThemeColors */

/**
 * @param {{
 *   isActive: boolean,
 *   onToggle: () => void,
 *   volume: number,
 *   onVolumeUp: () => void,
 *   onVolumeDown: () => void,
 *   speaking: boolean,
 *   isAnalyzing: boolean,
 *   lastAnalysis: string | null,
 *   colors: ThemeColors,
 *   voiceEnabled: boolean,
 *   onOpenSettings: () => void,
 *   onRepeat: () => void,
 *   feedback: ReturnType<import('../hooks/useInteractionFeedback.js').useInteractionFeedback>,
 * }} props
 */
export function QuickControls({
  isActive,
  onToggle,
  volume,
  onVolumeUp,
  onVolumeDown,
  speaking,
  isAnalyzing,
  lastAnalysis,
  colors,
  voiceEnabled,
  onOpenSettings,
  onRepeat,
  feedback,
}) {
  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2

  return (
    <div
      className="flex flex-col h-full px-4 pt-3 pb-4 gap-3"
      style={{ backgroundColor: colors.background }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: isActive ? colors.accent : colors.muted }}
          />
          <span
            className="text-sm font-medium"
            style={{ color: isActive ? colors.text : colors.muted }}
          >
            {isAnalyzing ? 'Analyzing…' : isActive ? 'Active' : 'Inactive'}
          </span>
          {isAnalyzing && (
            <Activity className="w-4 h-4 animate-pulse" style={{ color: colors.accent }} />
          )}
        </div>
        <div className="flex items-center gap-2">
          {speaking && (
            <div className="flex items-center gap-1">
              <Volume2 className="w-4 h-4 animate-pulse" style={{ color: colors.accent }} />
              <span className="text-xs" style={{ color: colors.accent }}>
                Speaking
              </span>
            </div>
          )}
          {voiceEnabled && (
            <Mic className="w-4 h-4" style={{ color: colors.accent }} />
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          feedback.togglePress(!isActive)
          onToggle()
        }}
        className="w-full rounded-2xl font-bold text-2xl flex items-center justify-center gap-3 transition-transform active:scale-95"
        style={{
          height: '72px',
          backgroundColor: isActive ? colors.surface : colors.accent,
          color: isActive ? colors.accent : colors.background,
          border: `3px solid ${colors.accent}`,
        }}
        aria-label={isActive ? 'Stop spatial analysis' : 'Start spatial analysis'}
        aria-pressed={isActive}
      >
        {isActive ? (
          <>
            <Square className="w-7 h-7" fill="currentColor" />
            STOP
          </>
        ) : (
          <>
            <Play className="w-7 h-7" fill="currentColor" />
            START
          </>
        )}
      </button>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            feedback.buttonPress()
            onVolumeDown()
          }}
          className="rounded-xl active:scale-95 flex items-center justify-center gap-1.5 font-semibold"
          style={{
            width: '88px',
            height: '52px',
            backgroundColor: colors.surface,
            color: colors.text,
            border: `2px solid ${colors.border}`,
          }}
          aria-label="Volume down"
        >
          <VolumeX className="w-5 h-5" />
          <span className="text-sm">−</span>
        </button>

        <div className="flex-1 flex flex-col items-center gap-1">
          <VolumeIcon className="w-5 h-5" style={{ color: colors.accent }} />
          <div
            className="w-full h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: colors.surface }}
          >
            <div
              className="h-full rounded-full transition-all duration-150"
              style={{ width: `${volume * 100}%`, backgroundColor: colors.accent }}
            />
          </div>
          <span className="text-xs" style={{ color: colors.muted }}>
            {Math.round(volume * 100)}%
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            feedback.buttonPress()
            onVolumeUp()
          }}
          className="rounded-xl active:scale-95 flex items-center justify-center gap-1.5 font-semibold"
          style={{
            width: '88px',
            height: '52px',
            backgroundColor: colors.surface,
            color: colors.text,
            border: `2px solid ${colors.border}`,
          }}
          aria-label="Volume up"
        >
          <Volume2 className="w-5 h-5" />
          <span className="text-sm">+</span>
        </button>
      </div>

      <div className="flex gap-3 flex-1 min-h-0">
        <div
          className="flex-1 p-3 rounded-xl overflow-hidden"
          style={{ backgroundColor: colors.surface }}
          role="status"
          aria-live="polite"
          aria-label="Latest spatial description"
        >
          {lastAnalysis ? (
            <p
              className="text-sm leading-relaxed"
              style={{
                color: colors.muted,
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {lastAnalysis}
            </p>
          ) : (
            <p className="text-sm" style={{ color: colors.muted }}>
              No description yet. Press START to begin.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              feedback.buttonPress()
              onRepeat()
            }}
            disabled={!lastAnalysis}
            className="rounded-xl active:scale-95 flex flex-col items-center justify-center gap-1 transition-opacity"
            style={{
              width: '64px',
              height: '64px',
              backgroundColor: colors.surface,
              color: lastAnalysis ? colors.text : colors.muted,
              border: `2px solid ${colors.border}`,
              opacity: lastAnalysis ? 1 : 0.4,
            }}
            aria-label="Repeat last description"
          >
            <RotateCcw className="w-5 h-5" />
            <span className="text-xs">Repeat</span>
          </button>

          <button
            type="button"
            onClick={() => {
              feedback.buttonPress()
              onOpenSettings()
            }}
            className="rounded-xl active:scale-95 flex flex-col items-center justify-center gap-1"
            style={{
              width: '64px',
              height: '64px',
              backgroundColor: colors.surface,
              color: colors.text,
              border: `2px solid ${colors.border}`,
            }}
            aria-label="Open settings"
          >
            <Settings className="w-5 h-5" />
            <span className="text-xs">Settings</span>
          </button>
        </div>
      </div>
    </div>
  )
}
