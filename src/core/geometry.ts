import type { HandleKey, Layer, Point, Rect, ShapeType, ViewTransform } from '../types/editor';

export const MIN_ZOOM = 0.15;
export const MAX_ZOOM = 6;
export const MIN_RECT_SIZE = 20;
export const MIN_STROKE_POINT_DIST = 2.5;

export function getScaleFactor(imgWidth: number, imgHeight: number): number {
  if (!imgWidth || !imgHeight) return 1;
  return Math.max(imgWidth, imgHeight) / 1000;
}

export function getScaledBrushSize(brushSize: number, imgWidth: number, imgHeight: number): number {
  return Math.max(6, Math.round(brushSize * getScaleFactor(imgWidth, imgHeight)));
}

export function computeFitTransform(
  viewportW: number,
  viewportH: number,
  imgW: number,
  imgH: number,
  padding = 32
): ViewTransform {
  if (!viewportW || !viewportH || !imgW || !imgH) {
    return { scale: 1, offsetX: 0, offsetY: 0 };
  }
  const availW = Math.max(40, viewportW - padding * 2);
  const availH = Math.max(40, viewportH - padding * 2);
  const scale = Math.max(MIN_ZOOM, Math.min(availW / imgW, availH / imgH, 1.5));
  return {
    scale,
    offsetX: (viewportW - imgW * scale) / 2,
    offsetY: (viewportH - imgH * scale) / 2,
  };
}

export function zoomAroundPoint(
  view: ViewTransform,
  cx: number,
  cy: number,
  factor: number
): ViewTransform {
  const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, view.scale * factor));
  const ratio = newScale / view.scale;
  return {
    scale: newScale,
    offsetX: cx - (cx - view.offsetX) * ratio,
    offsetY: cy - (cy - view.offsetY) * ratio,
  };
}

export function clientToImagePoint(
  clientX: number,
  clientY: number,
  canvasLeft: number,
  canvasTop: number,
  view: ViewTransform
): Point {
  return {
    x: (clientX - canvasLeft - view.offsetX) / view.scale,
    y: (clientY - canvasTop - view.offsetY) / view.scale,
  };
}

export function imageToCanvasPoint(imgPt: Point, view: ViewTransform): Point {
  return {
    x: imgPt.x * view.scale + view.offsetX,
    y: imgPt.y * view.scale + view.offsetY,
  };
}

export function getRectHandles(r: Rect): Record<HandleKey, Point> {
  return {
    nw: { x: r.x, y: r.y },
    n: { x: r.x + r.w / 2, y: r.y },
    ne: { x: r.x + r.w, y: r.y },
    e: { x: r.x + r.w, y: r.y + r.h / 2 },
    se: { x: r.x + r.w, y: r.y + r.h },
    s: { x: r.x + r.w / 2, y: r.y + r.h },
    sw: { x: r.x, y: r.y + r.h },
    w: { x: r.x, y: r.y + r.h / 2 },
  };
}

export function getVisibleHandleKeys(r: Rect, viewScale: number): HandleKey[] {
  const keys: HandleKey[] = ['nw', 'ne', 'se', 'sw'];
  if (r.w * viewScale >= 72) keys.push('n', 's');
  if (r.h * viewScale >= 72) keys.push('e', 'w');
  return keys;
}

export function hitTestRectHandles(
  r: Rect,
  imgX: number,
  imgY: number,
  viewScale: number,
  hitRadiusCss = 18
): HandleKey | null {
  const handles = getRectHandles(r);
  const visibleKeys = getVisibleHandleKeys(r, viewScale);
  const hitRadius = hitRadiusCss / Math.max(viewScale, 0.05);
  for (const key of visibleKeys) {
    const pt = handles[key];
    if (Math.hypot(imgX - pt.x, imgY - pt.y) <= hitRadius) {
      return key;
    }
  }
  return null;
}

export function isPointInRect(x: number, y: number, r: Rect): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function isPointInEllipse(x: number, y: number, r: Rect): boolean {
  const rx = r.w / 2;
  const ry = r.h / 2;
  if (rx <= 0 || ry <= 0) return false;
  const dx = (x - (r.x + rx)) / rx;
  const dy = (y - (r.y + ry)) / ry;
  return dx * dx + dy * dy <= 1;
}

export function isPointInShape(x: number, y: number, shapeType: ShapeType, r: Rect): boolean {
  if (shapeType === 'ellipse') return isPointInEllipse(x, y, r);
  if (shapeType === 'rect') return isPointInRect(x, y, r);
  return false;
}

export function isBoxShape(shapeType: ShapeType): boolean {
  return shapeType === 'rect' || shapeType === 'ellipse';
}

export function computeResizedRect(orig: Rect, handle: HandleKey, pt: Point): Rect {
  let left = orig.x;
  let top = orig.y;
  let right = orig.x + orig.w;
  let bottom = orig.y + orig.h;

  if (handle.includes('e')) right = pt.x;
  if (handle.includes('w')) left = pt.x;
  if (handle.includes('s')) bottom = pt.y;
  if (handle.includes('n')) top = pt.y;

  return {
    x: Math.min(left, right),
    y: Math.min(top, bottom),
    w: Math.max(MIN_RECT_SIZE, Math.abs(right - left)),
    h: Math.max(MIN_RECT_SIZE, Math.abs(bottom - top)),
  };
}

export function shouldAppendStrokePoint(
  points: Point[],
  next: Point,
  minDistance = MIN_STROKE_POINT_DIST
): boolean {
  if (points.length === 0) return true;
  const prev = points[points.length - 1];
  return Math.hypot(next.x - prev.x, next.y - prev.y) >= minDistance;
}

export interface BadgeFitResult {
  fontSize: number;
  padX: number;
  padY: number;
  boxWidth: number;
  boxHeight: number;
}

export function fitBadgeDimensions(
  baseFontSize: number,
  measureWidth: (fontSize: number) => number,
  bounds?: { width: number; height: number }
): BadgeFitResult {
  let fontSize = Math.max(9, Math.round(baseFontSize));
  const calc = (fs: number): BadgeFitResult => {
    const textW = measureWidth(fs);
    const padX = Math.max(6, Math.round(fs * 0.72));
    const padY = Math.max(3, Math.round(fs * 0.38));
    return {
      fontSize: fs,
      padX,
      padY,
      boxWidth: textW + padX * 2,
      boxHeight: fs + padY * 2,
    };
  };

  let res = calc(fontSize);
  if (bounds && bounds.width > 20 && bounds.height > 14) {
    const maxW = bounds.width * 0.9;
    const maxH = bounds.height * 0.8;
    const ratioW = res.boxWidth > maxW ? maxW / res.boxWidth : 1;
    const ratioH = res.boxHeight > maxH ? maxH / res.boxHeight : 1;
    const ratio = Math.min(ratioW, ratioH);
    if (ratio < 1) {
      fontSize = Math.max(8, Math.floor(fontSize * ratio));
      res = calc(fontSize);
    }
  }

  return res;
}

export function reorderLayer(
  layers: Layer[],
  layerId: string,
  direction: 'up' | 'down'
): Layer[] {
  const idx = layers.findIndex((l) => l.id === layerId);
  if (idx === -1) return layers;
  const targetIdx = direction === 'up' ? idx + 1 : idx - 1;
  if (targetIdx < 0 || targetIdx >= layers.length) return layers;
  const next = [...layers];
  const [moved] = next.splice(idx, 1);
  next.splice(targetIdx, 0, moved);
  return next;
}

export interface FloatingActionPos {
  left: number;
  top: number;
}

/**
 * Computes a clean clamped position for the contextual action pill near a selected box,
 * avoiding top HUD and bottom tool dock overlaps.
 */
export function computeFloatingToolbarPos(
  rect: Rect,
  view: ViewTransform,
  stageW: number,
  stageH: number,
  toolbarW = 144,
  toolbarH = 34
): FloatingActionPos {
  const centerX = (rect.x + rect.w / 2) * view.scale + view.offsetX;
  const topY = rect.y * view.scale + view.offsetY;
  const bottomY = (rect.y + rect.h) * view.scale + view.offsetY;

  const halfW = toolbarW / 2;
  const left = Math.max(halfW + 12, Math.min(stageW - halfW - 12, centerX));

  const preferredTop = topY - toolbarH - 12;
  const fallbackBottom = bottomY + 12;
  const maxSafeY = Math.max(54, stageH - 76 - toolbarH);

  let top: number;
  if (preferredTop >= 54) {
    top = Math.min(preferredTop, maxSafeY);
  } else if (fallbackBottom <= maxSafeY) {
    top = fallbackBottom;
  } else {
    top = 54;
  }

  return { left, top };
}
