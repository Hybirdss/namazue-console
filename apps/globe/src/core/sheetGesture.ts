/**
 * Sheet Gesture Engine — Google Maps-style 3-snap bottom sheet.
 *
 * Snap points: peek (72px) → half (48vh) → full (92vh)
 * Drag via pointer events, velocity-based snap decision.
 * Spring easing: cubic-bezier(0.32, 0.72, 0, 1)
 */

export type SnapPoint = 'peek' | 'half' | 'full';

interface SheetGestureOptions {
  sheetEl: HTMLElement;
  handleSelector?: string;
  onSnap?: (snap: SnapPoint) => void;
}

const SPRING = 'transform 0.42s cubic-bezier(0.32, 0.72, 0, 1)';
const VELOCITY_THRESHOLD = 0.4; // px/ms — fast flick jumps to next snap

export function installSheetGesture(opts: SheetGestureOptions): {
  snapTo: (snap: SnapPoint) => void;
  getSnap: () => SnapPoint;
  dispose: () => void;
} {
  const { sheetEl } = opts;
  const sel = opts.handleSelector ?? '.nz-sheet__handle';
  const handleEl = sheetEl.querySelector(sel) as HTMLElement;
  if (!handleEl) throw new Error(`Sheet requires ${sel}`);

  let currentSnap: SnapPoint = 'peek';

  // Compute snap Y values in pixels (from top of sheet container)
  function getSnapY(snap: SnapPoint): number {
    const vh = window.innerHeight;
    const peekH = 72;
    const halfH = vh * 0.48;
    const fullH = vh * 0.92;
    // translateY value: how far to push the sheet down
    if (snap === 'peek') return fullH - peekH;
    if (snap === 'half') return fullH - halfH;
    return 0; // full: no translation
  }

  function getFullHeight(): number {
    return window.innerHeight * 0.92;
  }

  function applyY(y: number, animated: boolean): void {
    sheetEl.style.transition = animated ? SPRING : 'none';
    sheetEl.style.transform = `translateY(${y}px)`;
  }

  function commitSnap(snap: SnapPoint): void {
    currentSnap = snap;
    sheetEl.setAttribute('data-snap', snap);
    applyY(getSnapY(snap), true);
    opts.onSnap?.(snap);
  }

  function nearestSnap(translateY: number): SnapPoint {
    const snaps: SnapPoint[] = ['peek', 'half', 'full'];
    let best: SnapPoint = 'peek';
    let bestDist = Infinity;
    for (const s of snaps) {
      const d = Math.abs(translateY - getSnapY(s));
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    }
    return best;
  }

  // Order: peek > half > full (peek = most collapsed)
  function nextUp(snap: SnapPoint): SnapPoint {
    if (snap === 'peek') return 'half';
    return 'full';
  }

  function nextDown(snap: SnapPoint): SnapPoint {
    if (snap === 'full') return 'half';
    return 'peek';
  }

  // ── Pointer tracking ────────────────────────────────────
  let dragging = false;
  let startPointerY = 0;
  let startTranslateY = 0;
  let currentTranslateY = getSnapY('peek');
  let lastPointerY = 0;
  let lastTime = 0;
  let velocity = 0;

  function onPointerDown(e: PointerEvent): void {
    // Only handle primary pointer (single finger)
    if (!e.isPrimary) return;

    dragging = true;
    startPointerY = e.clientY;
    lastPointerY = e.clientY;
    lastTime = performance.now();
    startTranslateY = currentTranslateY;
    velocity = 0;

    handleEl.setPointerCapture(e.pointerId);
    applyY(currentTranslateY, false);
  }

  function onPointerMove(e: PointerEvent): void {
    if (!dragging) return;

    const now = performance.now();
    const dt = now - lastTime;
    const dy = e.clientY - lastPointerY;
    if (dt > 0) velocity = dy / dt;
    lastTime = now;
    lastPointerY = e.clientY;

    const delta = e.clientY - startPointerY;
    const maxY = getSnapY('peek');
    currentTranslateY = Math.max(0, Math.min(startTranslateY + delta, maxY));
    applyY(currentTranslateY, false);
  }

  function onPointerUp(_e: PointerEvent): void {
    if (!dragging) return;
    dragging = false;

    let target: SnapPoint;
    if (velocity > VELOCITY_THRESHOLD) {
      // Fast flick DOWN → collapse
      target = nextDown(nearestSnap(currentTranslateY));
    } else if (velocity < -VELOCITY_THRESHOLD) {
      // Fast flick UP → expand
      target = nextUp(nearestSnap(currentTranslateY));
    } else {
      target = nearestSnap(currentTranslateY);
    }

    currentTranslateY = getSnapY(target);
    commitSnap(target);
  }

  handleEl.addEventListener('click', () => {
    // Only toggle if it wasn't a drag (small movement)
    if (Math.abs(lastPointerY - startPointerY) > 5) return;

    if (currentSnap === 'peek') {
      currentTranslateY = getSnapY('half');
      commitSnap('half');
    } else {
      currentTranslateY = getSnapY('peek');
      commitSnap('peek');
    }
  });

  handleEl.addEventListener('pointerdown', onPointerDown);
  handleEl.addEventListener('pointermove', onPointerMove);
  handleEl.addEventListener('pointerup', onPointerUp);
  handleEl.addEventListener('pointercancel', onPointerUp);

  // Recalc on resize
  function onResize(): void {
    currentTranslateY = getSnapY(currentSnap);
    applyY(currentTranslateY, false);
  }
  window.addEventListener('resize', onResize);

  // Initialize to peek
  sheetEl.style.height = `${getFullHeight()}px`;
  commitSnap('peek');

  return {
    snapTo(snap: SnapPoint): void {
      currentTranslateY = getSnapY(snap);
      commitSnap(snap);
    },
    getSnap(): SnapPoint {
      return currentSnap;
    },
    dispose(): void {
      handleEl.removeEventListener('pointerdown', onPointerDown);
      handleEl.removeEventListener('pointermove', onPointerMove);
      handleEl.removeEventListener('pointerup', onPointerUp);
      handleEl.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('resize', onResize);
    },
  };
}
