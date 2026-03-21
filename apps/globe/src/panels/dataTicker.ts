/**
 * Data Stream Ticker — Bottom bar scrolling data feed.
 *
 * Bloomberg-terminal / SIGINT-style scrolling ticker showing
 * real-time data flow: recent earthquakes, vessel count,
 * monitoring status. Mono font, left-to-right continuous scroll.
 */

import { consoleStore } from '../core/store';
import { t, tf } from '../i18n';
import { localizedPerformanceTone } from '../utils/severityLabels';
import { escapeHtml } from '../utils/escapeHtml';

const UPDATE_INTERVAL_MS = 30_000;

function formatJST(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function buildTickerText(): string {
  const items: string[] = [];

  // Recent earthquakes (last 5)
  const events = consoleStore.get('events');
  const sorted = [...events].sort((a, b) => b.time - a.time).slice(0, 5);
  for (const e of sorted) {
    const time = formatJST(e.time);
    const place = escapeHtml(e.place?.text ?? t('ticker.unknown'));
    items.push(`${time} JST M${e.magnitude.toFixed(1)} ${place} ${Math.round(e.depth_km)}km`);
  }

  // Vessel count
  const vessels = consoleStore.get('vessels');
  if (vessels.length > 0) {
    items.push(`${formatJST(Date.now())} ${tf('ticker.vessels', { n: vessels.length })}`);
  }

  // Monitoring status
  const performance = consoleStore.get('performanceStatus');
  items.push(`${formatJST(Date.now())} ${t('ticker.monitoring')}`);
  items.push(`FPS ${Math.round(performance.fps)} ${localizedPerformanceTone(performance.tone)}`);

  return items.join(' \u2500\u2500\u2500 ');
}

export function mountDataTicker(container: HTMLElement): () => void {
  container.classList.add('nz-ticker');

  const track = document.createElement('div');
  track.className = 'nz-ticker__track';
  container.appendChild(track);

  function update(): void {
    const text = buildTickerText();
    // Duplicate content for seamless loop
    track.innerHTML = `<span>${text} \u2500\u2500\u2500 </span><span>${text} \u2500\u2500\u2500 </span>`;
  }

  update();
  const timer = setInterval(update, UPDATE_INTERVAL_MS);

  // Also update when events or vessels change
  const unsubEvents = consoleStore.subscribe('events', () => update());
  const unsubVessels = consoleStore.subscribe('vessels', () => update());
  const unsubPerf = consoleStore.subscribe('performanceStatus', () => update());

  return () => {
    clearInterval(timer);
    unsubEvents();
    unsubVessels();
    unsubPerf();
    container.innerHTML = '';
  };
}
