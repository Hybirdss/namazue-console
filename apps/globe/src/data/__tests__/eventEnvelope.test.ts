import { describe, expect, it } from 'vitest';

import type { EarthquakeEvent } from '../../types';
import {
  analyzeEventRevisionHistory,
  buildCanonicalEventEnvelope,
  mergeCanonicalEventHistory,
  mergeCanonicalEventRevisionHistory,
  pickPreferredEventEnvelope,
  resolvePreferredEventEnvelope,
} from '../eventEnvelope';

const baseEvent: EarthquakeEvent = {
  id: 'eq-1',
  lat: 35.7,
  lng: 139.7,
  depth_km: 24,
  magnitude: 6.8,
  time: 1_700_000_000_000,
  faultType: 'interface',
  tsunami: true,
  place: { text: 'Sagami corridor' },
};

describe('eventEnvelope', () => {
  it('builds a canonical envelope with deterministic metadata defaults', () => {
    const envelope = buildCanonicalEventEnvelope({
      event: baseEvent,
      source: 'server',
      issuedAt: 1_700_000_005_000,
      receivedAt: 1_700_000_006_000,
    });

    expect(envelope.id).toBe('eq-1');
    expect(envelope.revision).toBe('server:1700000005000:eq-1');
    expect(envelope.observedAt).toBe(baseEvent.time);
    expect(envelope.confidence).toBe('high');
    expect(envelope.supersedes).toBeNull();
  });

  it('prefers newer issued revisions, then higher-trust sources when timestamps tie', () => {
    const older = buildCanonicalEventEnvelope({
      event: baseEvent,
      source: 'usgs',
      issuedAt: 1_700_000_001_000,
      receivedAt: 1_700_000_001_500,
    });
    const newer = buildCanonicalEventEnvelope({
      event: { ...baseEvent, magnitude: 7.0 },
      source: 'server',
      issuedAt: 1_700_000_002_000,
      receivedAt: 1_700_000_002_500,
    });
    const tiedServer = buildCanonicalEventEnvelope({
      event: baseEvent,
      source: 'server',
      issuedAt: 1_700_000_003_000,
      receivedAt: 1_700_000_003_500,
    });
    const tiedUsgs = buildCanonicalEventEnvelope({
      event: { ...baseEvent, magnitude: 6.6 },
      source: 'usgs',
      issuedAt: 1_700_000_003_000,
      receivedAt: 1_700_000_003_200,
    });

    expect(pickPreferredEventEnvelope(older, newer)).toBe(newer);
    expect(pickPreferredEventEnvelope(tiedUsgs, tiedServer)).toBe(tiedServer);

    const decision = resolvePreferredEventEnvelope(tiedUsgs, tiedServer);
    expect(decision.reason).toBe('higher-source-priority');
    expect(decision.replaced).toBe(true);
  });

  it('keeps bounded revision history sorted by issued and received timestamps', () => {
    const history = mergeCanonicalEventHistory(
      [
        buildCanonicalEventEnvelope({ event: baseEvent, source: 'server', issuedAt: 1_000, receivedAt: 1_100 }),
        buildCanonicalEventEnvelope({ event: baseEvent, source: 'usgs', issuedAt: 2_000, receivedAt: 2_100 }),
      ],
      buildCanonicalEventEnvelope({ event: baseEvent, source: 'jma', issuedAt: 3_000, receivedAt: 3_100 }),
      2,
    );

    expect(history).toHaveLength(2);
    expect(history.map((entry) => entry.source)).toEqual(['usgs', 'jma']);
  });

  it('classifies material divergence when revisions disagree on magnitude, location, or tsunami posture', () => {
    const usgs = buildCanonicalEventEnvelope({
      event: baseEvent,
      source: 'usgs',
      issuedAt: 1_700_000_001_000,
      receivedAt: 1_700_000_001_500,
    });
    const server = buildCanonicalEventEnvelope({
      event: {
        ...baseEvent,
        lat: 35.2,
        lng: 139.2,
        magnitude: 7.4,
        tsunami: false,
      },
      source: 'server',
      issuedAt: 1_700_000_002_000,
      receivedAt: 1_700_000_002_500,
    });

    const analysis = analyzeEventRevisionHistory([usgs, server]);

    expect(analysis.divergenceSeverity).toBe('material');
    expect(analysis.magnitudeSpread).toBeCloseTo(0.6, 3);
    expect(analysis.locationSpreadKm).toBeGreaterThan(20);
    expect(analysis.tsunamiMismatch).toBe(true);
  });

  it('classifies no divergence when source revisions are metadata-only duplicates', () => {
    const first = buildCanonicalEventEnvelope({
      event: baseEvent,
      source: 'server',
      issuedAt: 1_700_000_001_000,
      receivedAt: 1_700_000_001_500,
    });
    const duplicate = buildCanonicalEventEnvelope({
      event: baseEvent,
      source: 'usgs',
      issuedAt: 1_700_000_001_000,
      receivedAt: 1_700_000_001_600,
    });

    const analysis = analyzeEventRevisionHistory([first, duplicate]);
    expect(analysis.divergenceSeverity).toBe('none');
    expect(analysis.locationSpreadKm).toBe(0);
  });

  it('merges revision history deterministically and replaces duplicate revisions by latest receipt', () => {
    const first = buildCanonicalEventEnvelope({
      event: baseEvent,
      source: 'server',
      issuedAt: 1_700_000_001_000,
      receivedAt: 1_700_000_001_100,
    });
    const duplicateLater = {
      ...first,
      receivedAt: 1_700_000_001_900,
    };

    const merged = mergeCanonicalEventRevisionHistory([first], duplicateLater);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.receivedAt).toBe(1_700_000_001_900);
  });
});
