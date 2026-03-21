/**
 * Si & Midorikawa (1999, revised 2006) GMPE — Pure Functions
 *
 * Ground Motion Prediction Equation for predicting PGV on Vs30=600 m/s bedrock.
 * All functions are pure: no side effects, no DOM access.
 *
 * Reference:
 *   Si, H. and Midorikawa, S. (1999). "New Attenuation Relationships for
 *   Peak Ground Acceleration and Velocity Considering Effects of Fault Type
 *   and Site Condition." Journal of Structural and Construction Engineering
 *   (Transactions of AIJ), No. 523, pp. 63-70.
 */

import type {
  FaultType,
  GmpeInput,
  GmpeResult,
  IntensityGrid,
  JmaClass,
  Vs30Grid,
} from '../types';

// ============================================================
// Constants
// ============================================================

const EARTH_RADIUS_KM = 6371;
const DEG_TO_RAD = Math.PI / 180;

/**
 * Vs30 amplification factor: Vs600 -> default site condition.
 *
 * Japanese urban areas (alluvial plains: Kanto, Osaka, Nobi) have average
 * Vs30 ≈ 250-350 m/s (J-SHIS microzonation data). Using Vs30=270 m/s
 * as the population-weighted urban default:
 *   amp = (600/270)^0.6 ≈ 1.55
 *
 * Previous value 1.41 (Vs30=400) was appropriate for firm rock sites but
 * systematically underestimated intensity in populated areas where soil
 * amplification is the primary damage driver.
 *
 * Reference: Midorikawa et al. (2006) site amplification model.
 * When per-cell Vs30 grid is available, vs30ToAmp() overrides this default.
 */
export const DEFAULT_SITE_AMP_FACTOR = 1.55;
export const PGV_TO_JMA_INTERCEPT = 2.68;
export const PGV_TO_JMA_SLOPE = 1.72;

/** Fault-type correction coefficients */
const FAULT_CORRECTION: Record<FaultType, number> = {
  crustal: 0.0,
  interface: -0.02,
  intraslab: 0.12,
};

/**
 * Maximum Mw for the GMPE regression.
 *
 * Si & Midorikawa (1999) original: calibrated on data up to M~8.3.
 * Raised to 9.5 to allow extrapolation for mega-earthquakes (M8.5-9.1+).
 * Without this, M9.0 events are computed as M8.3 → JMA 4 max instead of
 * the observed JMA 7 (Tohoku 2011). The formula structure (log-linear in
 * Mw, near-source saturation term) supports reasonable extrapolation.
 *
 * For M > 8.3, the finite-fault distance correction (Wells & Coppersmith
 * rupture length) is essential to produce realistic elongated isoseismals.
 */
const MW_CAP = 9.5;

// ── Deep Earthquake Corrections ────────────────────────────────────
//
// Si & Midorikawa (1999) depth coefficient (0.0038×D) was calibrated on
// events predominantly at D ≤ 60 km. Extrapolation to deep intraslab
// events overestimates PGV because:
//
// (1) Depth–amplitude amplification saturates beyond the brittle-ductile
//     transition zone (~60 km), as source radiation efficiency decreases
//     and stress-drop characteristics change
// (2) Deep wavepaths traverse more mantle-wedge material with higher
//     anelastic attenuation than the generic −0.002/km coefficient
//     derived from the predominantly shallow-event dataset
//
// Two corrections are applied, consistent with the approaches in:
//   Zhao et al. (2006) "Attenuation Relations of Strong Ground Motion in
//     Japan Using Site Classification Based on Predominant Period"
//     BSSA 96:898-913
//   Kanno et al. (2006) "A New Attenuation Relation for Strong Ground
//     Motion in Japan Based on Recorded Data" BSSA 96:879-897
//   Morikawa & Fujiwara (2013) "A New Ground Motion Prediction Equation
//     for Japan Applicable to All Prediction Distances" JGR Solid Earth
//
// (A) Depth term saturation — replaces 0.0038 × D with 0.0038 × D_eff:
//     D ≤ 60 km: D_eff = D (original, unchanged)
//     D > 60 km: D_eff = 60 + 10 × (1 − exp(−(D − 60) / 50))
//     Maximum effective depth contribution: ~70 km (saturates)
//
//     Verification:
//       D = 10:   D_eff = 10.0  (term 0.038, unchanged)
//       D = 60:   D_eff = 60.0  (term 0.228, unchanged)
//       D = 100:  D_eff = 65.5  (term 0.249, was 0.380, −34%)
//       D = 150:  D_eff = 68.3  (term 0.260, was 0.570, −54%)
//       D = 300:  D_eff = 69.9  (term 0.266, was 1.140, −77%)
//
// (B) Depth-dependent anelastic attenuation — replaces fixed 0.002/km:
//     D ≤ 60 km: k = 0.002 (original, unchanged)
//     D > 60 km: k = 0.002 + 0.002 × (D − 60) / 100
//     At D=150 km: k = 0.0038/km (+90% over baseline)
//
//     Physical basis: the mantle wedge above the subducting slab has
//     quality factor Q ≈ 100-300, significantly lower than the Q ≈ 500+
//     assumed by the original 0.002 coefficient. Deeper intraslab events
//     have longer ray-paths through this low-Q region.

const DEPTH_BREAK = 60;        // km — upper bound of calibration range
const DEPTH_ASYM_RANGE = 10;   // km — D_eff asymptotes to DEPTH_BREAK + this
const DEPTH_TAU = 50;          // km — e-folding scale for saturation
const ATTEN_DEEP_RATE = 0.002; // additional atten scaling (/km per 100 km excess depth)

/**
 * Effective depth for the 0.0038×D depth amplification term.
 * Returns D unchanged for D ≤ 60 km; saturates toward 70 km for deeper events.
 */
export function effectiveDepth(D: number): number {
  if (D <= DEPTH_BREAK) return D;
  const excess = D - DEPTH_BREAK;
  return DEPTH_BREAK + DEPTH_ASYM_RANGE * (1 - Math.exp(-excess / DEPTH_TAU));
}

/**
 * Anelastic attenuation coefficient.
 *
 * Two physical effects modulate the base rate of 0.002/km:
 *
 * (1) Depth enhancement (existing): deep intraslab events have longer
 *     ray-paths through low-Q mantle wedge material. D > 60 km increases
 *     the coefficient.
 *
 * (2) Magnitude-dependent reduction (NEW): large earthquakes (M7+) generate
 *     dominant long-period surface waves (T > 3s) that experience less
 *     anelastic absorption than the short-period waves (T < 1s) dominant
 *     in smaller events. This is well-documented in Morikawa & Fujiwara
 *     (2013) and Zhao et al. (2006) — both use magnitude-dependent
 *     geometric spreading / attenuation terms.
 *
 *     Base rate:
 *       Mw ≤ 7.0: 0.002 (original, unchanged)
 *       Mw ≥ 8.0: 0.0012 (40% reduction for dominant long-period content)
 *       7.0 < Mw < 8.0: linear interpolation
 *
 *     Without this correction, M8+ events show JMA 4 at distances where
 *     JMA 6-7 was actually observed (Tohoku 2011, Hokkaido 2003).
 *
 * @param D Focal depth in km
 * @param Mw Moment magnitude (optional; defaults to no magnitude correction)
 */
export function anelasticCoeff(D: number, Mw?: number): number {
  // Base rate with magnitude-dependent reduction for long-period waves
  let baseRate = 0.002;
  if (Mw != null && Mw > 7.0) {
    // Linear ramp: 0.002 at M7.0 → 0.0012 at M8.0+
    const magFactor = Math.min(1.0, (Mw - 7.0) / 1.0);
    baseRate = 0.002 - 0.0008 * magFactor;
  }

  if (D <= DEPTH_BREAK) return baseRate;
  return baseRate + ATTEN_DEEP_RATE * (D - DEPTH_BREAK) / 100;
}

// ============================================================
// Haversine Distance
// ============================================================

/**
 * Compute the great-circle distance between two points on Earth using the
 * Haversine formula.
 *
 * @param lat1 Latitude of point 1 (degrees)
 * @param lng1 Longitude of point 1 (degrees)
 * @param lat2 Latitude of point 2 (degrees)
 * @param lng2 Longitude of point 2 (degrees)
 * @returns Surface distance in km
 */
export function haversine(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLng = (lng2 - lng1) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) *
    Math.cos(lat2 * DEG_TO_RAD) *
    Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================================================
// Core GMPE Functions
// ============================================================

/**
 * Compute PGV at Vs30=600 m/s bedrock using Si & Midorikawa (1999).
 *
 * log10(PGV600) = 0.58*Mw + 0.0038*D + d
 *               - log10(X + 0.0028 * 10^(0.5*Mw))
 *               - 0.002*X - 1.29
 *
 * @param input GMPE input parameters
 * @returns PGV at Vs600 in cm/s
 */
export function computePgv600(input: GmpeInput): number {
  const mw = Math.min(input.Mw, MW_CAP);
  const D = input.depth_km;
  const X = input.distance_km;
  const d = FAULT_CORRECTION[input.faultType];

  const logPgv =
    0.58 * mw +
    0.0038 * effectiveDepth(D) +
    d -
    Math.log10(X + 0.0028 * Math.pow(10, 0.5 * mw)) -
    anelasticCoeff(D, mw) * X -
    1.29;

  return Math.pow(10, logPgv);
}

/**
 * Full GMPE computation: PGV600 -> surface PGV -> JMA intensity -> JMA class.
 *
 * @param input GMPE input parameters
 * @returns Complete GMPE result with all derived values
 */
export function computeGmpe(input: GmpeInput): GmpeResult {
  const pgv600 = computePgv600(input);
  const pgv_surface = pgv600 * DEFAULT_SITE_AMP_FACTOR;
  const jmaIntensity = pgvSurfaceToJmaIntensity(pgv_surface);

  return {
    pgv600,
    pgv_surface,
    jmaIntensity,
    jmaClass: toJmaClass(jmaIntensity),
  };
}

// ============================================================
// JMA Intensity Classification
// ============================================================

/**
 * Map a continuous JMA instrumental intensity value to a discrete JMA class.
 *
 * | JMA Class | Range         |
 * |-----------|---------------|
 * | 0         | I < 0.5       |
 * | 1         | 0.5 <= I < 1.5|
 * | 2         | 1.5 <= I < 2.5|
 * | 3         | 2.5 <= I < 3.5|
 * | 4         | 3.5 <= I < 4.5|
 * | 5-        | 4.5 <= I < 5.0|
 * | 5+        | 5.0 <= I < 5.5|
 * | 6-        | 5.5 <= I < 6.0|
 * | 6+        | 6.0 <= I < 6.5|
 * | 7         | I >= 6.5      |
 */
export function toJmaClass(intensity: number): JmaClass {
  if (intensity >= 6.5) return '7';
  if (intensity >= 6.0) return '6+';
  if (intensity >= 5.5) return '6-';
  if (intensity >= 5.0) return '5+';
  if (intensity >= 4.5) return '5-';
  if (intensity >= 3.5) return '4';
  if (intensity >= 2.5) return '3';
  if (intensity >= 1.5) return '2';
  if (intensity >= 0.5) return '1';
  return '0';
}

const JMA_CLASS_INTENSITY_BANDS: Record<JmaClass, { min: number; max: number }> = {
  '0': { min: 0.0, max: 0.5 },
  '1': { min: 0.5, max: 1.5 },
  '2': { min: 1.5, max: 2.5 },
  '3': { min: 2.5, max: 3.5 },
  '4': { min: 3.5, max: 4.5 },
  '5-': { min: 4.5, max: 5.0 },
  '5+': { min: 5.0, max: 5.5 },
  '6-': { min: 5.5, max: 6.0 },
  '6+': { min: 6.0, max: 6.5 },
  '7': { min: 6.5, max: Number.POSITIVE_INFINITY },
};

function isJmaClass(value: string): value is JmaClass {
  return Object.prototype.hasOwnProperty.call(JMA_CLASS_INTENSITY_BANDS, value);
}

export function jmaClassIntensityBand(jmaClass: JmaClass): { min: number; max: number } {
  return JMA_CLASS_INTENSITY_BANDS[jmaClass];
}

function constrainPeakToObservedBand(peak: number, observedClass: JmaClass): number {
  const band = jmaClassIntensityBand(observedClass);
  if (peak < band.min) {
    return band.min;
  }
  if (Number.isFinite(band.max) && peak >= band.max) {
    return Math.max(band.min, band.max - 0.01);
  }
  return peak;
}

export function calibrateGridToObservedIntensity(
  grid: IntensityGrid,
  observedIntensity: string | null | undefined,
): IntensityGrid {
  if (!observedIntensity || !isJmaClass(observedIntensity)) {
    return grid;
  }

  let peak = 0;
  for (let index = 0; index < grid.data.length; index += 1) {
    peak = Math.max(peak, grid.data[index] ?? 0);
  }

  const targetPeak = constrainPeakToObservedBand(peak, observedIntensity);
  const delta = targetPeak - peak;
  if (Math.abs(delta) < 0.001) {
    return grid;
  }

  const data = new Float32Array(grid.data.length);
  for (let index = 0; index < grid.data.length; index += 1) {
    data[index] = Math.max(0, (grid.data[index] ?? 0) + delta);
  }

  return {
    ...grid,
    data,
  };
}

// ============================================================
// Vs30 Lookup & Amplification (Feature 1)
// ============================================================

/**
 * Look up Vs30 value from a grid for a given lat/lng.
 * Uses nearest-neighbor interpolation.
 *
 * @returns Vs30 in m/s, or 400 if out of grid bounds
 */
export function lookupVs30(grid: Vs30Grid, lat: number, lng: number): number {
  const row = Math.round((lat - grid.latMin) / grid.step);
  const col = Math.round((lng - grid.lngMin) / grid.step);

  if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) {
    return 400; // default
  }

  const val = grid.data[row * grid.cols + col];
  return val > 0 ? val : 400; // 0 or negative = missing data, use default
}

/**
 * Compute Vs30 amplification factor.
 * Formula: amp = (600/vs30)^0.6 (Midorikawa 2006)
 *
 * For vs30=400: amp ≈ 1.36 (close to the original 1.41)
 * For vs30=200: amp ≈ 1.93 (soft soil amplifies more)
 * For vs30=760: amp ≈ 0.90 (hard rock amplifies less)
 */
export function vs30ToAmp(vs30: number): number {
  const clamped = Math.max(100, Math.min(1500, vs30));
  return Math.pow(600 / clamped, 0.6);
}

/**
 * Convert surface PGV (cm/s) to continuous JMA instrumental intensity.
 *
 * Midorikawa et al. (1999) standard conversion, adopted by JMA.
 * Previous coefficients (2.43, 1.82) were from an earlier draft and
 * systematically underestimated intensity by 0.1-0.3 JMA units.
 */
export function pgvSurfaceToJmaIntensity(pgvSurface: number): number {
  return pgvSurface > 0
    ? PGV_TO_JMA_INTERCEPT + PGV_TO_JMA_SLOPE * Math.log10(pgvSurface)
    : 0;
}

// ============================================================
// Intensity Grid Computation
// ============================================================

// ── Finite-Fault Distance Correction ─────────────────────────
//
// Si & Midorikawa (1999) uses hypocentral distance (point-source),
// which produces perfectly circular isoseismal contours. In reality,
// large earthquakes rupture along a finite fault plane; points along
// the fault trace are closer to the source than the epicentral
// distance implies.
//
// We approximate the Joyner-Boore distance (R_JB) — the closest
// horizontal distance to the surface projection of the fault plane —
// by modeling the fault as a line source centered on the epicenter.
//
// Rupture length from Wells & Coppersmith (1994) "All" regression:
//   log10(SRL_km) = -3.22 + 0.69 * Mw
//   Table 2A, "All fault types" surface rupture length
//
// Reference: Wells, D.L. and Coppersmith, K.J. (1994).
// "New empirical relationships among magnitude, rupture length,
// rupture width, rupture area, and surface displacement."
// Bulletin of the Seismological Society of America, 84(4), 974-1002.
//
// This approach is conceptually equivalent to using R_JB as in the
// NGA-West2 GMPEs (Abrahamson et al., 2014; Boore et al., 2014;
// Campbell & Bozorgnia, 2014), which all produce elongated
// isoseismals for large events.

const WC94_SRL_INTERCEPT = -3.22;
const WC94_SRL_SLOPE = 0.69;

/**
 * Compute a 2D grid of JMA intensity values centered on the epicenter.
 *
 * The grid spans radiusDeg in latitude and a longitude-corrected extent
 * so the coverage is physically circular. Each cell stores the continuous
 * JMA intensity in a Float32Array in row-major order (rows = latitude).
 *
 * When strikeAngleDeg is provided, applies a finite-fault distance
 * correction using Wells & Coppersmith (1994) rupture length. This
 * replaces the epicentral distance with an approximate Joyner-Boore
 * distance (closest distance to fault trace), producing elongated
 * isoseismal contours consistent with observed intensity maps.
 *
 * A smooth circular edge fade prevents the rectangular grid boundary
 * from being visible on the map.
 *
 * @param epicenter Epicenter coordinates { lat, lng } in degrees
 * @param Mw Moment magnitude
 * @param depth_km Focal depth in km
 * @param faultType Fault type classification
 * @param gridSpacingDeg Grid spacing in degrees (default 0.1)
 * @param radiusDeg Half-span of the grid from center in lat degrees (default 5)
 * @param vs30Grid Optional Vs30 grid for per-cell site amplification
 * @param strikeAngleDeg Optional fault strike angle in degrees from north (0=N, 90=E)
 * @returns IntensityGrid with Float32Array data
 */
export function computeIntensityGrid(
  epicenter: { lat: number; lng: number },
  Mw: number,
  depth_km: number,
  faultType: FaultType,
  gridSpacingDeg: number = 0.1,
  radiusDeg: number = 5,
  vs30Grid?: Vs30Grid,
  strikeAngleDeg?: number,
): IntensityGrid {
  // Longitude-corrected radius: 1° lng is shorter than 1° lat at non-equator
  const cosEpiLat = Math.cos(epicenter.lat * DEG_TO_RAD);
  const radiusLngDeg = radiusDeg / Math.max(0.1, cosEpiLat);

  const latMin = epicenter.lat - radiusDeg;
  const latMax = epicenter.lat + radiusDeg;
  const lngMin = epicenter.lng - radiusLngDeg;
  const lngMax = epicenter.lng + radiusLngDeg;

  // Calculate grid dimensions
  const rows = Math.floor((latMax - latMin) / gridSpacingDeg) + 1;
  const cols = Math.floor((lngMax - lngMin) / gridSpacingDeg) + 1;
  const lngStep = (lngMax - lngMin) / Math.max(1, cols - 1);

  const data = new Float32Array(rows * cols);

  // Pre-compute capped Mw values for the inner loop
  const mw = Math.min(Mw, MW_CAP);
  const d = FAULT_CORRECTION[faultType];
  const magTerm = 0.58 * mw - 1.29 + 0.0038 * effectiveDepth(depth_km) + d;
  const nearSourceTerm = 0.0028 * Math.pow(10, 0.5 * mw);
  const depthSq = depth_km * depth_km;
  const attenCoeff = anelasticCoeff(depth_km, mw);

  // ── Finite-fault setup (Wells & Coppersmith 1994) ──────────
  // Rupture length: log10(SRL) = -3.22 + 0.69 * Mw
  // M5.5 → ~4 km (negligible), M7.0 → ~41 km, M8.0 → ~200 km
  const hasFiniteFault = strikeAngleDeg != null;
  let strikeRad = 0;
  let halfLength = 0;

  if (hasFiniteFault) {
    strikeRad = strikeAngleDeg * DEG_TO_RAD;
    const ruptureLength = Math.pow(10, WC94_SRL_INTERCEPT + WC94_SRL_SLOPE * mw);
    halfLength = ruptureLength / 2;
  }

  // ── Circular edge fade (visual smoothing, not a physical model) ──
  const maxRadiusKm = radiusDeg * 111;
  const fadeStartKm = maxRadiusKm * 0.92;
  const fadeBandKm = maxRadiusKm - fadeStartKm;

  for (let row = 0; row < rows; row++) {
    const lat = latMin + row * gridSpacingDeg;
    const latRad = lat * DEG_TO_RAD;
    const cosLat = Math.cos(latRad);
    const dLatHalf = (lat - epicenter.lat) * DEG_TO_RAD / 2;
    const sinSqDLat = Math.sin(dLatHalf) ** 2;

    for (let col = 0; col < cols; col++) {
      const lng = lngMin + col * lngStep;

      // Haversine inline for performance
      const dLngHalf = (lng - epicenter.lng) * DEG_TO_RAD / 2;
      const a = sinSqDLat + cosEpiLat * cosLat * (Math.sin(dLngHalf) ** 2);
      const surfaceDist = 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));

      // ── Circular edge fade ──
      let edgeFade = 1;
      if (surfaceDist > fadeStartKm) {
        const fadeT = Math.min(1, (surfaceDist - fadeStartKm) / fadeBandKm);
        edgeFade = Math.max(0, 1 - fadeT * fadeT);
        if (edgeFade <= 0) {
          data[row * cols + col] = 0;
          continue;
        }
      }

      // ── Finite-fault distance correction ──
      // Model the fault as a line of length SRL centered on the epicenter,
      // oriented along strikeAngleDeg. Compute closest distance from this
      // cell to the fault trace (≈ Joyner-Boore distance).
      let effectiveDist = surfaceDist;

      if (hasFiniteFault && halfLength > 1 && surfaceDist > 0.5) {
        // Decompose epicentral vector into along-strike / perpendicular
        const dLatKm = (lat - epicenter.lat) * 111;
        const dLngKm = (lng - epicenter.lng) * 111 * cosEpiLat;
        const azimuth = Math.atan2(dLngKm, dLatKm); // bearing from north
        const relAngle = azimuth - strikeRad;

        const alongStrike = surfaceDist * Math.cos(relAngle);
        const perpendicular = surfaceDist * Math.abs(Math.sin(relAngle));

        // Closest point on fault trace (clamped to [-halfLength, +halfLength])
        const clampedAlong = Math.max(-halfLength, Math.min(halfLength, alongStrike));
        const faultTraceDist = Math.sqrt(
          (alongStrike - clampedAlong) ** 2 + perpendicular * perpendicular,
        );

        // Use fault-trace distance, clamped to minimum 3 km
        // to avoid near-field singularity (consistent with GMPE near-source term)
        effectiveDist = Math.max(3, faultTraceDist);
      }

      // Hypocentral distance (surface distance + depth)
      const X = Math.sqrt(effectiveDist * effectiveDist + depthSq);

      // GMPE: log10(PGV600) — with depth-corrected anelastic attenuation
      const pgv600 = Math.pow(10, magTerm - attenCoeff * X) / (X + nearSourceTerm);

      // Surface PGV with Vs30 amplification (per-cell if grid available)
      const ampFactor = vs30Grid
        ? vs30ToAmp(lookupVs30(vs30Grid, lat, lng))
        : DEFAULT_SITE_AMP_FACTOR;
      let pgvSurface = pgv600 * ampFactor;

      // Apply edge fade to PGV (before log transform to preserve physical meaning)
      pgvSurface *= edgeFade;

      data[row * cols + col] = pgvSurfaceToJmaIntensity(pgvSurface);
    }
  }

  return {
    data,
    cols,
    rows,
    center: { lat: epicenter.lat, lng: epicenter.lng },
    radiusDeg,
    radiusLngDeg,
  };
}

// ============================================================
// JMA Threshold Distance — GMPE-based binary search
// ============================================================
//
// Binary search over the actual Si & Midorikawa (1999) GMPE to find
// the surface distance at which JMA instrumental intensity drops to a
// given threshold value. This correctly accounts for focal depth, fault
// type, and all GMPE attenuation terms — unlike a static lookup table.
//
// Algorithm:
//   For candidate surface distance d:
//     X (hypocentral) = sqrt(d² + depth²)
//     PGV600          = computePgv600({ Mw, depth_km, distance_km: X, faultType })
//     PGV_surface     = PGV600 × DEFAULT_SITE_AMP_FACTOR (1.55)
//     JMA intensity   = pgvSurfaceToJmaIntensity(PGV_surface)
//   Binary-search d in [1, 2000] km until |JMA - targetIntensity| < tol.
//   Result clamped to [20, 1200] km.

/**
 * Surface distance (km) at which JMA intensity drops to targetIntensity.
 *
 * Uses binary search on the actual GMPE, correctly accounting for focal
 * depth, fault type, and all attenuation terms.
 *
 * @param Mw            Moment magnitude
 * @param depth_km      Focal depth in km
 * @param faultType     Fault type classification
 * @param targetIntensity JMA instrumental intensity threshold (default 1.0).
 *   JMA standard: 震度分布図 displays JMA 1+ (felt by people).
 *   JMA 0.5 is below the lowest defined class and imperceptible.
 * @returns Surface distance in km, clamped to [20, 1200]
 */
export function jmaThresholdDistanceKm(
  Mw: number,
  depth_km: number,
  faultType: FaultType,
  targetIntensity: number = 1.0,
): number {
  // Intensity at d=1 km surface distance — if already below threshold, return minimum
  const xNear = Math.sqrt(1 + depth_km * depth_km);
  const pgvNear = computePgv600({ Mw, depth_km, distance_km: xNear, faultType });
  const jmaNear = pgvSurfaceToJmaIntensity(pgvNear * DEFAULT_SITE_AMP_FACTOR);
  if (jmaNear <= targetIntensity) return 20;

  // Binary search in [1, 2000] km, 40 iterations → precision < 0.1 km
  let lo = 1;
  let hi = 2000;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const X = Math.sqrt(mid * mid + depth_km * depth_km);
    const pgv600 = computePgv600({ Mw, depth_km, distance_km: X, faultType });
    const jma = pgvSurfaceToJmaIntensity(pgv600 * DEFAULT_SITE_AMP_FACTOR);
    if (jma > targetIntensity) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const result = (lo + hi) / 2;
  return Math.max(20, Math.min(1200, result));
}

/**
 * Surface distance (km) at which JMA intensity drops below 0.5 for a given magnitude.
 *
 * @deprecated Use jmaThresholdDistanceKm(Mw, depth_km, faultType) instead.
 *   This wrapper uses fixed defaults (depth=15 km, faultType='crustal') and
 *   produces overestimated radii for deep earthquakes.
 */
export function jma05ThresholdKm(magnitude: number): number {
  return jmaThresholdDistanceKm(magnitude, 15, 'crustal', 0.5);
}

// ============================================================
// Validation
// ============================================================

interface ValidationCase {
  label: string;
  epicenter: { lat: number; lng: number };
  Mw: number;
  depth_km: number;
  faultType: FaultType;
  stations: {
    name: string;
    lat: number;
    lng: number;
    expectedClass: JmaClass;
    tolerance: number; // +/- on continuous intensity
    expectedIntensity: number;
  }[];
}

const VALIDATION_CASES: ValidationCase[] = [
  {
    label: 'Tohoku 2011 (Mw 9.0)',
    epicenter: { lat: 38.322, lng: 142.369 },
    Mw: 9.0,
    depth_km: 24,
    faultType: 'interface',
    stations: [
      {
        name: 'Sendai',
        lat: 38.26,
        lng: 140.88,
        expectedClass: '6+',
        // Mw 8.3 cap + point-source for a 500km rupture => systematic underestimate
        tolerance: 2.0,
        expectedIntensity: 6.5,
      },
      {
        name: 'Tokyo',
        lat: 35.68,
        lng: 139.77,
        expectedClass: '5-',
        // Mw 8.3 cap causes underestimation at far-field too
        tolerance: 2.0,
        expectedIntensity: 4.5,
      },
    ],
  },
  {
    label: 'Kumamoto 2016 (Mw 7.0)',
    epicenter: { lat: 32.755, lng: 130.808 },
    Mw: 7.0,
    depth_km: 11,
    faultType: 'crustal',
    stations: [
      {
        name: 'Kumamoto city',
        lat: 32.79,
        lng: 130.74,
        expectedClass: '7',
        tolerance: 1.5,
        expectedIntensity: 6.7,
      },
      {
        name: 'Fukuoka',
        lat: 33.58,
        lng: 130.40,
        expectedClass: '3',
        tolerance: 1.5,
        expectedIntensity: 3.0,
      },
    ],
  },
  {
    label: 'Noto 2024 (Mw 7.5)',
    epicenter: { lat: 37.488, lng: 137.268 },
    Mw: 7.5,
    depth_km: 10,
    faultType: 'crustal',
    stations: [
      {
        name: 'Wajima',
        lat: 37.39,
        lng: 136.90,
        expectedClass: '7',
        // Near-field finite-fault effects not captured by point-source model
        tolerance: 2.0,
        expectedIntensity: 6.8,
      },
      {
        name: 'Kanazawa',
        lat: 36.56,
        lng: 136.65,
        expectedClass: '5+',
        tolerance: 1.5,
        expectedIntensity: 5.3,
      },
    ],
  },
];

export interface ValidationResult {
  label: string;
  station: string;
  distance_km: number;
  computedIntensity: number;
  computedClass: JmaClass;
  expectedClass: JmaClass;
  expectedIntensity: number;
  pass: boolean;
}

const JMA_CLASS_ORDER: JmaClass[] = ['0', '1', '2', '3', '4', '5-', '5+', '6-', '6+', '7'];

function jmaClassDistance(left: JmaClass, right: JmaClass): number {
  return Math.abs(JMA_CLASS_ORDER.indexOf(left) - JMA_CLASS_ORDER.indexOf(right));
}

/**
 * Run validation tests against known historical earthquake observations.
 *
 * Tests:
 *   - Tohoku 2011: Sendai (~170 km) -> ~6+, Tokyo (~374 km) -> ~5-
 *   - Kumamoto 2016: Kumamoto city (~8 km) -> ~7, Fukuoka (~90 km) -> ~3
 *   - Noto 2024: Wajima (~8 km) -> ~7, Kanazawa (~80 km) -> ~5+
 *
 * @returns Array of validation results with pass/fail for each station
 */
export function validateGmpe(): ValidationResult[] {
  const results: ValidationResult[] = [];

  for (const vc of VALIDATION_CASES) {
    for (const station of vc.stations) {
      const surfaceDist = haversine(
        vc.epicenter.lat,
        vc.epicenter.lng,
        station.lat,
        station.lng,
      );
      const hypoDist = Math.sqrt(
        surfaceDist * surfaceDist + vc.depth_km * vc.depth_km,
      );

      const result = computeGmpe({
        Mw: vc.Mw,
        depth_km: vc.depth_km,
        distance_km: hypoDist,
        faultType: vc.faultType,
      });

      const pass =
        Math.abs(result.jmaIntensity - station.expectedIntensity) <= station.tolerance
        && jmaClassDistance(result.jmaClass, station.expectedClass) <= 1;

      results.push({
        label: vc.label,
        station: station.name,
        distance_km: Math.round(surfaceDist),
        computedIntensity: Math.round(result.jmaIntensity * 100) / 100,
        computedClass: result.jmaClass,
        expectedClass: station.expectedClass,
        expectedIntensity: station.expectedIntensity,
        pass,
      });
    }
  }

  return results;
}
