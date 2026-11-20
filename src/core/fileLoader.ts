import type { CanvasSource, ExportFormat } from '../types/editor';

export const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/bmp',
];

export const IMAGE_ACCEPT_ATTR = ALLOWED_MIME_TYPES.join(',');

const ALLOWED_EXTENSION_RE = /\.(png|jpe?g|webp|gif|avif|bmp)$/i;

export const MAX_FILE_SIZE_BYTES = 35 * 1024 * 1024;
export const MAX_CANVAS_DIMENSION = 3200;

export interface LoadedImageResult {
  source: CanvasSource;
  width: number;
  height: number;
  wasResized: boolean;
}

export function validateImageFile(file: Pick<File, 'type' | 'size' | 'name'>): string | null {
  const hasAllowedMime = file.type ? ALLOWED_MIME_TYPES.includes(file.type) : false;
  const hasAllowedExt = !file.type && ALLOWED_EXTENSION_RE.test(file.name || '');
  if (!hasAllowedMime && !hasAllowedExt) {
    return '対応していない形式です（PNG / JPEG / WebP等を選択してください）';
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return 'ファイルサイズが大きすぎます（35MB以下を選択してください）';
  }
  return null;
}

export function decodeImageFile(file: File): Promise<LoadedImageResult> {
  return new Promise((resolve, reject) => {
    const validationError = validateImageFile(file);
    if (validationError) {
      reject(new Error(validationError));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let targetW = img.naturalWidth || img.width;
      let targetH = img.naturalHeight || img.height;
      if (!targetW || !targetH) {
        reject(new Error('画像の読み込みに失敗しました'));
        return;
      }

      if (targetW > MAX_CANVAS_DIMENSION || targetH > MAX_CANVAS_DIMENSION) {
        const ratio = Math.min(MAX_CANVAS_DIMENSION / targetW, MAX_CANVAS_DIMENSION / targetH);
        targetW = Math.round(targetW * ratio);
        targetH = Math.round(targetH * ratio);
        const normCanvas = document.createElement('canvas');
        normCanvas.width = targetW;
        normCanvas.height = targetH;
        const nctx = normCanvas.getContext('2d');
        nctx?.drawImage(img, 0, 0, targetW, targetH);
        resolve({ source: normCanvas, width: targetW, height: targetH, wasResized: true });
      } else {
        resolve({ source: img, width: targetW, height: targetH, wasResized: false });
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('画像データの読み込みに失敗しました'));
    };

    img.src = objectUrl;
  });
}

export function buildExportFilename(format: ExportFormat, now = new Date()): string {
  const extMap: Record<ExportFormat, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
  };
  const ext = extMap[format] || 'png';
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(
    now.getHours()
  )}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `bokasi_${stamp}.${ext}`;
}
