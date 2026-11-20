import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canRedo,
  canUndo,
  createInitialHistory,
  pushHistoryState,
  stepRedo,
  stepUndo,
} from './history';
import type { Layer } from '../types/editor';

function makeLayer(id: string, strength: number): Layer {
  return {
    id,
    name: id,
    shapeType: 'rect',
    blurType: 'gaussian',
    strength,
    opacity: 0.92,
    feather: 16,
    borderRadius: 18,
    badge: '',
    visible: true,
    rect: { x: 0, y: 0, w: 100, h: 50 },
    strokes: [{ size: 20, points: [{ x: 1, y: 2 }] }],
    erasers: [],
  };
}

test('history push, undo, redo, and branch truncation work with deep isolation', () => {
  let h = createInitialHistory();
  assert.equal(canUndo(h), false);
  assert.equal(canRedo(h), false);

  const l1 = [makeLayer('l1', 10)];
  h = pushHistoryState(h, l1, 'l1');
  // Mutating original object must not mutate stored history
  l1[0].strength = 999;

  h = pushHistoryState(h, [makeLayer('l1', 20)], 'l1');
  assert.equal(canUndo(h), true);
  assert.equal(canRedo(h), false);

  const undoRes = stepUndo(h);
  assert.ok(undoRes);
  assert.equal(undoRes.snapshot.layers[0].strength, 10);
  h = undoRes.history;
  assert.equal(canUndo(h), false);
  assert.equal(canRedo(h), true);

  // Pushing new branch truncates redo entries
  h = pushHistoryState(h, [makeLayer('l1', 35)], 'l1');
  assert.equal(canRedo(h), false);
  assert.equal(h.entries.length, 2);

  const undoRes2 = stepUndo(h);
  assert.ok(undoRes2);
  const redoRes = stepRedo(undoRes2.history);
  assert.ok(redoRes);
  assert.equal(redoRes.snapshot.layers[0].strength, 35);
});

test('history enforces max entry limit', () => {
  let h = createInitialHistory();
  for (let i = 0; i < 10; i++) {
    h = pushHistoryState(h, [makeLayer('l1', i)], 'l1', 5);
  }
  assert.equal(h.entries.length, 5);
  assert.equal(h.index, 4);
  assert.equal(h.entries[0].layers[0].strength, 5);
  assert.equal(h.entries[4].layers[0].strength, 9);
});
