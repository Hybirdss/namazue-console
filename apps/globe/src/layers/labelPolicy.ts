export type LabelBounds = [number, number, number, number];

export interface LabelCandidate {
  lat: number;
  lng: number;
  inZone?: boolean;
  selected?: boolean;
}

export interface LabelPolicyOptions<T extends LabelCandidate> {
  bounds?: LabelBounds | null;
  cap: number;
  getPriority: (candidate: T) => number;
  focus?: { lat: number; lng: number } | null;
  padDeg?: number;
}

function isWithinBounds(
  lat: number,
  lng: number,
  bounds: LabelBounds,
  padDeg: number,
): boolean {
  const [minLng, minLat, maxLng, maxLat] = bounds;
  return (
    lng >= minLng - padDeg
    && lng <= maxLng + padDeg
    && lat >= minLat - padDeg
    && lat <= maxLat + padDeg
  );
}

function distanceScore(
  candidate: LabelCandidate,
  focus?: { lat: number; lng: number } | null,
): number {
  if (!focus) return 0;
  const latDelta = candidate.lat - focus.lat;
  const lngDelta = candidate.lng - focus.lng;
  return Math.sqrt((latDelta * latDelta) + (lngDelta * lngDelta));
}

export function pickVisibleLabels<T extends LabelCandidate>(
  candidates: T[],
  options: LabelPolicyOptions<T>,
): T[] {
  const filtered = options.bounds
    ? candidates.filter((candidate) => isWithinBounds(candidate.lat, candidate.lng, options.bounds!, options.padDeg ?? 0.35))
    : candidates;

  return [...filtered]
    .sort((left, right) => {
      const scoreLeft = (left.selected ? 1000 : 0) + (left.inZone ? 200 : 0) + options.getPriority(left);
      const scoreRight = (right.selected ? 1000 : 0) + (right.inZone ? 200 : 0) + options.getPriority(right);

      if (scoreLeft !== scoreRight) {
        return scoreRight - scoreLeft;
      }

      return distanceScore(left, options.focus) - distanceScore(right, options.focus);
    })
    .slice(0, options.cap);
}
