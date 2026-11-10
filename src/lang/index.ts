import { createI18n, useI18n } from 'vue-i18n'
import { enUS } from './enUS'
import { idID } from './idID'

type AppLocale = 'idID' | 'enUS'

function getStoredLocale(): AppLocale | 'auto' {
  if (typeof localStorage === 'undefined')
    return 'enUS'
  return (localStorage.getItem('lang') as AppLocale | 'auto') || 'auto'
}

const AVAILABLE_LOCALES: AppLocale[] = ['enUS', 'idID']

function isIndonesianLanguage(langCode?: string): boolean {
  if (!langCode)
    return false
  return langCode.toLowerCase().startsWith('id')
}

function resolveLocale(): AppLocale {
  const stored = getStoredLocale()
  if (stored === 'auto')
    return typeof navigator !== 'undefined' && isIndonesianLanguage(navigator.language) ? 'idID' : 'enUS'
  // Validate stored locale against available locales; fall back to auto if invalid
  if (AVAILABLE_LOCALES.includes(stored as AppLocale))
    return stored
  return typeof navigator !== 'undefined' && isIndonesianLanguage(navigator.language) ? 'idID' : 'enUS'
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
