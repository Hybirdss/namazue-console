/**
 * Shared types for domain intelligence handlers.
 */

import type { OpsAsset, NearestAlternative } from '../types';
import type { TsunamiAssessment } from '../../types';

/** Broader ops context passed to every domain handler. */
export interface DomainContext {
  /** Pre-built nearest-alternative lookup — O(1) amortized per query. */
  findNearest: (target: OpsAsset) => NearestAlternative | null;
  tsunamiAssessment: TsunamiAssessment | null;
}
