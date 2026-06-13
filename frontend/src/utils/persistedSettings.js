/** @typedef {'white-on-black' | 'black-on-white' | 'yellow-on-black' | 'green-on-black'} ColorTheme */

export const SETTINGS_STORAGE_KEY = 'aurahear-settings'

/** @type {{ volume: number, speechRate: number, fontSize: number, voiceEnabled: boolean, layoutInverted: boolean, hazardMapEnabled: boolean, colorTheme: ColorTheme }} */
export const DEFAULT_PERSISTED_SETTINGS = {
  volume: 0.8,
  speechRate: 1,
  fontSize: 1.25,
  voiceEnabled: false,
  layoutInverted: false,
  hazardMapEnabled: false,
  colorTheme: 'white-on-black',
}

export function loadPersistedSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (raw) {
      return { ...DEFAULT_PERSISTED_SETTINGS, ...JSON.parse(raw) }
    }
  } catch {
    // ignore invalid storage
  }
  return { ...DEFAULT_PERSISTED_SETTINGS }
}

/** @param {Partial<typeof DEFAULT_PERSISTED_SETTINGS>} settings */
export function savePersistedSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // ignore quota errors
  }
}
