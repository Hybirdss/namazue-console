/**
 * Keyboard Help Overlay — Shows available keyboard shortcuts.
 *
 * Triggered by '?' key. Dismisses with Escape or another '?'.
 * Glassmorphism overlay matching console design language.
 */

import { t } from '../i18n';

const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);

function getShortcutGroups() {
  return [
    {
      title: t('shortcuts.navigation'),
      shortcuts: [
        { keys: [isMac ? '⌘' : 'Ctrl', 'K'], label: t('shortcuts.commandPalette') },
        { keys: ['J', '/', 'K'], label: t('shortcuts.nextPrevEvent') },
        { keys: ['1–5'], label: t('shortcuts.switchBundle') },
        { keys: ['Esc'], label: t('shortcuts.closeOverlay') },
      ],
    },
    {
      title: t('shortcuts.controls'),
      shortcuts: [
        { keys: ['S'], label: t('shortcuts.toggleScenario') },
        { keys: ['B'], label: t('shortcuts.toggleDrawer') },
        { keys: ['P'], label: t('shortcuts.togglePanels') },
        { keys: ['F'], label: t('shortcuts.toggleFaults') },
        { keys: ['H'], label: t('shortcuts.resetView') },
      ],
    },
    {
      title: t('shortcuts.information'),
      shortcuts: [
        { keys: ['?'], label: t('shortcuts.showHelp') },
        { keys: [','], label: t('shortcuts.openSettings') },
      ],
    },
  ];
}

function renderHelp(): string {
  const groups = getShortcutGroups().map((group) => {
    const rows = group.shortcuts.map((s) => {
      const keys = s.keys.map((k) => `<kbd class="nz-help__key">${k}</kbd>`).join('');
      return `
        <div class="nz-help__row">
          <span class="nz-help__keys">${keys}</span>
          <span class="nz-help__label">${s.label}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="nz-help__group">
        <div class="nz-help__group-title">${group.title}</div>
        ${rows}
      </div>
    `;
  }).join('');

  return `
    <div class="nz-help">
      <div class="nz-help__header">
        <span class="nz-help__title">${t('help.title')}</span>
        <kbd class="nz-help__key">?</kbd>
      </div>
      ${groups}
    </div>
  `;
}

export interface KeyboardHelp {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  dispose(): void;
}

export function createKeyboardHelp(): KeyboardHelp {
  let visible = false;

  const overlay = document.createElement('div');
  overlay.className = 'nz-help-overlay';

  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) close();
  });

  function open(): void {
    if (visible) return;
    visible = true;
    overlay.innerHTML = renderHelp();  // re-render on each open
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('nz-help-overlay--open'));
  }

  function close(): void {
    if (!visible) return;
    visible = false;
    overlay.classList.remove('nz-help-overlay--open');
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
    dispose() {
      close();
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    },
  };
}
