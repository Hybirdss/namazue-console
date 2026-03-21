import test from 'node:test';
import assert from 'node:assert/strict';
import type { BuilderInput } from '@namazue/db';
import { buildContext } from '../src/context/builder.ts';

function createInput(overrides?: Partial<BuilderInput>): BuilderInput {
  return {
    event: {
      id: 'evt-1',
      lat: 35.7,
      lng: 139.7,
      depth_km: 22,
      magnitude: 7.2,
      time: new Date('2026-03-08T00:00:00.000Z'),
      fault_type: 'interface',
      place: 'Tokyo Bay region',
      place_ja: '東京湾周辺',
      mag_type: 'mw',
      tsunami: false,
    },
    tier: 'S',
    ...overrides,
  };
}

test('buildContext resolves nearest volcano for Japan events', () => {
  const context = buildContext(createInput());

  assert.ok(context.tectonic.nearest_volcano);
  assert.equal(typeof context.tectonic.nearest_volcano?.name, 'string');
  assert.ok((context.tectonic.nearest_volcano?.distance_km ?? 0) > 0);
});

test('buildContext omits nearest volcano for non-Japan events', () => {
  const context = buildContext(createInput({
    event: {
      ...createInput().event,
      lat: -15.2,
      lng: -72.3,
      place: 'Peru',
      place_ja: '페루',
    },
  }));

  assert.equal(context.tectonic.nearest_volcano, null);
});

test('buildContext populates global analogs for S tier and hides for B tier', () => {
  const sTier = buildContext(createInput());
  assert.ok(sTier.global_analogs);
  assert.equal(sTier.global_analogs?.length, 3);
  assert.ok(sTier.global_analogs?.every((analog) => analog.name.length > 0));

  const bTier = buildContext(createInput({ tier: 'B' }));
  assert.equal(bTier.global_analogs, null);
});
