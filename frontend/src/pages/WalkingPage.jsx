import { useNavigate } from 'react-router'
import { MapPin, Settings, Volume2, VolumeX } from 'lucide-react'

import { CameraView } from '../components/CameraView.jsx'
import { useApp } from '../context/AppContext.js'

export function WalkingPage() {
  const navigate = useNavigate()
  const {
    videoRef,
    cameraError,
    reattachCamera,
    active,
    toggleCapture,
    volume,
    setVolume,
    fontSize,
    layoutInverted,
    colors,
    feedback,
    setSettingsOpen,
  } = useApp()

  const cameraZone = (
    <CameraView
      videoRef={videoRef}
      active={active}
      colors={colors}
      cameraError={cameraError}
      fontSize={fontSize}
      showControls
      onToggle={() => void toggleCapture()}
      reattachCamera={reattachCamera}
    />
  )

  const volumeBar = (
    <div
      className="flex flex-col items-center justify-center gap-3 px-6"
      style={{
        height: '20vh',
        borderTop: `2px solid ${colors.border}`,
        borderBottom: `2px solid ${colors.border}`,
        backgroundColor: colors.surface,
      }}
    >
      <div className="flex items-center justify-between w-full">
        <VolumeX
          style={{
            width: '6vw',
            height: '6vw',
            maxWidth: 32,
            maxHeight: 32,
            color: colors.muted,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: `${fontSize * 1.1}rem`,
            fontWeight: 700,
            color: colors.text,
            letterSpacing: '0.04em',
          }}
        >
          VOLUME — {Math.round(volume * 100)}%
        </span>
        <Volume2
          style={{
            width: '6vw',
            height: '6vw',
            maxWidth: 32,
            maxHeight: 32,
            color: colors.accent,
            flexShrink: 0,
          }}
        />
      </div>

      <div className="relative w-full flex items-center" style={{ height: '48px' }}>
        <div
          className="absolute inset-y-0 left-0 rounded-full pointer-events-none"
          style={{
            width: `${volume * 100}%`,
            backgroundColor: colors.accent,
            top: '50%',
            height: '12px',
            transform: 'translateY(-50%)',
          }}
        />
        <div
          className="absolute inset-y-0 rounded-full pointer-events-none"
          style={{
            inset: 0,
            top: '50%',
            height: '12px',
            transform: 'translateY(-50%)',
            backgroundColor: colors.background,
            zIndex: 0,
          }}
        />
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={Math.round(volume * 100)}
          onChange={(e) => {
            setVolume(parseInt(e.target.value, 10) / 100)
            feedback.sliderChange()
          }}
          className="relative w-full"
          style={{
            height: '48px',
            appearance: 'none',
            WebkitAppearance: 'none',
            background: 'transparent',
            cursor: 'pointer',
            zIndex: 1,
          }}
          aria-label={`Volume, currently ${Math.round(volume * 100)} percent`}
        />
      </div>

      <style>{`
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: ${colors.accent};
          border: 4px solid ${colors.background};
          box-shadow: 0 0 0 2px ${colors.accent};
          cursor: pointer;
        }
        input[type=range]::-moz-range-thumb {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: ${colors.accent};
          border: 4px solid ${colors.background};
          box-shadow: 0 0 0 2px ${colors.accent};
          cursor: pointer;
        }
        input[type=range]::-webkit-slider-runnable-track {
          height: 12px;
          border-radius: 6px;
          background: transparent;
        }
        input[type=range]::-moz-range-track {
          height: 12px;
          border-radius: 6px;
          background: transparent;
        }
      `}</style>
    </div>
  )

  const bottomRow = (
    <div className="flex" style={{ borderTop: `2px solid ${colors.border}` }}>
      <button
        type="button"
        onClick={() => {
          feedback.buttonPress()
          navigate('/navigation')
        }}
        className="flex-1 flex flex-col items-center justify-center gap-3 active:opacity-80 transition-opacity"
        style={{
          backgroundColor: colors.surface,
          color: colors.text,
          borderRight: `2px solid ${colors.border}`,
          minHeight: '14vh',
        }}
        aria-label="Open navigation with voice commands"
      >
        <MapPin
          style={{
            width: '12vw',
            height: '12vw',
            maxWidth: 68,
            maxHeight: 68,
            color: colors.accent,
          }}
        />
        <span
          style={{
            fontSize: `${fontSize * 1.3}rem`,
            fontWeight: 800,
            letterSpacing: '0.05em',
          }}
        >
          NAVIGATE
        </span>
      </button>

      <button
        type="button"
        onClick={() => {
          feedback.buttonPress()
          setSettingsOpen(true)
        }}
        className="flex-1 flex flex-col items-center justify-center gap-3 active:opacity-80 transition-opacity"
        style={{ backgroundColor: colors.surface, color: colors.text, minHeight: '14vh' }}
        aria-label="Open settings"
      >
        <Settings style={{ width: '12vw', height: '12vw', maxWidth: 68, maxHeight: 68 }} />
        <span
          style={{
            fontSize: `${fontSize * 1.3}rem`,
            fontWeight: 800,
            letterSpacing: '0.05em',
          }}
        >
          SETTINGS
        </span>
      </button>
    </div>
  )

  return (
    <div className="size-full flex flex-col overflow-hidden">
      {layoutInverted ? (
        <>
          {bottomRow}
          {volumeBar}
          {cameraZone}
        </>
      ) : (
        <>
          {cameraZone}
          {volumeBar}
          {bottomRow}
        </>
      )}
    </div>
  )
}
