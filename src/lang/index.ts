import { createI18n, useI18n } from 'vue-i18n'
import { enUS } from './enUS'
import { idID } from './idID'

export type AppLocale = 'idID' | 'enUS'

export function getStoredLocale(): AppLocale | 'auto' {
  if (typeof localStorage === 'undefined')
    return 'enUS'
  return (localStorage.getItem('lang') as AppLocale | 'auto') || 'auto'
}

export const AVAILABLE_LOCALES: AppLocale[] = ['enUS', 'idID']

export function isIndonesianLanguage(langCode?: string): boolean {
  if (!langCode)
    return false
  return langCode.toLowerCase().startsWith('id')
}

export function resolveLocale(storedVal?: AppLocale | 'auto'): AppLocale {
  const stored = storedVal ?? getStoredLocale()
  if (stored === 'auto')
    return typeof navigator !== 'undefined' && isIndonesianLanguage(navigator.language) ? 'idID' : 'enUS'
  // Validate stored locale against available locales; fall back to auto if invalid
  if (AVAILABLE_LOCALES.includes(stored as AppLocale))
    return stored as AppLocale
  return typeof navigator !== 'undefined' && isIndonesianLanguage(navigator.language) ? 'idID' : 'enUS'
}

export function setAppLocale(target: AppLocale | 'auto'): AppLocale {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('lang', target)
  }
  const resolved = resolveLocale(target)
  lang.global.locale.value = resolved
  return resolved
}

const lang = createI18n({
  globalInjection: true,
  locale: resolveLocale(),
  fallbackLocale: 'enUS',
  legacy: false,
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    idID,
    enUS,
  },
})

const useLang = useI18n

export { lang, useLang }
