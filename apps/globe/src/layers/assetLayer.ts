/**
 * Asset Layer — Hierarchical infrastructure icon markers.
 *
 * Professional progressive disclosure:
 *   national (z0-8):  Icons only, no labels. ~50 critical assets.
 *   regional (z8-11): Icons + labels for national-tier assets only.
 *   city (z11-14):    Icons + labels for national+regional-tier assets.
 *   district (z14+):  Everything visible with full labels.
 *
 * Visual hierarchy:
 *   - Icon size scales by tier importance (national-tier = larger)
 *   - Alpha fades in for newly-visible assets at tier boundary
 *   - Alert assets (severity !== 'clear') get labels 1 tier earlier
 *   - Highlight glow ring for panel-hovered asset
 *
 * Shape = asset class (anchor, cross, zap, atom, etc.)
 * Color = icon has own category color (mask: false), severity via ring layer
 */

import { IconLayer, TextLayer, ScatterplotLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import { OPS_ASSETS } from '../ops/assetCatalog';
import type { OpsAsset, OpsAssetExposure, OpsSeverity, ZoomTier } from '../ops/types';
import type { AssetCategoryVisibility } from '../ops/assetCategoryVisibility';
import { buildAssetCategoryVisibility, isAssetCategoryVisible } from '../ops/assetCategoryVisibility';
import { ICON_ATLAS_URL, ICON_MAPPING, ASSET_ICON_SIZE } from './iconAtlas';

type RGBA = [number, number, number, number];

const SEVERITY_COLORS: Record<OpsSeverity, RGBA> = {
  clear: [110, 231, 183, 160],    // calm green
  watch: [96, 165, 250, 200],     // cool blue
  priority: [251, 191, 36, 220],  // amber
  critical: [239, 68, 68, 240],   // red
};

const ZOOM_TIER_ORDER: ZoomTier[] = ['national', 'regional', 'city', 'district'];

function tierIndex(tier: ZoomTier): number {
  return ZOOM_TIER_ORDER.indexOf(tier);
}

// Size multiplier by how "important" an asset is relative to current zoom.
// Assets at their home tier are standard size; assets from higher tiers are bigger.
const TIER_SIZE_SCALE: Record<number, number> = {
  0: 1.0,   // asset at same tier as current zoom
  1: 1.15,  // asset 1 tier above current zoom (more important)
  2: 1.3,   // asset 2 tiers above
  3: 1.4,   // asset 3 tiers above (national asset at district zoom)
};

interface AssetDatum extends OpsAsset {
  severity: OpsSeverity;
  _tierIdx: number;
}

export function createAssetLayers(
  currentTier: ZoomTier,
  exposures: OpsAssetExposure[],
  highlightedAssetId: string | null = null,
  _zoom?: number,
  categoryVisibility: AssetCategoryVisibility = buildAssetCategoryVisibility(),
): Layer[] {
  const exposureMap = new Map(exposures.map((e) => [e.assetId, e]));
  const currentIdx = tierIndex(currentTier);

  const visible: AssetDatum[] = OPS_ASSETS
    .filter((a) => tierIndex(a.minZoomTier) <= currentIdx && isAssetCategoryVisible(categoryVisibility, a.class))
    .map((a) => ({
      ...a,
      severity: exposureMap.get(a.id)?.severity ?? 'clear',
      _tierIdx: tierIndex(a.minZoomTier),
    }));

  if (visible.length === 0) return [];

  const layers: Layer[] = [];

  // ── Shared zoom scale ──────────────────────────────────────
  const zoom = _zoom ?? 5;
  const zoomScale = zoom < 4 ? 0.4 : zoom < 5 ? 0.5 : zoom < 6 ? 0.6 : zoom < 7 ? 0.75 : zoom < 9 ? 0.9 : 1.0;

  // ── 1. Highlight glow ring ──────────────────────────────────
  if (highlightedAssetId) {
    const highlighted = visible.find((d) => d.id === highlightedAssetId);
    if (highlighted) {
      layers.push(new ScatterplotLayer({
        id: 'asset-highlight-glow',
        data: [highlighted],
        pickable: false,
        radiusUnits: 'pixels',
        getPosition: (d: AssetDatum) => [d.lng, d.lat],
        getRadius: 28,
        stroked: true,
        filled: true,
        getFillColor: [125, 211, 252, 40],
        getLineColor: [125, 211, 252, 120],
        getLineWidth: 2,
        updateTriggers: {
          getPosition: [highlightedAssetId],
        },
      }));
    }
  }

  // ── 2. Severity rings — visual indicator for non-clear assets ──
  // Icons have their own category colors (mask: false), so severity
  // is shown via colored rings behind the icon.
  const severityData = visible.filter(d => d.severity !== 'clear');
  if (severityData.length > 0) {
    layers.push(new ScatterplotLayer<AssetDatum>({
      id: 'asset-severity-rings',
      data: severityData,
      pickable: false,
      stroked: true,
      filled: true,
      radiusUnits: 'pixels',
      lineWidthUnits: 'pixels',
      getPosition: (d) => [d.lng, d.lat],
      getRadius: (d) => {
        const baseSize = ASSET_ICON_SIZE[d.class];
        const importance = currentIdx - d._tierIdx;
        const scale = TIER_SIZE_SCALE[importance] ?? 1.0;
        return (baseSize * scale * zoomScale) / 2 + 3;
      },
      getFillColor: (d): RGBA => {
        const base = SEVERITY_COLORS[d.severity];
        return [base[0], base[1], base[2], 35];
      },
      getLineColor: (d): RGBA => SEVERITY_COLORS[d.severity],
      getLineWidth: 1.5,
      updateTriggers: {
        getRadius: [currentTier, exposures],
        getFillColor: [exposures],
        getLineColor: [exposures],
      },
    }));
  }

  // ── 3. Icon markers ─────────────────────────────────────────
  // Icons display their own category colors (mask: false).
  // Size scales with zoom: small at national, grows at regional+.
  // sizeMaxPixels caps size to prevent icons from becoming huge.

  layers.push(new IconLayer<AssetDatum>({
    id: 'asset-markers',
    data: visible,
    pickable: true,
    autoHighlight: true,
    highlightColor: [125, 211, 252, 160],
    iconAtlas: ICON_ATLAS_URL,
    iconMapping: ICON_MAPPING,
    getIcon: (d) => d.class,
    getPosition: (d) => [d.lng, d.lat],
    getSize: (d) => {
      const baseSize = ASSET_ICON_SIZE[d.class];
      const importance = currentIdx - d._tierIdx;
      const tierScale = TIER_SIZE_SCALE[importance] ?? 1.0;
      return baseSize * tierScale * zoomScale;
    },
    sizeUnits: 'pixels',
    sizeMinPixels: 6,
    sizeMaxPixels: 30,
    getColor: [255, 255, 255, 255] as RGBA,
    updateTriggers: {
      getSize: [currentTier, zoom],
    },
  }));

  // ── 4. Labels — hierarchical disclosure ─────────────────────
  // Labels appear 1 tier AFTER the icon becomes visible.
  // Exception: assets with active severity (watch/priority/critical)
  // get labels at the same tier their icon appears.
  const labelData = visible.filter((d) => {
    const assetIdx = d._tierIdx;
    const hasAlert = d.severity !== 'clear';

    // Alert assets: show label at same tier as icon
    if (hasAlert) return true;

    // Normal assets: label appears 1 tier after icon
    // national-tier icon → label at regional zoom (currentIdx >= 1)
    // regional-tier icon → label at city zoom (currentIdx >= 2)
    // city-tier icon → label at district zoom (currentIdx >= 3)
    return currentIdx >= assetIdx + 1;
  });

  if (labelData.length > 0) {
    // At lower zooms, use smaller font; at higher zooms, larger
    const fontSize = currentIdx <= 1 ? 10 : currentIdx === 2 ? 11 : 12;

    layers.push(new TextLayer<AssetDatum>({
      id: 'asset-labels',
      data: labelData,
      pickable: false,
      getPosition: (d) => [d.lng, d.lat],
      getText: (d) => d.name,
      getSize: (d) => {
        // Alert labels slightly larger
        if (d.severity === 'critical') return fontSize + 2;
        if (d.severity === 'priority') return fontSize + 1;
        return fontSize;
      },
      getColor: (d): RGBA => {
        // Alert labels use severity color; normal labels use neutral
        if (d.severity === 'critical') return [239, 68, 68, 220];
        if (d.severity === 'priority') return [251, 191, 36, 200];
        if (d.severity === 'watch') return [96, 165, 250, 180];
        // Normal: brighter for higher-tier assets
        const alpha = d._tierIdx === 0 ? 200 : d._tierIdx === 1 ? 160 : 130;
        return [226, 232, 240, alpha];
      },
      getTextAnchor: 'start',
      getAlignmentBaseline: 'center',
      getPixelOffset: [14, 0],
      fontFamily: 'Noto Sans JP, system-ui, sans-serif',
      fontWeight: 500,
      outlineWidth: 2.5,
      outlineColor: [10, 14, 20, 220],
      updateTriggers: {
        getText: [currentTier],
        getSize: [exposures, currentTier],
        getColor: [exposures, currentTier],
      },
    }));
  }

  return layers;
}
