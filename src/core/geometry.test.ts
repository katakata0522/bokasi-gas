import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clientToImagePoint,
  computeFitTransform,
  computeFloatingToolbarPos,
  computeResizedRect,
  fitBadgeDimensions,
  getVisibleHandleKeys,
  hitTestRectHandles,
  isPointInEllipse,
  isPointInRect,
  isPointInShape,
  reorderLayer,
  shouldAppendStrokePoint,
  zoomAroundPoint,
} from './geometry';
import type { Layer } from '../types/editor';

function makeDummyLayer(id: string): Layer {
  return {
    id,
    name: id,
    shapeType: 'rect',
    blurType: 'gaussian',
    strength: 9,
    opacity: 0.92,
    feather: 16,
    borderRadius: 18,
    badge: '',
    visible: true,
    rect: { x: 10, y: 10, w: 100, h: 60 },
    strokes: [],
    erasers: [],
  };
}

test('computeFitTransform centers image inside viewport with padding', () => {
  const view = computeFitTransform(1000, 800, 1000, 500, 40);
  assert.ok(view.scale > 0 && view.scale <= 1.5);
  const renderedW = 1000 * view.scale;
  const renderedH = 500 * view.scale;
  assert.ok(Math.abs(view.offsetX - (1000 - renderedW) / 2) < 0.01);
  assert.ok(Math.abs(view.offsetY - (800 - renderedH) / 2) < 0.01);
});

test('zoomAroundPoint keeps the focal point fixed in image coordinates', () => {
  const initial = { scale: 1, offsetX: 100, offsetY: 50 };
  const focalX = 320;
  const focalY = 240;
  const beforeImg = clientToImagePoint(focalX, focalY, 0, 0, initial);
  const zoomed = zoomAroundPoint(initial, focalX, focalY, 1.5);
  const afterImg = clientToImagePoint(focalX, focalY, 0, 0, zoomed);

  assert.ok(Math.abs(beforeImg.x - afterImg.x) < 1e-6);
  assert.ok(Math.abs(beforeImg.y - afterImg.y) < 1e-6);
});

test('hitTestRectHandles detects corners and adaptive edge handles', () => {
  const rect = { x: 100, y: 100, w: 200, h: 100 };
  assert.equal(hitTestRectHandles(rect, 100, 100, 1), 'nw');
  assert.equal(hitTestRectHandles(rect, 300, 200, 1), 'se');
  assert.equal(hitTestRectHandles(rect, 200, 100, 1), 'n');
  assert.equal(hitTestRectHandles(rect, 200, 150, 1), null);
  assert.equal(isPointInRect(200, 150, rect), true);
  assert.equal(isPointInRect(50, 50, rect), false);

  // Small box hides edge midpoint handles to prevent handle crowding
  const tinyKeys = getVisibleHandleKeys({ x: 0, y: 0, w: 40, h: 30 }, 1);
  assert.deepEqual(tinyKeys, ['nw', 'ne', 'se', 'sw']);
});

test('isPointInEllipse and isPointInShape distinguish corners from interior', () => {
  const bounds = { x: 0, y: 0, w: 100, h: 100 };
  assert.equal(isPointInEllipse(50, 50, bounds), true);
  assert.equal(isPointInEllipse(5, 5, bounds), false); // corner is outside inscribed circle
  assert.equal(isPointInShape(5, 5, 'rect', bounds), true);
  assert.equal(isPointInShape(5, 5, 'ellipse', bounds), false);
});

test('computeResizedRect handles inverted drag and enforces minimum size', () => {
  const orig = { x: 100, y: 100, w: 100, h: 80 };
  const inverted = computeResizedRect(orig, 'se', { x: 40, y: 50 });
  assert.equal(inverted.x, 40);
  assert.equal(inverted.y, 50);
  assert.equal(inverted.w, 60);
  assert.equal(inverted.h, 50);

  const tiny = computeResizedRect(orig, 'se', { x: 102, y: 103 });
  assert.equal(tiny.w, 20);
  assert.equal(tiny.h, 20);
});

test('shouldAppendStrokePoint filters micro-jitter below threshold', () => {
  assert.equal(shouldAppendStrokePoint([], { x: 10, y: 10 }, 3), true);
  assert.equal(shouldAppendStrokePoint([{ x: 10, y: 10 }], { x: 11, y: 11 }, 3), false);
  assert.equal(shouldAppendStrokePoint([{ x: 10, y: 10 }], { x: 14, y: 10 }, 3), true);
});

test('fitBadgeDimensions shrinks badge cleanly for both narrow width and shallow height', () => {
  const measure = (fs: number) => fs * 6;
  const shallow = fitBadgeDimensions(24, measure, { width: 400, height: 24 });
  assert.ok(shallow.boxHeight <= 24, `expected boxHeight <= 24, got ${shallow.boxHeight}`);

  const narrow = fitBadgeDimensions(24, measure, { width: 90, height: 120 });
  assert.ok(narrow.boxWidth <= 90, `expected boxWidth <= 90, got ${narrow.boxWidth}`);
});

test('reorderLayer moves layers up/down safely within bounds', () => {
  const list = [makeDummyLayer('a'), makeDummyLayer('b'), makeDummyLayer('c')];
  assert.deepEqual(
    reorderLayer(list, 'b', 'up').map((l) => l.id),
    ['a', 'c', 'b']
  );
  assert.deepEqual(
    reorderLayer(list, 'b', 'down').map((l) => l.id),
    ['b', 'a', 'c']
  );
  assert.deepEqual(
    reorderLayer(list, 'a', 'down').map((l) => l.id),
    ['a', 'b', 'c']
  );
  assert.deepEqual(
    reorderLayer(list, 'c', 'up').map((l) => l.id),
    ['a', 'b', 'c']
  );
});

test('computeFloatingToolbarPos clamps within safe stage bounds', () => {
  const view = { scale: 1, offsetX: 0, offsetY: 0 };
  const nearTop = computeFloatingToolbarPos({ x: 10, y: 10, w: 60, h: 40 }, view, 800, 600);
  assert.ok(nearTop.left >= 84);
  assert.ok(nearTop.top >= 54);

  const nearBottom = computeFloatingToolbarPos({ x: 400, y: 550, w: 120, h: 40 }, view, 800, 600);
  assert.ok(nearBottom.top <= 600 - 76 - 34);
});
