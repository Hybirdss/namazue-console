import type { MaritimeExposure } from '../layers/aisLayer';
import type { MaritimeOverview } from '../ops/maritimeTelemetry';
import { OPS_ASSETS } from '../ops/assetCatalog';
import { getOpsAssetClassDefinition } from '../ops/assetClassRegistry';
import type { OpsAssetExposure, OpsSeverity } from '../ops/types';
import type { DamageProbs } from '../ops/fragilityCurves';
import { severityRank } from '../ops/severityUtils';

interface InfrastructureEntry {
  assetId: string;
  assetName: string;
  family: string;
  icon: string;
  severity: OpsSeverity;
  summary: string;
  damageProbs?: DamageProbs;
}

export interface SectorStressGroup {
  id: string;
  label: string;
  icon: string;
  critical: number;
  priority: number;
  watch: number;
  total: number;
  topAsset: InfrastructureEntry | null;
}

export interface SectorStressInfrastructure {
  affectedCount: number;
  groups: SectorStressGroup[];
}

export interface SectorStressMaritime {
  totalTracked: number;
  inImpactZone: number;
  highPriorityInZone: number;
  summary: string;
}

export interface SectorStressModel {
  infrastructure: SectorStressInfrastructure;
  maritime: SectorStressMaritime;
}

export function buildSectorStressModel(input: {
  exposures: OpsAssetExposure[];
  maritimeExposure: MaritimeExposure;
  maritimeOverview: MaritimeOverview;
}): SectorStressModel {
  const assetById = new Map(OPS_ASSETS.map((asset) => [asset.id, asset]));
  const affectedEntries: InfrastructureEntry[] = input.exposures
    .filter((entry) => entry.severity !== 'clear')
    .map((entry): InfrastructureEntry | null => {
      const asset = assetById.get(entry.assetId);
      if (!asset) {
        return null;
      }
      const classDef = getOpsAssetClassDefinition(asset.class);
      const result: InfrastructureEntry = {
        assetId: entry.assetId,
        assetName: asset.name,
        family: classDef.familyLabel,
        icon: classDef.icon,
        severity: entry.severity,
        summary: entry.summary,
      };
      if (entry.damageProbs !== undefined) {
        result.damageProbs = entry.damageProbs;
      }
      return result;
    })
    .filter((entry): entry is InfrastructureEntry => entry != null);

  const grouped = new Map<string, InfrastructureEntry[]>();
  for (const entry of affectedEntries) {
    if (!grouped.has(entry.family)) {
      grouped.set(entry.family, []);
    }
    grouped.get(entry.family)!.push(entry);
  }

  const groups: SectorStressGroup[] = [...grouped.entries()]
    .map(([family, entries]) => {
      let critical = 0;
      let priority = 0;
      let watch = 0;
      for (const entry of entries) {
        if (entry.severity === 'critical') critical += 1;
        if (entry.severity === 'priority') priority += 1;
        if (entry.severity === 'watch') watch += 1;
      }

      const sorted = [...entries].sort((left, right) => {
        const rankGap = severityRank(right.severity) - severityRank(left.severity);
        if (rankGap !== 0) return rankGap;
        return left.assetName.localeCompare(right.assetName);
      });

      return {
        id: family.toLowerCase().replace(/\s+/g, '-'),
        label: family,
        icon: entries[0]?.icon ?? '\u2022',
        critical,
        priority,
        watch,
        total: entries.length,
        topAsset: sorted[0] ?? null,
      };
    })
    .sort((left, right) => {
      const severityGap = (right.critical * 10 + right.priority * 5 + right.watch)
        - (left.critical * 10 + left.priority * 5 + left.watch);
      if (severityGap !== 0) return severityGap;
      return left.label.localeCompare(right.label);
    });

  const highPriorityInZone = input.maritimeExposure.passengerCount + input.maritimeExposure.tankerCount;
  const maritimeSummary = input.maritimeExposure.totalInZone > 0
    ? input.maritimeExposure.summary
    : input.maritimeOverview.summary;

  return {
    infrastructure: {
      affectedCount: affectedEntries.length,
      groups,
    },
    maritime: {
      totalTracked: input.maritimeOverview.totalTracked,
      inImpactZone: input.maritimeExposure.totalInZone,
      highPriorityInZone,
      summary: maritimeSummary,
    },
  };
}
