/**
 * Path smoothing for deck.gl polyline layers.
 *
 * smoothPath       — Catmull-Rom spline for rail/generic paths.
 * smoothFaultLine  — Geological pipeline for natural-looking fault traces:
 *                    noise → Chaikin → Catmull-Rom.
 */

type Coord = [number, number];

// ── Catmull-Rom ─────────────────────────────────────────────

function catmullRom(
  p0: number, p1: number, p2: number, p3: number, t: number,
): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

/**
 * Smooth a polyline path using Catmull-Rom spline interpolation.
 * Used for rail routes and generic paths.
 */
export function smoothPath(points: Coord[], segments = 4): Coord[] {
  if (points.length < 3) return points;

  const result: Coord[] = [points[0]];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    for (let j = 1; j <= segments; j++) {
      const t = j / segments;
      result.push([
        catmullRom(p0[0], p1[0], p2[0], p3[0], t),
        catmullRom(p0[1], p1[1], p2[1], p3[1], t),
      ]);
    }
  }

  return result;
}

// ── Chaikin's Corner-Cutting ────────────────────────────────
// Standard cartographic technique: each iteration replaces sharp
// corners with two new points at 25%/75% along adjacent edges.

function chaikinSmooth(points: Coord[], iterations: number): Coord[] {
  if (points.length < 3) return points;

  let pts = points;
  for (let iter = 0; iter < iterations; iter++) {
    const out: Coord[] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}

// ── Geological Micro-Perturbation ───────────────────────────
// Adds subtle perpendicular waviness to break up artificially
// regular point spacing. Uses multi-frequency sine modulation
// parameterized by arc length for smooth, deterministic results.

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

function geologicalNoise(
  points: Coord[], seed: number, amplitude: number,
): Coord[] {
  if (points.length < 3 || amplitude <= 0) return points;

  const n = points.length;
  const result: Coord[] = [points[0]];

  // Cumulative arc length for smooth parameterization
  const arc: number[] = [0];
  for (let i = 1; i < n; i++) {
    const dx = points[i][0] - points[i - 1][0];
    const dy = points[i][1] - points[i - 1][1];
    arc.push(arc[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  const total = arc[n - 1];
  if (total < 1e-10) return points;

  // Deterministic frequencies and phases from seed
  const f1 = 3 + (seed % 5);          // 3-7 undulations
  const f2 = 8 + ((seed * 3) % 5);    // 8-12 detail freq
  const ph1 = (seed * 2.718) % (Math.PI * 2);
  const ph2 = (seed * 1.414) % (Math.PI * 2);

  for (let i = 1; i < n - 1; i++) {
    const t = arc[i] / total;

    // Smooth envelope: zero at endpoints, max at center
    const envelope = Math.sin(t * Math.PI);

    // Multi-frequency undulation
    const wave =
      0.6 * Math.sin(f1 * t * Math.PI * 2 + ph1) +
      0.3 * Math.sin(f2 * t * Math.PI * 2 + ph2) +
      0.1 * Math.sin((f1 + f2) * t * Math.PI * 2);

    // Perpendicular normal to local fault direction
    const prev = points[i - 1];
    const next = points[i + 1];
    const dx = next[0] - prev[0];
    const dy = next[1] - prev[1];
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len < 1e-10) {
      result.push(points[i]);
      continue;
    }

    const nx = -dy / len;
    const ny = dx / len;
    const offset = wave * envelope * amplitude;

    result.push([
      points[i][0] + nx * offset,
      points[i][1] + ny * offset,
    ]);
  }

  result.push(points[n - 1]);
  return result;
}

// ── Geological Fault Line Pipeline ──────────────────────────

/**
 * Smooth fault line geometry for natural-looking rendering.
 *
 * Two modes based on faultType:
 *
 * CRUSTAL faults (hand-digitized, irregular spacing):
 *   1. Geological noise — perpendicular micro-waviness
 *   2. Chaikin corner-cutting (3 iterations)
 *   3. Catmull-Rom spline (8 segments)
 *
 * INTERFACE / plate boundary faults (PB2002, already precise):
 *   1. Catmull-Rom only (4 segments) — gentle interpolation
 *   No noise, no Chaikin — authoritative coordinates must not be distorted.
 */
export function smoothFaultLine(
  points: Coord[],
  faultId: string,
  lengthKm: number,
  faultType: string = 'crustal',
): Coord[] {
  if (points.length < 3) return points;

  // Plate boundary faults: PB2002 data is already precise enough.
  // NO smoothing — raw coordinates preserve exact junction points.
  if (faultType === 'interface') {
    return points;
  }

  // Crustal faults: full noise → Chaikin → Catmull-Rom pipeline
  const amplitude = Math.min(0.015, 0.002 + lengthKm * 0.000015);
  const seed = hashStr(faultId);

  const noisy = geologicalNoise(points, seed, amplitude);
  const rounded = chaikinSmooth(noisy, 3);
  return smoothPath(rounded, 8);
}
