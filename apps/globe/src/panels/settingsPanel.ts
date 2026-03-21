/**
 * Settings Panel — Operator preferences overlay.
 *
 * Gear icon in system bar opens a glassmorphism overlay with:
 *   - Timeline defaults
 *   - Notification preferences
 *   - Keyboard shortcuts reference
 *   - Display options
 *
 * All settings persist in localStorage via the preferences module.
 */

import {
  loadPreferences,
  savePreferences,
  getDefaultPreferences,
  type ConsolePreferences,
} from '../core/preferences';
import { t } from '../i18n';

// ── Types ─────────────────────────────────────────────────────

const userAgent = typeof navigator === 'object' && typeof navigator.userAgent === 'string'
  ? navigator.userAgent
  : '';
const isMac = /Mac|iPhone|iPad/.test(userAgent);
const MOD = isMac ? '⌘' : 'Ctrl';

function getShortcutSections() {
  return [
    {
      title: t('shortcuts.navigation'),
      items: [
        { keys: `${MOD}+K`, label: t('shortcuts.commandPalette') },
        { keys: '1–5', label: t('shortcuts.switchBundle') },
        { keys: 'J / K', label: t('shortcuts.nextPrevEvent') },
        { keys: 'T', label: t('shortcuts.cycleTimeline') },
        { keys: 'Esc', label: t('shortcuts.closeOverlay') },
      ],
    },
    {
      title: t('shortcuts.controls'),
      items: [
        { keys: 'S', label: t('shortcuts.toggleScenario') },
        { keys: 'B', label: t('shortcuts.toggleDrawer') },
        { keys: 'P', label: t('shortcuts.togglePanels') },
        { keys: 'F', label: t('shortcuts.toggleFaults') },
        { keys: ',', label: t('shortcuts.openSettings') },
      ],
    },
    {
      title: t('shortcuts.information'),
      items: [
        { keys: '?', label: t('shortcuts.showHelp') },
      ],
    },
  ];
}

const MAG_OPTIONS = [
  { value: 2.5, label: 'M2.5+' },
  { value: 3.0, label: 'M3.0+' },
  { value: 4.0, label: 'M4.0+' },
  { value: 5.0, label: 'M5.0+' },
];

interface MethodologyReference {
  label: string;
  href: string;
}

function getMethodologyReferences(): {
  academic: MethodologyReference[];
  public: MethodologyReference[];
} {
  return {
    academic: [
      {
        label: 'Si & Midorikawa (1999) — Ground-motion attenuation model',
        href: 'https://www.jstage.jst.go.jp/article/aijs1998/64/523/64_523_63/_article',
      },
      {
        label: 'Si & Midorikawa (2000) — PGA/PGV attenuation relations',
        href: 'https://www.iitk.ac.in/nicee/wcee/article/0532.pdf',
      },
      {
        label: 'Midorikawa, Fujimoto & Muramatsu (1999) — PGV to JMA intensity correlation',
        href: 'https://www.jstage.jst.go.jp/article/jisss/1/0/1_0_51/_article/-char/en',
      },
      {
        label: 'Wells & Coppersmith (1994) — Rupture-length and magnitude scaling',
        href: 'https://doi.org/10.1785/BSSA0840040974',
      },
      {
        label: 'Hayes et al. (2018) — Slab2 subduction geometry model',
        href: 'https://doi.org/10.1126/science.aat4723',
      },
      {
        label: 'Bird (2003) — Global plate boundary model',
        href: 'https://doi.org/10.1029/2001GC000252',
      },
      {
        label: 'Kagan (2002) — Aftershock zone scaling',
        href: 'https://doi.org/10.1785/0120000613',
      },
      {
        label: 'Ueno et al. (2002) — JMA seismic network procedures',
        href: 'https://www.data.jma.go.jp/svd/eqev/data/bulletin/data/kaisetsu/gaikyo/QJ_65.pdf',
      },
      {
        label: 'Abrahamson, Silva & Kamai (2014) — NGA-West2 ground-motion model',
        href: 'https://doi.org/10.1193/070913EQS198M',
      },
      {
        label: 'Boore, Stewart, Seyhan & Atkinson (2014) — NGA-West2 GMPE',
        href: 'https://doi.org/10.1193/070113EQS184M',
      },
      {
        label: 'Campbell & Bozorgnia (2014) — NGA-West2 horizontal PGA/PGV model',
        href: 'https://doi.org/10.1193/062913EQS175M',
      },
      {
        label: 'Nakamura (1988) — UrEDAS early detection concept',
        href: 'https://www.iitk.ac.in/nicee/wcee/article/9_vol7_673.pdf',
      },
    ],
    public: [
      {
        label: 'USGS FDSN Event Web Service',
        href: 'https://earthquake.usgs.gov/fdsnws/event/1/',
      },
      {
        label: 'USGS GeoJSON Summary Feeds',
        href: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php',
      },
      {
        label: 'JMA Seismological Bulletin of Japan',
        href: 'https://www.data.jma.go.jp/eqev/data/bulletin/',
      },
      {
        label: 'JMA Instrumental Intensity Computation Method',
        href: 'https://www.data.jma.go.jp/eqev/data/kyoshin/kaisetsu/calc_sindo.html',
      },
      {
        label: 'JMA XML / Disaster Information Feed Documentation',
        href: 'https://www.data.jma.go.jp/developer/xml/',
      },
      {
        label: 'NIED MOWLAS',
        href: 'https://www.mowlas.bosai.go.jp/',
      },
      {
        label: 'NIED J-SHIS',
        href: 'https://www.j-shis.bosai.go.jp/',
      },
      {
        label: 'HERP Long-term Earthquake Evaluation',
        href: 'https://www.jishin.go.jp/evaluation/long_term_evaluation/',
      },
      {
        label: 'GSI Active Fault Information',
        href: 'https://www.gsi.go.jp/bousaichiri/activefault.html',
      },
      {
        label: 'Cabinet Office — Tokyo Inland Earthquake Damage Assumptions',
        href: 'https://www.bousai.go.jp/jishin/syuto/',
      },
      {
        label: 'Cabinet Office — Nankai Trough Earthquake Measures',
        href: 'https://www.bousai.go.jp/jishin/nankai/',
      },
      {
        label: 'Statistics Bureau (MIC) Population Estimates',
        href: 'https://www.stat.go.jp/english/data/jinsui/index.html',
      },
      {
        label: 'NRA Regulatory Overview',
        href: 'https://www.nra.go.jp/english/regulatory/overview/index.html',
      },
      {
        label: 'Project PLATEAU',
        href: 'https://www.mlit.go.jp/plateau/en/',
      },
      {
        label: 'ODPT Developer Portal',
        href: 'https://developer.odpt.org/',
      },
    ],
  };
}

type SettingsTab = 'general' | 'methodology';

// ── Render ────────────────────────────────────────────────────

function renderGeneralSettingsMarkup(prefs: ConsolePreferences): string {
  const shortcutRows = getShortcutSections().map((section) => {
    const rows = section.items.map((item) => `
      <div class="nz-settings__shortcut-row">
        <kbd class="nz-settings__kbd">${item.keys}</kbd>
        <span class="nz-settings__shortcut-label">${item.label}</span>
      </div>
    `).join('');
    return `
      <div class="nz-settings__shortcut-group">
        <div class="nz-settings__shortcut-group-title">${section.title}</div>
        ${rows}
      </div>
    `;
  }).join('');

  const notifOn = prefs.notifications.enabled;
  const soundOn = prefs.notifications.soundEnabled;
  const coordsOn = prefs.display.showCoordinates;
  const kbOn = prefs.keyboard.enabled;

  const magOptions = MAG_OPTIONS.map((opt) =>
    `<option value="${opt.value}"${prefs.notifications.minMagnitude === opt.value ? ' selected' : ''}>${opt.label}</option>`
  ).join('');

  return `

    <div class="nz-settings__divider"></div>

    <div class="nz-settings__section">
      <div class="nz-settings__section-title">${t('settings.notifications')}</div>
      <div class="nz-settings__row">
        <span class="nz-settings__label">${t('settings.eventAlerts')}</span>
        <button class="nz-settings__switch${notifOn ? ' nz-settings__switch--on' : ''}" data-setting="notifications-enabled">
          ${notifOn ? t('settings.on') : t('settings.off')}
        </button>
      </div>
      <div class="nz-settings__row">
        <span class="nz-settings__label">${t('settings.minMagnitude')}</span>
        <select class="nz-settings__select" data-setting="notifications-mag">
          ${magOptions}
        </select>
      </div>
      <div class="nz-settings__row">
        <span class="nz-settings__label">${t('settings.alertSound')}</span>
        <button class="nz-settings__switch${soundOn ? ' nz-settings__switch--on' : ''}" data-setting="notifications-sound">
          ${soundOn ? t('settings.on') : t('settings.off')}
        </button>
      </div>
      <div class="nz-settings__hint">${t('settings.soundHint')}</div>
    </div>

    <div class="nz-settings__divider"></div>

    <div class="nz-settings__section">
      <div class="nz-settings__section-title">${t('settings.keyboard')}</div>
      <div class="nz-settings__row">
        <span class="nz-settings__label">${t('settings.shortcutsEnabled')}</span>
        <button class="nz-settings__switch${kbOn ? ' nz-settings__switch--on' : ''}" data-setting="keyboard-enabled">
          ${kbOn ? t('settings.on') : t('settings.off')}
        </button>
      </div>
      <div class="nz-settings__shortcuts">
        ${shortcutRows}
      </div>
    </div>

    <div class="nz-settings__divider"></div>

    <div class="nz-settings__section">
      <div class="nz-settings__section-title">${t('settings.display')}</div>
      <div class="nz-settings__row">
        <span class="nz-settings__label">${t('settings.showCoordinates')}</span>
        <button class="nz-settings__switch${coordsOn ? ' nz-settings__switch--on' : ''}" data-setting="display-coordinates">
          ${coordsOn ? t('settings.on') : t('settings.off')}
        </button>
      </div>
    </div>

    <div class="nz-settings__divider"></div>

    <div class="nz-settings__section">
      <div class="nz-settings__row nz-settings__row--center">
        <button class="nz-settings__reset-btn" data-action="reset">${t('settings.resetDefaults')}</button>
      </div>
    </div>
  `;
}

function renderMethodologySettingsMarkup(): string {
  const refs = getMethodologyReferences();
  const academicReferences = refs.academic
    .map((reference) => `
      <li class="nz-settings__reference-item">
        <a class="nz-settings__reference-link" href="${reference.href}" target="_blank" rel="noreferrer noopener">${reference.label}</a>
      </li>
    `)
    .join('');
  const publicReferences = refs.public
    .map((reference) => `
      <li class="nz-settings__reference-item">
        <a class="nz-settings__reference-link" href="${reference.href}" target="_blank" rel="noreferrer noopener">${reference.label}</a>
      </li>
    `)
    .join('');

  return `
    <div class="nz-settings__section">
      <div class="nz-settings__section-title">${t('settings.tab.methodology')}</div>
      <div class="nz-settings__methodology-copy">
        ${t('settings.methodology.desc')}
      </div>
      <div class="nz-settings__notice">
        ${t('settings.methodology.betaNotice')}
      </div>
      <div class="nz-settings__audit">${t('settings.methodology.lastAudited')}</div>
    </div>

    <div class="nz-settings__divider"></div>

    <div class="nz-settings__section">
      <div class="nz-settings__reference-header">${t('settings.methodology.referenceHeader')}</div>
      <div class="nz-settings__reference-group">
        <div class="nz-settings__reference-title">${t('settings.methodology.academic')}</div>
        <ul class="nz-settings__reference-list">
          ${academicReferences}
        </ul>
      </div>
      <div class="nz-settings__reference-group">
        <div class="nz-settings__reference-title">${t('settings.methodology.public')}</div>
        <ul class="nz-settings__reference-list">
          ${publicReferences}
        </ul>
      </div>
    </div>
  `;
}

export function renderSettingsMarkup(
  prefs: ConsolePreferences,
  activeTab: SettingsTab = 'general',
): string {
  const generalActive = activeTab === 'general' ? ' nz-settings__tab-btn--active' : '';
  const methodologyActive = activeTab === 'methodology' ? ' nz-settings__tab-btn--active' : '';
  const bodyMarkup = activeTab === 'methodology'
    ? renderMethodologySettingsMarkup()
    : renderGeneralSettingsMarkup(prefs);

  return `
    <div class="nz-settings">
      <div class="nz-settings__header">
        <span class="nz-settings__title">${t('settings.title')}</span>
        <button class="nz-settings__close" data-action="close">×</button>
      </div>

      <div class="nz-settings__tabs">
        <button class="nz-settings__tab-btn${generalActive}" data-tab="general">${t('settings.tab.general')}</button>
        <button class="nz-settings__tab-btn${methodologyActive}" data-tab="methodology">${t('settings.tab.methodology')}</button>
      </div>

      <div class="nz-settings__body">
        ${bodyMarkup}
      </div>
    </div>
  `;
}

// ── Mount ─────────────────────────────────────────────────────

export interface SettingsPanel {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  getPreferences(): ConsolePreferences;
  dispose(): void;
}

export function createSettingsPanel(
  onPreferencesChange: (prefs: ConsolePreferences) => void,
): SettingsPanel {
  let visible = false;
  let prefs = loadPreferences();
  let activeTab: SettingsTab = 'general';

  const overlay = document.createElement('div');
  overlay.className = 'nz-settings-overlay';

  function render(): void {
    overlay.innerHTML = renderSettingsMarkup(prefs, activeTab);
    bindInteractions();
  }

  function bindInteractions(): void {
    // Close button
    overlay.querySelector('[data-action="close"]')?.addEventListener('click', () => close());

    overlay.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTab = (btn.dataset.tab as SettingsTab) || 'general';
        render();
      });
    });

    // Notifications toggle
    overlay.querySelector('[data-setting="notifications-enabled"]')?.addEventListener('click', () => {
      prefs.notifications.enabled = !prefs.notifications.enabled;
      save();
      render();
    });

    // Notifications magnitude
    overlay.querySelector<HTMLSelectElement>('[data-setting="notifications-mag"]')?.addEventListener('change', (e) => {
      prefs.notifications.minMagnitude = Number((e.target as HTMLSelectElement).value);
      save();
    });

    // Sound toggle
    overlay.querySelector('[data-setting="notifications-sound"]')?.addEventListener('click', () => {
      prefs.notifications.soundEnabled = !prefs.notifications.soundEnabled;
      save();
      render();
    });

    // Keyboard toggle
    overlay.querySelector('[data-setting="keyboard-enabled"]')?.addEventListener('click', () => {
      prefs.keyboard.enabled = !prefs.keyboard.enabled;
      save();
      render();
    });

    // Display coordinates
    overlay.querySelector('[data-setting="display-coordinates"]')?.addEventListener('click', () => {
      prefs.display.showCoordinates = !prefs.display.showCoordinates;
      save();
      render();
    });

    // Reset
    overlay.querySelector('[data-action="reset"]')?.addEventListener('click', () => {
      prefs = getDefaultPreferences();
      save();
      render();
    });
  }

  function save(): void {
    savePreferences(prefs);
    onPreferencesChange(prefs);
  }

  // Backdrop click
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) close();
  });

  function open(): void {
    if (visible) return;
    visible = true;
    prefs = loadPreferences();
    activeTab = 'general';
    render();
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('nz-settings-overlay--open'));
  }

  function close(): void {
    if (!visible) return;
    visible = false;
    overlay.classList.remove('nz-settings-overlay--open');
    setTimeout(() => {
      if (!visible && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 200);
  }

  function toggle(): void {
    if (visible) close(); else open();
  }

  return {
    open,
    close,
    toggle,
    isOpen: () => visible,
    getPreferences: () => ({ ...prefs }),
    dispose() {
      close();
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    },
  };
}
