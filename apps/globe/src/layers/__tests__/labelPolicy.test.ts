import { describe, expect, it } from 'vitest';

import { pickVisibleLabels } from '../labelPolicy';

describe('pickVisibleLabels', () => {
  it('caps labels to the in-view highest-priority candidates', () => {
    const picked = pickVisibleLabels(
      [
        { id: 'offscreen', lat: 40, lng: 145, inZone: true, priority: 100 },
        { id: 'selected', lat: 35.6, lng: 139.7, selected: true, priority: 10 },
        { id: 'in-zone', lat: 35.7, lng: 139.8, inZone: true, priority: 30 },
        { id: 'neutral-1', lat: 35.8, lng: 139.9, priority: 20 },
        { id: 'neutral-2', lat: 35.9, lng: 139.6, priority: 15 },
      ],
      {
        bounds: [139.4, 35.4, 140.1, 36.0],
        cap: 2,
        focus: { lat: 35.68, lng: 139.76 },
        getPriority: (candidate) => candidate.priority,
      },
    );

    expect(picked.map((candidate) => candidate.id)).toEqual(['selected', 'in-zone']);
  });
});
