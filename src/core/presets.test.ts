import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPresetToLayer, detectActivePreset, PRESET_LIST, PRESETS_BY_ID } from './presets';
import type { Layer } from '../types/editor';

function baseLayer(): Layer {
  return {
    id: 'l1',
    name: '枠 #1',
    shapeType: 'rect',
    blurType: 'gaussian',
    strength: 9,
    opacity: 0.92,
    feather: 16,
    borderRadius: 18,
    badge: '',
    visible: true,
    rect: { x: 0, y: 0, w: 120, h: 60 },
    strokes: [],
    erasers: [],
  };
}

test('redact preset uses opaque solid-black redaction so secrets cannot be reconstructed', () => {
  const redact = PRESETS_BY_ID.redact;
  assert.equal(redact.blurType, 'solid-black');
  assert.equal(redact.opacity, 1);
  assert.equal(redact.feather, 0);
});

test('applyPresetToLayer and detectActivePreset round-trip consistently for all presets', () => {
  for (const preset of PRESET_LIST) {
    const updated = applyPresetToLayer(baseLayer(), preset.id);
    assert.equal(detectActivePreset(updated), preset.id);
  }

  const custom = { ...baseLayer(), strength: 47 };
  assert.equal(detectActivePreset(custom), null);
});
