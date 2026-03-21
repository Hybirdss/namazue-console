/**
 * Namazue — i18n Module
 *
 * Framework-free internationalization with pub/sub locale change notifications.
 * Supports English (en), Korean (ko), and Japanese (ja).
 *
 * Usage:
 *   import { t, setLocale, onLocaleChange } from './i18n';
 *   t('sidebar.title');            // "Seismic Monitor"
 *   setLocale('ja');               // switches locale, notifies all subscribers
 *   onLocaleChange((loc) => { ... }); // subscribe to locale changes
 */

import en from './en';
import ko from './ko';
import ja from './ja';

// ── Types ────────────────────────────────────────────────────────

export type Locale = 'en' | 'ko' | 'ja';

// ── State ────────────────────────────────────────────────────────

const translations: Record<Locale, Record<string, string>> = { en, ko, ja };
const listeners: Set<(locale: Locale) => void> = new Set();
let currentLocale: Locale = detectLocale();

// Sync HTML lang on module init for SEO and accessibility
if (typeof document !== 'undefined') {
  document.documentElement.lang = currentLocale;
}

// ── Locale detection ─────────────────────────────────────────────

function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en';

  // 0. URL override: ?lang=ja | ?lang=ko | ?lang=en
  const params = new URLSearchParams(window.location.search);
  const langParam = params.get('lang')?.toLowerCase();
  if (langParam === 'ja' || langParam === 'ko' || langParam === 'en') return langParam;

  // 1. Check browser language preference
  const lang = navigator.language ?? '';
  const prefix = lang.slice(0, 2).toLowerCase();
  if (prefix === 'ja') return 'ja';
  if (prefix === 'ko') return 'ko';

  // 2. Fallback: detect by timezone (physical location)
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz.startsWith('Asia/Tokyo') || tz === 'Japan') return 'ja';
    if (tz.startsWith('Asia/Seoul') || tz === 'ROK') return 'ko';
  } catch { /* ignore */ }

  return 'ja';
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Set the active locale and notify all subscribers.
 * No-op if the locale is already set to the given value.
 */
export function setLocale(locale: Locale): void {
  if (locale === currentLocale) return;
  currentLocale = locale;
  // Sync HTML lang attribute for SEO and accessibility
  document.documentElement.lang = locale;
  for (const fn of listeners) {
    fn(locale);
  }
}

/**
 * Get the currently active locale.
 */
export function getLocale(): Locale {
  return currentLocale;
}

/**
 * Translate a key using the active locale.
 * Falls back to English if the key is missing in the current locale,
 * and returns the raw key string if not found in English either.
 */
export function t(key: string): string {
  const dict = translations[currentLocale];
  if (key in dict) return dict[key];

  // Fallback to English
  if (currentLocale !== 'en' && key in translations.en) {
    return translations.en[key];
  }

  // Key not found anywhere — return the key itself as fallback
  return key;
}

/**
 * Translate with template parameters.
 * e.g. tf('snapshot.depth', { n: 70 }) → "深さ70km"
 */
export function tf(key: string, params: Record<string, string | number>): string {
  let result = t(key);
  for (const [k, v] of Object.entries(params)) {
    result = result.replaceAll(`{${k}}`, String(v));
  }
  return result;
}

/**
 * Subscribe to locale changes.
 * Returns an unsubscribe function.
 */
export function onLocaleChange(fn: (locale: Locale) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
