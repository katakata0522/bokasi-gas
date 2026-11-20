import type { CanvasSource, Layer, Point, Stroke, ToolMode, ViewTransform } from '../types/editor';
import { EffectCacheManager, getSolidFillColor, supportsCanvasFilter } from './effects';
import {
  fitBadgeDimensions,
  getRectHandles,
  getScaleFactor,
  getScaledBrushSize,
  getVisibleHandleKeys,
  isBoxShape,
} from './geometry';

export function drawRoundRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + w, y, x + w, y + h, radius);
  context.arcTo(x + w, y + h, x, y + h, radius);
  context.arcTo(x, y + h, x, y, radius);
  context.arcTo(x, y, x + w, y, radius);
  context.closePath();
}

export function drawEllipsePath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const rx = Math.max(1, w / 2);
  const ry = Math.max(1, h / 2);
  context.beginPath();
  context.ellipse(x + rx, y + ry, rx, ry, 0, 0, Math.PI * 2);
  context.closePath();
}

export function drawSmoothStroke(
  c: CanvasRenderingContext2D,
  points: Point[],
  size: number
): void {
  if (!points || points.length === 0) return;
  if (points.length === 1) {
    c.beginPath();
    c.arc(points[0].x, points[0].y, size / 2, 0, Math.PI * 2);
    c.fill();
    return;
  }
  c.lineWidth = size;
  c.beginPath();
  c.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    c.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
  }
  const last = points[points.length - 1];
  c.lineTo(last.x, last.y);
  c.stroke();
}

function paintLayerMask(
  maskCtx: CanvasRenderingContext2D,
  layer: Layer,
  imgWidth: number,
  imgHeight: number,
  scaleFactor: number,
  featherPx: number,
  filterZoomMultiplier = 1
): void {
  const canFilter = supportsCanvasFilter();

  maskCtx.save();
  if (layer.shapeType === 'full') {
    maskCtx.fillStyle = '#000000';
    maskCtx.fillRect(0, 0, imgWidth, imgHeight);
  } else {
    if (featherPx > 0 && canFilter) {
      maskCtx.filter = `blur(${(featherPx * filterZoomMultiplier).toFixed(1)}px)`;
    }
    maskCtx.fillStyle = '#000000';
    maskCtx.strokeStyle = '#000000';
    maskCtx.lineCap = 'round';
    maskCtx.lineJoin = 'round';

    if (layer.shapeType === 'rect') {
      const r = layer.rect;
      const inset = Math.min(featherPx * 0.35, Math.min(r.w, r.h) * 0.25);
      drawRoundRectPath(
        maskCtx,
        r.x + inset,
        r.y + inset,
        Math.max(2, r.w - inset * 2),
        Math.max(2, r.h - inset * 2),
        layer.borderRadius * scaleFactor
      );
      maskCtx.fill();
    } else if (layer.shapeType === 'ellipse') {
      const r = layer.rect;
      const inset = Math.min(featherPx * 0.35, Math.min(r.w, r.h) * 0.25);
      drawEllipsePath(
        maskCtx,
        r.x + inset,
        r.y + inset,
        Math.max(2, r.w - inset * 2),
        Math.max(2, r.h - inset * 2)
      );
      maskCtx.fill();
    } else if (layer.shapeType === 'brush') {
      for (const stroke of layer.strokes) {
        drawSmoothStroke(maskCtx, stroke.points, stroke.size);
      }
    }
  }
  maskCtx.restore();

  if (layer.erasers && layer.erasers.length > 0) {
    maskCtx.save();
    maskCtx.globalCompositeOperation = 'destination-out';
    if (canFilter) {
      const blurAmt = Math.max(2, Math.round(4 * scaleFactor * filterZoomMultiplier));
      maskCtx.filter = `blur(${blurAmt}px)`;
    }
    maskCtx.strokeStyle = '#000000';
    maskCtx.fillStyle = '#000000';
    maskCtx.lineCap = 'round';
    maskCtx.lineJoin = 'round';
    for (const eraser of layer.erasers) {
      drawSmoothStroke(maskCtx, eraser.points, eraser.size);
    }
    maskCtx.restore();
  }

  if (layer.shapeType === 'full' && layer.strokes && layer.strokes.length > 0) {
    maskCtx.save();
    maskCtx.globalCompositeOperation = 'source-over';
    if (canFilter) {
      const blurAmt = Math.max(2, Math.round(4 * scaleFactor * filterZoomMultiplier));
      maskCtx.filter = `blur(${blurAmt}px)`;
    }
    maskCtx.strokeStyle = '#000000';
    maskCtx.fillStyle = '#000000';
    maskCtx.lineCap = 'round';
    maskCtx.lineJoin = 'round';
    for (const stroke of layer.strokes) {
      drawSmoothStroke(maskCtx, stroke.points, stroke.size);
    }
    maskCtx.restore();
  }
}

export function drawLayerBadge(
  destCtx: CanvasRenderingContext2D,
  layer: Layer,
  imgWidth: number,
  imgHeight: number
): void {
  const badgeText = (layer.badge || '').trim();
  if (!badgeText || !layer.visible) return;

  let cx = imgWidth / 2;
  let cy = imgHeight / 2;
  let bounds: { width: number; height: number } | undefined;

  if (isBoxShape(layer.shapeType)) {
    cx = layer.rect.x + layer.rect.w / 2;
    cy = layer.rect.y + layer.rect.h / 2;
    bounds = {
      width: layer.shapeType === 'ellipse' ? layer.rect.w * 0.78 : layer.rect.w,
      height: layer.shapeType === 'ellipse' ? layer.rect.h * 0.78 : layer.rect.h,
    };
  } else if (layer.shapeType === 'brush' && layer.strokes.length > 0) {
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    layer.strokes.forEach((s: Stroke) =>
      s.points.forEach((p: Point) => {
        sumX += p.x;
        sumY += p.y;
        count++;
      })
    );
    if (count > 0) {
      cx = sumX / count;
      cy = sumY / count;
    }
  }

  const scaleFactor = getScaleFactor(imgWidth, imgHeight);
  const baseFontSize = Math.max(12, Math.round(22 * scaleFactor));

  destCtx.save();
  const fitted = fitBadgeDimensions(
    baseFontSize,
    (fs) => {
      destCtx.font = `700 ${fs}px "Plus Jakarta Sans", "Noto Sans JP", sans-serif`;
      return destCtx.measureText(badgeText).width;
    },
    bounds
  );

  destCtx.font = `700 ${fitted.fontSize}px "Plus Jakarta Sans", "Noto Sans JP", sans-serif`;
  destCtx.shadowColor = 'rgba(15, 23, 42, 0.22)';
  destCtx.shadowBlur = 10 * scaleFactor;
  destCtx.shadowOffsetY = 3 * scaleFactor;
  destCtx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  drawRoundRectPath(
    destCtx,
    cx - fitted.boxWidth / 2,
    cy - fitted.boxHeight / 2,
    fitted.boxWidth,
    fitted.boxHeight,
    fitted.boxHeight / 2
  );
  destCtx.fill();

  destCtx.shadowColor = 'transparent';
  destCtx.fillStyle = '#ffffff';
  destCtx.textAlign = 'center';
  destCtx.textBaseline = 'middle';
  destCtx.fillText(badgeText, cx, cy + 0.5);
  destCtx.restore();
}

export class CanvasRenderer {
  private workCanvas = document.createElement('canvas');
  private workCtx = this.workCanvas.getContext('2d')!;
  private loupePatchCanvas = document.createElement('canvas');
  private loupePatchCtx = this.loupePatchCanvas.getContext('2d')!;
  public effectCache = new EffectCacheManager();

  clearCaches(): void {
    this.effectCache.clear();
  }

  compositeLayer(
    destCtx: CanvasRenderingContext2D,
    sourceImage: CanvasSource,
    imgWidth: number,
    imgHeight: number,
    layer: Layer,
    lowResPreview = false
  ): void {
    if (!layer.visible) return;
    const scaleFactor = getScaleFactor(imgWidth, imgHeight);
    const featherPx = Math.round(layer.feather * scaleFactor);
    const solidColor = getSolidFillColor(layer.blurType);

    if (this.workCanvas.width !== imgWidth || this.workCanvas.height !== imgHeight) {
      this.workCanvas.width = imgWidth;
      this.workCanvas.height = imgHeight;
    }

    let bx = 0;
    let by = 0;
    let bw = imgWidth;
    let bh = imgHeight;

    if (isBoxShape(layer.shapeType) && (!layer.erasers || layer.erasers.length === 0)) {
      const r = layer.rect;
      const pad = Math.ceil(featherPx * 2.5) + 4;
      bx = Math.max(0, Math.floor(r.x - pad));
      by = Math.max(0, Math.floor(r.y - pad));
      const bx2 = Math.min(imgWidth, Math.ceil(r.x + r.w + pad));
      const by2 = Math.min(imgHeight, Math.ceil(r.y + r.h + pad));
      bw = bx2 - bx;
      bh = by2 - by;
      if (bw <= 0 || bh <= 0) return;
    }

    this.workCtx.clearRect(bx, by, bw, bh);
    paintLayerMask(this.workCtx, layer, imgWidth, imgHeight, scaleFactor, featherPx, 1);

    this.workCtx.save();
    this.workCtx.globalCompositeOperation = 'source-in';
    if (solidColor) {
      this.workCtx.fillStyle = solidColor;
      this.workCtx.fillRect(bx, by, bw, bh);
    } else {
      const effectCanvas = this.effectCache.getEffectCanvas(
        sourceImage,
        imgWidth,
        imgHeight,
        layer,
        lowResPreview
      );
      this.workCtx.imageSmoothingEnabled = layer.blurType !== 'mosaic';
      const sx = (bx / imgWidth) * effectCanvas.width;
      const sy = (by / imgHeight) * effectCanvas.height;
      const sw = (bw / imgWidth) * effectCanvas.width;
      const sh = (bh / imgHeight) * effectCanvas.height;
      this.workCtx.drawImage(effectCanvas, sx, sy, sw, sh, bx, by, bw, bh);
    }
    this.workCtx.restore();

    destCtx.save();
    destCtx.globalAlpha = layer.opacity;
    destCtx.drawImage(this.workCanvas, bx, by, bw, bh, bx, by, bw, bh);
    destCtx.restore();

    drawLayerBadge(destCtx, layer, imgWidth, imgHeight);
  }

  renderMainCanvas(options: {
    canvas: HTMLCanvasElement;
    dpr: number;
    cssWidth: number;
    cssHeight: number;
    sourceImage: CanvasSource | null;
    imgWidth: number;
    imgHeight: number;
    layers: Layer[];
    selectedLayerId: string | null;
    activeTool: ToolMode;
    brushSize: number;
    view: ViewTransform;
    isComparing: boolean;
    hoverImgPos: Point | null;
    lowResPreview: boolean;
    isManipulating: boolean;
  }): void {
    const {
      canvas,
      dpr,
      cssWidth,
      cssHeight,
      sourceImage,
      imgWidth,
      imgHeight,
      layers,
      selectedLayerId,
      activeTool,
      brushSize,
      view,
      isComparing,
      hoverImgPos,
      lowResPreview,
      isManipulating,
    } = options;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    if (!sourceImage) return;

    ctx.save();
    ctx.translate(view.offsetX, view.offsetY);
    ctx.scale(view.scale, view.scale);

    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.14)';
    ctx.shadowBlur = 24 / view.scale;
    ctx.shadowOffsetY = 8 / view.scale;
    ctx.drawImage(sourceImage, 0, 0, imgWidth, imgHeight);
    ctx.restore();

    if (!isComparing) {
      for (const layer of layers) {
        this.compositeLayer(ctx, sourceImage, imgWidth, imgHeight, layer, lowResPreview);
      }

      const sel = layers.find((l) => l.id === selectedLayerId) || null;
      if (
        sel &&
        sel.visible &&
        isBoxShape(sel.shapeType) &&
        activeTool !== 'pan' &&
        activeTool !== 'brush' &&
        activeTool !== 'eraser'
      ) {
        this.drawSelectionChrome(ctx, sel, imgWidth, imgHeight, view.scale, isManipulating);
      }
    }

    if ((activeTool === 'brush' || activeTool === 'eraser') && hoverImgPos) {
      const r = getScaledBrushSize(brushSize, imgWidth, imgHeight) / 2;
      const invScale = 1 / view.scale;
      ctx.save();
      ctx.beginPath();
      ctx.arc(hoverImgPos.x, hoverImgPos.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.lineWidth = 2.6 * invScale;
      ctx.stroke();
      ctx.strokeStyle = activeTool === 'eraser' ? '#e11d48' : '#2563eb';
      ctx.lineWidth = 1.4 * invScale;
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Minimalist modern studio selection chrome: crisp hairline + refined corner dots,
   * zero clunky dashed blue PC wireframe; fades to ultra-subtle guide while actively dragging.
   */
  private drawSelectionChrome(
    c: CanvasRenderingContext2D,
    layer: Layer,
    imgWidth: number,
    imgHeight: number,
    viewScale: number,
    isManipulating: boolean
  ): void {
    const r = layer.rect;
    const invScale = 1 / viewScale;
    const scaleFactor = getScaleFactor(imgWidth, imgHeight);

    const traceShape = () => {
      if (layer.shapeType === 'ellipse') {
        drawEllipsePath(c, r.x, r.y, r.w, r.h);
      } else {
        drawRoundRectPath(c, r.x, r.y, r.w, r.h, layer.borderRadius * scaleFactor);
      }
    };

    c.save();

    // Subtle crisp outline (no marching-ant dashes)
    c.strokeStyle = isManipulating ? 'rgba(255, 255, 255, 0.65)' : 'rgba(255, 255, 255, 0.9)';
    c.lineWidth = (isManipulating ? 2 : 2.6) * invScale;
    traceShape();
    c.stroke();

    c.strokeStyle = isManipulating ? 'rgba(15, 23, 42, 0.35)' : 'rgba(37, 99, 235, 0.82)';
    c.lineWidth = (isManipulating ? 1 : 1.35) * invScale;
    traceShape();
    c.stroke();

    // Hide handles during active drag/resize so edges remain unobstructed
    if (!isManipulating) {
      // For ellipse, draw an ultra-faint bounding guide connecting corner handles
      if (layer.shapeType === 'ellipse') {
        c.strokeStyle = 'rgba(37, 99, 235, 0.22)';
        c.lineWidth = 1 * invScale;
        c.strokeRect(r.x, r.y, r.w, r.h);
      }

      const handles = getRectHandles(r);
      const visibleKeys = getVisibleHandleKeys(r, viewScale);

      c.shadowColor = 'rgba(15, 23, 42, 0.22)';
      c.shadowBlur = 4 * invScale;
      c.shadowOffsetY = 1 * invScale;

      for (const key of visibleKeys) {
        const pt = handles[key];
        const isCorner = key.length === 2;
        const radius = (isCorner ? 4.8 : 3.6) * invScale;
        c.beginPath();
        c.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        c.fillStyle = '#ffffff';
        c.fill();
        c.lineWidth = 1.6 * invScale;
        c.strokeStyle = '#2563eb';
        c.stroke();
      }
    }

    c.restore();
  }

  renderLoupe(options: {
    loupeCanvas: HTMLCanvasElement;
    sourceImage: CanvasSource;
    imgWidth: number;
    imgHeight: number;
    layers: Layer[];
    imgX: number;
    imgY: number;
    brushSize: number;
    activeTool: ToolMode;
  }): void {
    const { loupeCanvas, sourceImage, imgWidth, imgHeight, layers, imgX, imgY, brushSize, activeTool } =
      options;
    const loupeCtx = loupeCanvas.getContext('2d');
    if (!loupeCtx) return;

    const lw = loupeCanvas.width;
    const lh = loupeCanvas.height;
    const zoom = 2.2;
    const srcSize = lw / zoom;
    const sx = imgX - srcSize / 2;
    const sy = imgY - srcSize / 2;

    if (this.loupePatchCanvas.width !== lw || this.loupePatchCanvas.height !== lh) {
      this.loupePatchCanvas.width = lw;
      this.loupePatchCanvas.height = lh;
    }

    loupeCtx.clearRect(0, 0, lw, lh);
    loupeCtx.fillStyle = '#e6ebf1';
    loupeCtx.fillRect(0, 0, lw, lh);

    // Transform-based draw avoids negative source-rect errors near image borders on all browsers
    loupeCtx.save();
    loupeCtx.scale(zoom, zoom);
    loupeCtx.translate(-sx, -sy);
    loupeCtx.drawImage(sourceImage, 0, 0, imgWidth, imgHeight);
    loupeCtx.restore();

    const scaleFactor = getScaleFactor(imgWidth, imgHeight);

    for (const layer of layers) {
      if (!layer.visible) continue;
      const solidColor = getSolidFillColor(layer.blurType);
      const featherPx = Math.round(layer.feather * scaleFactor);

      this.loupePatchCtx.clearRect(0, 0, lw, lh);
      this.loupePatchCtx.save();
      this.loupePatchCtx.scale(zoom, zoom);
      this.loupePatchCtx.translate(-sx, -sy);
      paintLayerMask(this.loupePatchCtx, layer, imgWidth, imgHeight, scaleFactor, featherPx, zoom);
      this.loupePatchCtx.restore();

      this.loupePatchCtx.save();
      this.loupePatchCtx.globalCompositeOperation = 'source-in';
      if (solidColor) {
        this.loupePatchCtx.fillStyle = solidColor;
        this.loupePatchCtx.fillRect(0, 0, lw, lh);
      } else {
        const effectCanvas = this.effectCache.getEffectCanvas(
          sourceImage,
          imgWidth,
          imgHeight,
          layer,
          false
        );
        this.loupePatchCtx.imageSmoothingEnabled = layer.blurType !== 'mosaic';
        this.loupePatchCtx.scale(zoom, zoom);
        this.loupePatchCtx.translate(-sx, -sy);
        this.loupePatchCtx.drawImage(effectCanvas, 0, 0, imgWidth, imgHeight);
      }
      this.loupePatchCtx.restore();

      loupeCtx.save();
      loupeCtx.globalAlpha = layer.opacity;
      loupeCtx.drawImage(this.loupePatchCanvas, 0, 0);
      loupeCtx.restore();
    }

    const radiusOnLoupe = (getScaledBrushSize(brushSize, imgWidth, imgHeight) / 2) * zoom;
    loupeCtx.beginPath();
    loupeCtx.arc(lw / 2, lh / 2, Math.max(3, radiusOnLoupe), 0, Math.PI * 2);
    loupeCtx.strokeStyle = activeTool === 'eraser' ? '#e11d48' : '#2563eb';
    loupeCtx.lineWidth = 2;
    loupeCtx.stroke();
  }

  renderFinalExport(
    sourceImage: CanvasSource,
    imgWidth: number,
    imgHeight: number,
    layers: Layer[],
    fillWhiteBg = false
  ): HTMLCanvasElement {
    const out = document.createElement('canvas');
    out.width = imgWidth;
    out.height = imgHeight;
    const octx = out.getContext('2d');
    if (!octx) return out;

    if (fillWhiteBg) {
      octx.fillStyle = '#ffffff';
      octx.fillRect(0, 0, imgWidth, imgHeight);
    }
    octx.drawImage(sourceImage, 0, 0, imgWidth, imgHeight);
    for (const layer of layers) {
      this.compositeLayer(octx, sourceImage, imgWidth, imgHeight, layer, false);
    }
    return out;
  }
}

export function createDemoScreenshotCanvas(): HTMLCanvasElement {
  const w = 960;
  const h = 640;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;

  g.fillStyle = '#f8fafc';
  g.fillRect(0, 0, w, h);

  g.fillStyle = '#e2e8f0';
  g.fillRect(0, 0, w, 44);
  ['#ef4444', '#f59e0b', '#10b981'].forEach((col, i) => {
    g.fillStyle = col;
    g.beginPath();
    g.arc(24 + i * 20, 22, 6, 0, Math.PI * 2);
    g.fill();
  });

  g.fillStyle = '#ffffff';
  drawRoundRectPath(g, 110, 9, w - 140, 26, 8);
  g.fill();
  g.fillStyle = '#64748b';
  g.font = '13px "IBM Plex Mono", monospace';
  g.fillText('https://app.example.jp/analytics/q4-report', 126, 27);

  g.fillStyle = '#ffffff';
  drawRoundRectPath(g, 40, 72, w - 80, 152, 16);
  g.fill();
  g.strokeStyle = '#cbd5e1';
  g.lineWidth = 1.5;
  g.stroke();

  g.fillStyle = '#0f172a';
  g.font = '700 25px "Noto Sans JP", sans-serif';
  g.fillText('プロジェクト進捗レポート（サンプル画像）', 68, 120);
  g.fillStyle = '#475569';
  g.font = '16px "Noto Sans JP", sans-serif';
  g.fillText('担当：プロダクト開発チーム  /  連絡先：team@example.jp  /  公開予定：来週金曜', 68, 158);
  g.fillStyle = '#2563eb';
  g.font = '600 15px "Noto Sans JP", sans-serif';
  g.fillText('隠したい場所をドラッグで囲むか、ブラシでなぞってぼかしてみてください', 68, 196);

  const cards = [
    {
      title: '売上データサマリー（社外秘）',
      line: '今月の達成率：128.4%（前年比 +32% / 新規契約 412件）',
      bg: '#eff6ff',
      bd: '#bfdbfe',
    },
    {
      title: '次期リリース候補の機能一覧',
      line: 'v3.0 アップデート：リアルタイム同期 & カスタムレポート機能',
      bg: '#fefce8',
      bd: '#fde68a',
    },
  ];
  cards.forEach((item, idx) => {
    const y = 250 + idx * 176;
    g.fillStyle = item.bg;
    drawRoundRectPath(g, 40, y, w - 80, 150, 16);
    g.fill();
    g.strokeStyle = item.bd;
    g.stroke();
    g.fillStyle = '#0f172a';
    g.font = '700 21px "Noto Sans JP", sans-serif';
    g.fillText(item.title, 68, y + 54);
    g.fillStyle = '#334155';
    g.font = '17px "Noto Sans JP", sans-serif';
    g.fillText(item.line, 68, y + 98);
  });

  return c;
}
