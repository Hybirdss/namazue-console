/**
 * Shared helper functions for domain intelligence handlers.
 */

import type { DomainAction, ActionUrgency } from '../types';
import { t } from '../../i18n';

/** Build a DomainAction with the given urgency and i18n action key. */
export function action(urgency: ActionUrgency, key: string): DomainAction {
  return { urgency, action: key };
}

/**
 * Return the first action from the list (highest urgency that triggered),
 * or a fallback key if no actions were collected.
 */
export function topActionLabel(actions: DomainAction[], fallbackKey: string): string {
  return actions.length > 0 ? t(actions[0].action) : t(fallbackKey);
}
