import type { CanvasSource, Layer } from '../types/editor';
import { getScaleFactor } from './geometry';

const MAX_FULL_CACHE = 4;
const MAX_PREVIEW_CACHE = 4;

let cachedSupportsFilter: boolean | null = null;

export function supportsCanvasFilter(): boolean {
  if (cachedSupportsFilter !== null) return cachedSupportsFilter;
  try {
    const testC = document.createElement('canvas');
    testC.width = 10;
    testC.height = 10;
    const tCtx = testC.getContext('2d');
    if (!tCtx || typeof tCtx.filter === 'undefined') {
      cachedSupportsFilter = false;
      return false;
    }
    tCtx.fillStyle = '#ffffff';
    tCtx.fillRect(4, 4, 2, 2);
    tCtx.filter = 'blur(2px)';
    tCtx.drawImage(testC, 0, 0);
    cachedSupportsFilter = tCtx.getImageData(2, 5, 1, 1).data[3] > 0;
  } catch {
    cachedSupportsFilter = false;
  }
  return cachedSupportsFilter;
}

let cachedNoiseCanvas: HTMLCanvasElement | null = null;

function getFrostedNoiseCanvas(): HTMLCanvasElement {
  if (cachedNoiseCanvas) return cachedNoiseCanvas;
  const nc = document.createElement('canvas');
  nc.width = 96;
  nc.height = 96;
  const nctx = nc.getContext('2d');
  if (nctx) {
    const imgData = nctx.createImageData(96, 96);
    // Deterministic pseudo-random grain so rendering is reproducible
    let seed = 1337;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < imgData.data.length; i += 4) {
      const v = rand() > 0.5 ? 255 : 0;
      imgData.data[i] = v;
      imgData.data[i + 1] = v;
      imgData.data[i + 2] = v;
      imgData.data[i + 3] = 15;
    }
    nctx.putImageData(imgData, 0, 0);
  }
  cachedNoiseCanvas = nc;
  return nc;
}

function createEdgeClampedCanvas(
  img: CanvasSource,
  w: number,
  h: number,
  padX: number,
  padY: number
): HTMLCanvasElement {
  const pw = w + padX * 2;
  const ph = h + padY * 2;
  const temp = document.createElement('canvas');
  temp.width = pw;
  temp.height = ph;
  const tctx = temp.getContext('2d');
  if (!tctx) return temp;

  tctx.drawImage(img, 0, 0, img.width, img.height, padX, padY, w, h);

  if (padY > 0) {
    tctx.drawImage(temp, padX, padY, w, 1, padX, 0, w, padY);
    tctx.drawImage(temp, padX, padY + h - 1, w, 1, padX, padY + h, w, padY);
  }
  if (padX > 0) {
    tctx.drawImage(temp, padX, 0, 1, ph, 0, 0, padX, ph);
    tctx.drawImage(temp, padX + w - 1, 0, 1, ph, padX + w, 0, padX, ph);
  }
  return temp;
}

/**
 * Opaque multi-stage downscale/upscale fallback blur for browsers without ctx.filter.
 * Always produces 100% opaque pixels (fixes the 93.75% semi-transparent artifact).
 */
function applyFallbackBlur(
  targetCtx: CanvasRenderingContext2D,
  img: CanvasSource,
  w: number,
  h: number,
  blurPx: number
): void {
  const factor = Math.max(2, Math.min(28, blurPx * 0.75));
  const sw = Math.max(1, Math.round(w / factor));
  const sh = Math.max(1, Math.round(h / factor));

  const tempA = document.createElement('canvas');
  tempA.width = sw;
  tempA.height = sh;
  const ctxA = tempA.getContext('2d');
  if (!ctxA) return;
  ctxA.imageSmoothingEnabled = true;
  ctxA.imageSmoothingQuality = 'high';
  ctxA.drawImage(img, 0, 0, img.width, img.height, 0, 0, sw, sh);

  // Second softening pass for smoother gradients
  const sw2 = Math.max(1, Math.round(sw * 0.65));
  const sh2 = Math.max(1, Math.round(sh * 0.65));
  const tempB = document.createElement('canvas');
  tempB.width = sw2;
  tempB.height = sh2;
  const ctxB = tempB.getContext('2d');
  if (ctxB) {
    ctxB.imageSmoothingEnabled = true;
    ctxB.imageSmoothingQuality = 'high';
    ctxB.drawImage(tempA, 0, 0, sw2, sh2);
    ctxA.drawImage(tempB, 0, 0, sw, sh);
  }

  targetCtx.save();
  targetCtx.imageSmoothingEnabled = true;
  targetCtx.imageSmoothingQuality = 'high';
  // Base opaque pass first so alpha is strictly 1.0
  targetCtx.globalAlpha = 1;
  targetCtx.drawImage(tempA, 0, 0, sw, sh, 0, 0, w, h);

  // Subtle jittered accumulation on top of opaque base
  const offsets: [number, number][] = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  const jitterMag = Math.max(1, Math.min(6, blurPx * 0.25));
  targetCtx.globalAlpha = 0.25;
  for (const [dx, dy] of offsets) {
    targetCtx.drawImage(tempA, 0, 0, sw, sh, dx * jitterMag, dy * jitterMag, w, h);
  }
  targetCtx.restore();
}

export function applyGaussianBlur(
  targetCtx: CanvasRenderingContext2D,
  img: CanvasSource,
  w: number,
  h: number,
  blurPx: number
): void {
  if (supportsCanvasFilter()) {
    const pad = Math.min(220, Math.ceil(blurPx * 2.5));
    const padded = createEdgeClampedCanvas(img, w, h, pad, pad);
    targetCtx.save();
    targetCtx.filter = `blur(${blurPx.toFixed(1)}px)`;
    targetCtx.drawImage(padded, pad, pad, w, h, 0, 0, w, h);
    targetCtx.restore();
  } else {
    applyFallbackBlur(targetCtx, img, w, h, blurPx);
  }
}

export function getSolidFillColor(blurType: Layer['blurType']): string | null {
  if (blurType === 'solid-black') return '#0f172a';
  if (blurType === 'solid-white') return '#ffffff';
  return null;
}

export class EffectCacheManager {
  private fullCache = new Map<string, HTMLCanvasElement>();
  private previewCache = new Map<string, HTMLCanvasElement>();

  clear(): void {
    this.fullCache.clear();
    this.previewCache.clear();
  }

  private store(
    cache: Map<string, HTMLCanvasElement>,
    key: string,
    canvas: HTMLCanvasElement,
    maxSize: number
  ): void {
    if (cache.has(key)) {
      cache.delete(key);
    } else if (cache.size >= maxSize) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) cache.delete(oldestKey);
    }
    cache.set(key, canvas);
  }

  getEffectCanvas(
    sourceImage: CanvasSource,
    imgWidth: number,
    imgHeight: number,
    layer: Layer,
    lowResPreview = false
  ): HTMLCanvasElement {
    const usePreview = lowResPreview && Math.max(imgWidth, imgHeight) > 900;
    const cache = usePreview ? this.previewCache : this.fullCache;
    const maxCacheSize = usePreview ? MAX_PREVIEW_CACHE : MAX_FULL_CACHE;
    const key = `${layer.blurType}_${layer.strength}`;

    const cached = cache.get(key);
    if (cached) {
      cache.delete(key);
      cache.set(key, cached);
      return cached;
    }

    const resolutionScale = usePreview ? 0.5 : 1;
    const w = Math.max(1, Math.round(imgWidth * resolutionScale));
    const h = Math.max(1, Math.round(imgHeight * resolutionScale));

    const ec = document.createElement('canvas');
    ec.width = w;
    ec.height = h;
    const ectx = ec.getContext('2d');
    if (!ectx) return ec;

    const scaleFactor = getScaleFactor(imgWidth, imgHeight) * resolutionScale;
    const scaledStrength = Math.max(1, layer.strength * scaleFactor);

    if (layer.blurType === 'gaussian' || layer.blurType === 'frosted') {
      applyGaussianBlur(ectx, sourceImage, w, h, scaledStrength);
      if (layer.blurType === 'frosted') {
        ectx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ectx.fillRect(0, 0, w, h);
        const pat = ectx.createPattern(getFrostedNoiseCanvas(), 'repeat');
        if (pat) {
          ectx.fillStyle = pat;
          ectx.fillRect(0, 0, w, h);
        }
      }
    } else if (layer.blurType === 'mosaic') {
      const blockSize = Math.max(3, Math.round(scaledStrength * 1.4));
      const sw = Math.max(1, Math.round(w / blockSize));
      const sh = Math.max(1, Math.round(h / blockSize));
      const temp = document.createElement('canvas');
      temp.width = sw;
      temp.height = sh;
      const tctx = temp.getContext('2d');
      if (tctx) {
        tctx.imageSmoothingEnabled = true;
        tctx.drawImage(sourceImage, 0, 0, sourceImage.width, sourceImage.height, 0, 0, sw, sh);
        ectx.imageSmoothingEnabled = false;
        ectx.drawImage(temp, 0, 0, sw, sh, 0, 0, w, h);
        ectx.imageSmoothingEnabled = true;
      }
    } else if (layer.blurType === 'motion') {
      // Edge-clamped horizontal motion blur so left/right edges never bleed transparent
      const distance = Math.max(4, Math.round(scaledStrength * 2.2));
      const padX = Math.ceil(distance / 2) + 2;
      const padded = createEdgeClampedCanvas(sourceImage, w, h, padX, 0);
      const steps = 16;
      ectx.save();
      // Opaque base pass guarantees alpha === 1.0 across entire frame
      ectx.globalAlpha = 1;
      ectx.drawImage(padded, padX, 0, w, h, 0, 0, w, h);
      for (let i = 0; i < steps; i++) {
        const offset = (i / (steps - 1) - 0.5) * distance;
        ectx.globalAlpha = 1 / (i + 2);
        ectx.drawImage(padded, padX + offset, 0, w, h, 0, 0, w, h);
      }
      ectx.restore();
    }

    this.store(cache, key, ec, maxCacheSize);
    return ec;
  }
}
