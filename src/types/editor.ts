export type ShapeType = 'rect' | 'ellipse' | 'full' | 'brush';

export type BlurType =
  | 'gaussian'
  | 'frosted'
  | 'mosaic'
  | 'motion'
  | 'solid-black'
  | 'solid-white';

export type ToolMode = 'rect' | 'ellipse' | 'brush' | 'eraser' | 'pan';

export type PresetId = 'tease' | 'strong' | 'redact' | 'frosted' | 'mosaic';

export type ExportFormat = 'image/png' | 'image/jpeg' | 'image/webp';

export type HandleKey = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Stroke {
  size: number;
  points: Point[];
}

export interface LayerStyle {
  blurType: BlurType;
  strength: number;
  opacity: number;
  feather: number;
  borderRadius: number;
}

export interface Layer extends LayerStyle {
  id: string;
  name: string;
  shapeType: ShapeType;
  badge: string;
  visible: boolean;
  rect: Rect;
  strokes: Stroke[];
  erasers: Stroke[];
}

export interface HistorySnapshot {
  layers: Layer[];
  selectedLayerId: string | null;
}

export interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface PresetConfig extends LayerStyle {
  id: PresetId;
  label: string;
  shortDesc: string;
}

export type CanvasSource = HTMLImageElement | HTMLCanvasElement;
