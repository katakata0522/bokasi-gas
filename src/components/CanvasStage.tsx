import React, { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CanvasSource,
  HandleKey,
  Layer,
  Point,
  Rect,
  ToolMode,
  ViewTransform,
} from '../types/editor';
import {
  clientToImagePoint,
  computeFitTransform,
  computeFloatingToolbarPos,
  computeResizedRect,
  getScaledBrushSize,
  hitTestRectHandles,
  isBoxShape,
  isPointInShape,
  shouldAppendStrokePoint,
  zoomAroundPoint,
} from '../core/geometry';
import { CanvasRenderer } from '../core/renderer';
import {
  BoxQuickActions,
  CompareButton,
  EmptyDropOverlay,
  FirstDrawGuide,
  QuickToolDock,
  ZoomHud,
} from './CanvasOverlays';

const DRAG_CREATE_THRESHOLD_PX = 8;
const PINCH_CANCEL_STROKE_WINDOW_MS = 160;

interface GestureState {
  mode:
    | 'none'
    | 'pan'
    | 'pinch'
    | 'pending_create_box'
    | 'create_box'
    | 'move_box'
    | 'resize_box'
    | 'draw_brush'
    | 'draw_eraser';
  boxKind: 'rect' | 'ellipse';
  handle: HandleKey | null;
  startImgX: number;
  startImgY: number;
  startClientX: number;
  startClientY: number;
  startTimeMs: number;
  origRect: Rect | null;
  lastClientX: number;
  lastClientY: number;
  initialPinchDist: number;
  initialScale: number;
  didMutate: boolean;
  preStrokeLayers: Layer[] | null;
  preStrokeSelectedId: string | null;
}

interface CanvasStageProps {
  renderer: CanvasRenderer;
  sourceImage: CanvasSource | null;
  imgWidth: number;
  imgHeight: number;
  layers: Layer[];
  selectedLayerId: string | null;
  activeTool: ToolMode;
  brushSize: number;
  isSliderInteracting: boolean;
  isDragOver: boolean;
  isToastVisible?: boolean;
  onSelectFile: (file: File) => void;
  onLoadDemo: () => void;
  onChangeTool: (tool: ToolMode) => void;
  onMutateLayers: (updater: (prev: Layer[]) => Layer[], selectId?: string | null) => void;
  onSelectLayerOnly: (id: string | null) => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onCommitHistory: () => void;
  onCreateBoxAt: (kind: 'rect' | 'ellipse', rect: Rect) => string;
  onEnsureBrushLayer: () => string;
  onToast: (msg: string) => void;
  zoomActionsRef: React.MutableRefObject<{
    zoomIn: () => void;
    zoomOut: () => void;
    fit: () => void;
  } | null>;
}

export const CanvasStage: React.FC<CanvasStageProps> = ({
  renderer,
  sourceImage,
  imgWidth,
  imgHeight,
  layers,
  selectedLayerId,
  activeTool,
  brushSize,
  isSliderInteracting,
  isDragOver,
  isToastVisible = false,
  onSelectFile,
  onLoadDemo,
  onChangeTool,
  onMutateLayers,
  onSelectLayerOnly,
  onDuplicateSelected,
  onDeleteSelected,
  onCommitHistory,
  onCreateBoxAt,
  onEnsureBrushLayer,
  onToast,
  zoomActionsRef,
}) => {
  const containerRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null);

  const [isComparing, setIsComparing] = useState(false);
  const [showCheckerboard, setShowCheckerboard] = useState(false);
  const [zoomPct, setZoomPct] = useState(100);
  const [loupeVisible, setLoupeVisible] = useState(false);
  const [spacePanning, setSpacePanning] = useState(false);
  const [isManipulating, setIsManipulating] = useState(false);
  const [cursorStyle, setCursorStyle] = useState<string>('default');
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [viewVersion, setViewVersion] = useState(0);

  const viewRef = useRef<ViewTransform>({ scale: 1, offsetX: 0, offsetY: 0 });
  const sizeRef = useRef({ cssW: 0, cssH: 0, dpr: 1 });
  const hoverImgPosRef = useRef<Point | null>(null);
  const rafRef = useRef<number | null>(null);
  const activeLayerTargetRef = useRef<string | null>(null);

  const gestureRef = useRef<GestureState>({
    mode: 'none',
    boxKind: 'rect',
    handle: null,
    startImgX: 0,
    startImgY: 0,
    startClientX: 0,
    startClientY: 0,
    startTimeMs: 0,
    origRect: null,
    lastClientX: 0,
    lastClientY: 0,
    initialPinchDist: 0,
    initialScale: 1,
    didMutate: false,
    preStrokeLayers: null,
    preStrokeSelectedId: null,
  });

  const propsRef = useRef({
    sourceImage,
    imgWidth,
    imgHeight,
    layers,
    selectedLayerId,
    activeTool,
    brushSize,
    isComparing,
    isSliderInteracting,
    spacePanning,
    isManipulating,
    onMutateLayers,
    onSelectLayerOnly,
    onCommitHistory,
    onCreateBoxAt,
    onEnsureBrushLayer,
    onToast,
  });
  propsRef.current = {
    sourceImage,
    imgWidth,
    imgHeight,
    layers,
    selectedLayerId,
    activeTool,
    brushSize,
    isComparing,
    isSliderInteracting,
    spacePanning,
    isManipulating,
    onMutateLayers,
    onSelectLayerOnly,
    onCommitHistory,
    onCreateBoxAt,
    onEnsureBrushLayer,
    onToast,
  };

  const drawNow = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const p = propsRef.current;
    const effectiveTool: ToolMode = p.spacePanning ? 'pan' : p.activeTool;

    renderer.renderMainCanvas({
      canvas,
      dpr: sizeRef.current.dpr,
      cssWidth: sizeRef.current.cssW,
      cssHeight: sizeRef.current.cssH,
      sourceImage: p.sourceImage,
      imgWidth: p.imgWidth,
      imgHeight: p.imgHeight,
      layers: p.layers,
      selectedLayerId: p.selectedLayerId,
      activeTool: effectiveTool,
      brushSize: p.brushSize,
      view: viewRef.current,
      isComparing: p.isComparing,
      hoverImgPos: hoverImgPosRef.current,
      lowResPreview: p.isSliderInteracting,
      isManipulating: p.isManipulating,
    });
  }, [renderer]);

  const scheduleRender = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      drawNow();
    });
  }, [drawNow]);

  // Cancel any pending rAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  const syncCanvasDimensions = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const rect = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const cssW = Math.max(1, Math.round(rect.width));
    const cssH = Math.max(1, Math.round(rect.height));

    const prev = sizeRef.current;
    if (prev.cssW === cssW && prev.cssH === cssH && prev.dpr === dpr) {
      return;
    }

    sizeRef.current = { cssW, cssH, dpr };
    setStageSize((cur) => (cur.w === cssW && cur.h === cssH ? cur : { w: cssW, h: cssH }));
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    scheduleRender();
  }, [scheduleRender]);

  const fitToScreen = useCallback(() => {
    const p = propsRef.current;
    if (!p.sourceImage) return;
    const { cssW, cssH } = sizeRef.current;
    if (!cssW || !cssH) return;
    viewRef.current = computeFitTransform(cssW, cssH - 44, p.imgWidth, p.imgHeight, 26);
    viewRef.current = {
      ...viewRef.current,
      offsetY: Math.max(20, viewRef.current.offsetY - 8),
    };
    setZoomPct(Math.round(viewRef.current.scale * 100));
    setViewVersion((v) => v + 1);
    scheduleRender();
  }, [scheduleRender]);

  const zoomAtCenter = useCallback(
    (factor: number) => {
      if (!propsRef.current.sourceImage) return;
      const { cssW, cssH } = sizeRef.current;
      viewRef.current = zoomAroundPoint(viewRef.current, cssW / 2, cssH / 2, factor);
      setZoomPct(Math.round(viewRef.current.scale * 100));
      setViewVersion((v) => v + 1);
      scheduleRender();
    },
    [scheduleRender]
  );

  useEffect(() => {
    zoomActionsRef.current = {
      zoomIn: () => zoomAtCenter(1.2),
      zoomOut: () => zoomAtCenter(0.83),
      fit: fitToScreen,
    };
    return () => {
      zoomActionsRef.current = null;
    };
  }, [zoomActionsRef, zoomAtCenter, fitToScreen]);

  useEffect(() => {
    syncCanvasDimensions();
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => syncCanvasDimensions());
    ro.observe(container);
    return () => ro.disconnect();
  }, [syncCanvasDimensions]);

  useEffect(() => {
    if (sourceImage) {
      syncCanvasDimensions();
      requestAnimationFrame(() => fitToScreen());
    } else {
      scheduleRender();
    }
  }, [sourceImage, imgWidth, imgHeight, syncCanvasDimensions, fitToScreen, scheduleRender]);

  useEffect(() => {
    scheduleRender();
  }, [
    layers,
    selectedLayerId,
    activeTool,
    brushSize,
    isComparing,
    isSliderInteracting,
    spacePanning,
    isManipulating,
    scheduleRender,
  ]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      const tag = (document.activeElement?.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;
      if (!propsRef.current.sourceImage) return;
      e.preventDefault();
      setSpacePanning(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpacePanning(false);
    };
    const onBlur = () => setSpacePanning(false);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useEffect(() => {
    if (!isComparing) return;
    const stop = () => setIsComparing(false);
    window.addEventListener('mouseup', stop);
    window.addEventListener('touchend', stop);
    window.addEventListener('touchcancel', stop);
    return () => {
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('touchend', stop);
      window.removeEventListener('touchcancel', stop);
    };
  }, [isComparing]);

  const updateLoupe = useCallback(
    (imgX: number, imgY: number, currentLayers?: Layer[]) => {
      const p = propsRef.current;
      const loupeCanvas = loupeCanvasRef.current;
      if (!p.sourceImage || !loupeCanvas) return;
      setLoupeVisible(true);
      renderer.renderLoupe({
        loupeCanvas,
        sourceImage: p.sourceImage,
        imgWidth: p.imgWidth,
        imgHeight: p.imgHeight,
        layers: currentLayers || p.layers,
        imgX,
        imgY,
        brushSize: p.brushSize,
        activeTool: p.activeTool,
      });
    },
    [renderer]
  );

  const getImagePoint = useCallback((clientX: number, clientY: number): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return clientToImagePoint(clientX, clientY, rect.left, rect.top, viewRef.current);
  }, []);

  const updateHoverCursor = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      const p = propsRef.current;
      if (!canvas || !p.sourceImage) return;

      const rect = canvas.getBoundingClientRect();
      const inside =
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom;
      if (!inside) {
        if (hoverImgPosRef.current) {
          hoverImgPosRef.current = null;
          scheduleRender();
        }
        return;
      }

      const pt = clientToImagePoint(clientX, clientY, rect.left, rect.top, viewRef.current);
      hoverImgPosRef.current = pt;

      const effectiveTool: ToolMode = p.spacePanning ? 'pan' : p.activeTool;
      if (effectiveTool === 'pan') {
        setCursorStyle('grab');
        return;
      }
      if (effectiveTool === 'brush' || effectiveTool === 'eraser') {
        setCursorStyle('none');
        scheduleRender();
        return;
      }

      const sel = p.layers.find((l) => l.id === p.selectedLayerId) || null;
      if (sel && sel.visible && isBoxShape(sel.shapeType)) {
        const hnd = hitTestRectHandles(sel.rect, pt.x, pt.y, viewRef.current.scale);
        if (hnd) {
          setCursorStyle(`${hnd}-resize`);
          return;
        }
        if (isPointInShape(pt.x, pt.y, sel.shapeType, sel.rect)) {
          setCursorStyle('move');
          return;
        }
      }
      setCursorStyle('crosshair');
    },
    [scheduleRender]
  );

  const startSinglePointer = useCallback(
    (clientX: number, clientY: number) => {
      const p = propsRef.current;
      if (!p.sourceImage) return;

      const pt = getImagePoint(clientX, clientY);
      const g = gestureRef.current;
      g.startImgX = pt.x;
      g.startImgY = pt.y;
      g.startClientX = clientX;
      g.startClientY = clientY;
      g.startTimeMs = performance.now();
      g.lastClientX = clientX;
      g.lastClientY = clientY;
      g.didMutate = false;
      g.preStrokeLayers = null;
      g.preStrokeSelectedId = null;
      hoverImgPosRef.current = pt;

      const effectiveTool: ToolMode = p.spacePanning ? 'pan' : p.activeTool;

      if (effectiveTool === 'pan') {
        g.mode = 'pan';
        setIsManipulating(true);
        setCursorStyle('grabbing');
        return;
      }

      const sel = p.layers.find((l) => l.id === p.selectedLayerId) || null;

      if (effectiveTool === 'rect' || effectiveTool === 'ellipse') {
        if (sel && sel.visible && isBoxShape(sel.shapeType)) {
          const hitHandle = hitTestRectHandles(sel.rect, pt.x, pt.y, viewRef.current.scale);
          if (hitHandle) {
            g.mode = 'resize_box';
            g.handle = hitHandle;
            g.origRect = { ...sel.rect };
            g.didMutate = true;
            activeLayerTargetRef.current = sel.id;
            setIsManipulating(true);
            return;
          }
        }

        for (let i = p.layers.length - 1; i >= 0; i--) {
          const l = p.layers[i];
          if (l.visible && isBoxShape(l.shapeType) && isPointInShape(pt.x, pt.y, l.shapeType, l.rect)) {
            p.onSelectLayerOnly(l.id);
            g.mode = 'move_box';
            g.origRect = { ...l.rect };
            g.didMutate = true;
            activeLayerTargetRef.current = l.id;
            setIsManipulating(true);
            return;
          }
        }

        g.mode = 'pending_create_box';
        g.boxKind = effectiveTool;
        return;
      }

      if (effectiveTool === 'brush') {
        // Snapshot pre-stroke state so a fast 2-finger pinch-zoom can cancel an accidental 1-dot tap
        g.preStrokeLayers = p.layers;
        g.preStrokeSelectedId = p.selectedLayerId;

        const targetId =
          sel && (sel.shapeType === 'brush' || sel.shapeType === 'full')
            ? sel.id
            : p.onEnsureBrushLayer();
        activeLayerTargetRef.current = targetId;
        const scaledSize = getScaledBrushSize(p.brushSize, p.imgWidth, p.imgHeight);
        const newStroke = { size: scaledSize, points: [{ x: pt.x, y: pt.y }] };

        p.onMutateLayers((prev) =>
          prev.map((l) =>
            l.id === targetId ? { ...l, visible: true, strokes: [...l.strokes, newStroke] } : l
          )
        );
        g.mode = 'draw_brush';
        g.didMutate = true;
        setIsManipulating(true);
        // Compute immediate preview layers for synchronous loupe update
        const immediateLayers = propsRef.current.layers.map((l) =>
          l.id === targetId ? { ...l, visible: true, strokes: [...l.strokes, newStroke] } : l
        );
        updateLoupe(pt.x, pt.y, immediateLayers);
        return;
      }

      if (effectiveTool === 'eraser') {
        const targetLayer = sel || p.layers[p.layers.length - 1] || null;
        if (!targetLayer) {
          p.onToast('先にぼかしを描いてから消しゴムを使ってください');
          return;
        }
        g.preStrokeLayers = p.layers;
        g.preStrokeSelectedId = p.selectedLayerId;

        if (!sel) p.onSelectLayerOnly(targetLayer.id);
        activeLayerTargetRef.current = targetLayer.id;
        const scaledSize = getScaledBrushSize(p.brushSize, p.imgWidth, p.imgHeight);
        const newEraser = { size: scaledSize, points: [{ x: pt.x, y: pt.y }] };

        p.onMutateLayers((prev) =>
          prev.map((l) =>
            l.id === targetLayer.id ? { ...l, erasers: [...l.erasers, newEraser] } : l
          )
        );
        g.mode = 'draw_eraser';
        g.didMutate = true;
        setIsManipulating(true);
        const immediateLayers = propsRef.current.layers.map((l) =>
          l.id === targetLayer.id ? { ...l, erasers: [...l.erasers, newEraser] } : l
        );
        updateLoupe(pt.x, pt.y, immediateLayers);
      }
    },
    [getImagePoint, updateLoupe]
  );

  const moveSinglePointer = useCallback(
    (clientX: number, clientY: number) => {
      const p = propsRef.current;
      if (!p.sourceImage) return;
      const g = gestureRef.current;
      const pt = getImagePoint(clientX, clientY);
      hoverImgPosRef.current = pt;

      if (g.mode === 'pan') {
        viewRef.current = {
          ...viewRef.current,
          offsetX: viewRef.current.offsetX + (clientX - g.lastClientX),
          offsetY: viewRef.current.offsetY + (clientY - g.lastClientY),
        };
        g.lastClientX = clientX;
        g.lastClientY = clientY;
        setViewVersion((v) => v + 1);
        scheduleRender();
        return;
      }

      if (g.mode === 'pending_create_box') {
        const dist = Math.hypot(clientX - g.startClientX, clientY - g.startClientY);
        if (dist < DRAG_CREATE_THRESHOLD_PX) return;
        const newId = p.onCreateBoxAt(g.boxKind, {
          x: g.startImgX,
          y: g.startImgY,
          w: 20,
          h: 20,
        });
        activeLayerTargetRef.current = newId;
        g.mode = 'create_box';
        g.didMutate = true;
        setIsManipulating(true);
      }

      const targetId = activeLayerTargetRef.current || p.selectedLayerId;
      if (!targetId) return;

      if (g.mode === 'create_box') {
        const nextRect: Rect = {
          x: Math.min(g.startImgX, pt.x),
          y: Math.min(g.startImgY, pt.y),
          w: Math.max(20, Math.abs(pt.x - g.startImgX)),
          h: Math.max(20, Math.abs(pt.y - g.startImgY)),
        };
        p.onMutateLayers((prev) =>
          prev.map((l) => (l.id === targetId ? { ...l, rect: nextRect } : l))
        );
        return;
      }

      if (g.mode === 'move_box' && g.origRect) {
        const nextRect: Rect = {
          ...g.origRect,
          x: g.origRect.x + (pt.x - g.startImgX),
          y: g.origRect.y + (pt.y - g.startImgY),
        };
        p.onMutateLayers((prev) =>
          prev.map((l) => (l.id === targetId ? { ...l, rect: nextRect } : l))
        );
        return;
      }

      if (g.mode === 'resize_box' && g.origRect && g.handle) {
        const nextRect = computeResizedRect(g.origRect, g.handle, pt);
        p.onMutateLayers((prev) =>
          prev.map((l) => (l.id === targetId ? { ...l, rect: nextRect } : l))
        );
        return;
      }

      if (g.mode === 'draw_brush') {
        const minDist = Math.max(2, 2.5 / Math.max(viewRef.current.scale, 0.3));
        const nextLayers = p.layers.map((l) => {
          if (l.id !== targetId || l.strokes.length === 0) return l;
          const lastStroke = l.strokes[l.strokes.length - 1];
          if (!shouldAppendStrokePoint(lastStroke.points, pt, minDist)) return l;
          const updatedStrokes = l.strokes.slice(0, -1);
          updatedStrokes.push({
            ...lastStroke,
            points: [...lastStroke.points, { x: pt.x, y: pt.y }],
          });
          return { ...l, strokes: updatedStrokes };
        });
        p.onMutateLayers((prev) =>
          prev.map((l) => {
            if (l.id !== targetId || l.strokes.length === 0) return l;
            const lastStroke = l.strokes[l.strokes.length - 1];
            if (!shouldAppendStrokePoint(lastStroke.points, pt, minDist)) return l;
            const updatedStrokes = l.strokes.slice(0, -1);
            updatedStrokes.push({
              ...lastStroke,
              points: [...lastStroke.points, { x: pt.x, y: pt.y }],
            });
            return { ...l, strokes: updatedStrokes };
          })
        );
        updateLoupe(pt.x, pt.y, nextLayers);
        return;
      }

      if (g.mode === 'draw_eraser') {
        const minDist = Math.max(2, 2.5 / Math.max(viewRef.current.scale, 0.3));
        const nextLayers = p.layers.map((l) => {
          if (l.id !== targetId || l.erasers.length === 0) return l;
          const lastEraser = l.erasers[l.erasers.length - 1];
          if (!shouldAppendStrokePoint(lastEraser.points, pt, minDist)) return l;
          const updatedErasers = l.erasers.slice(0, -1);
          updatedErasers.push({
            ...lastEraser,
            points: [...lastEraser.points, { x: pt.x, y: pt.y }],
          });
          return { ...l, erasers: updatedErasers };
        });
        p.onMutateLayers((prev) =>
          prev.map((l) => {
            if (l.id !== targetId || l.erasers.length === 0) return l;
            const lastEraser = l.erasers[l.erasers.length - 1];
            if (!shouldAppendStrokePoint(lastEraser.points, pt, minDist)) return l;
            const updatedErasers = l.erasers.slice(0, -1);
            updatedErasers.push({
              ...lastEraser,
              points: [...lastEraser.points, { x: pt.x, y: pt.y }],
            });
            return { ...l, erasers: updatedErasers };
          })
        );
        updateLoupe(pt.x, pt.y, nextLayers);
      }
    },
    [getImagePoint, scheduleRender, updateLoupe]
  );

  const endSinglePointer = useCallback(() => {
    const g = gestureRef.current;
    const p = propsRef.current;

    if (g.mode === 'pending_create_box' && p.selectedLayerId) {
      p.onSelectLayerOnly(null);
    }

    if (g.didMutate) {
      p.onCommitHistory();
    }
    g.mode = 'none';
    g.handle = null;
    g.didMutate = false;
    g.preStrokeLayers = null;
    g.preStrokeSelectedId = null;
    activeLayerTargetRef.current = null;
    setIsManipulating(false);
    setLoupeVisible(false);
    if (p.spacePanning || p.activeTool === 'pan') {
      setCursorStyle('grab');
    }
    scheduleRender();
  }, [scheduleRender]);

  // Register window mouse listeners once per mount (callbacks are stable)
  useEffect(() => {
    const onWinMouseMove = (e: MouseEvent) => {
      if (!propsRef.current.sourceImage) return;
      if (gestureRef.current.mode === 'none') {
        updateHoverCursor(e.clientX, e.clientY);
      } else {
        moveSinglePointer(e.clientX, e.clientY);
      }
    };
    const onWinMouseUp = () => {
      if (gestureRef.current.mode !== 'none') {
        endSinglePointer();
      }
    };
    window.addEventListener('mousemove', onWinMouseMove);
    window.addEventListener('mouseup', onWinMouseUp);
    return () => {
      window.removeEventListener('mousemove', onWinMouseMove);
      window.removeEventListener('mouseup', onWinMouseUp);
    };
  }, [updateHoverCursor, moveSinglePointer, endSinglePointer]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      if (!propsRef.current.sourceImage) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      viewRef.current = zoomAroundPoint(viewRef.current, cx, cy, factor);
      setZoomPct(Math.round(viewRef.current.scale * 100));
      setViewVersion((v) => v + 1);
      scheduleRender();
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [scheduleRender]);

  // Register touch listeners once per mount, including touchcancel & pinch phantom-dot recovery
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onTouchStart = (e: TouchEvent) => {
      const p = propsRef.current;
      if (!p.sourceImage) return;
      e.preventDefault();
      if (e.touches.length === 2) {
        setLoupeVisible(false);
        const g = gestureRef.current;
        // If finger #2 landed shortly after finger #1 started a brush/eraser dot, revert the accidental dot
        if (
          (g.mode === 'draw_brush' || g.mode === 'draw_eraser') &&
          g.preStrokeLayers &&
          performance.now() - g.startTimeMs <= PINCH_CANCEL_STROKE_WINDOW_MS
        ) {
          const rollbackLayers = g.preStrokeLayers;
          const rollbackSelected = g.preStrokeSelectedId;
          p.onMutateLayers(() => rollbackLayers, rollbackSelected);
          g.didMutate = false;
        } else if (g.mode === 'pending_create_box') {
          g.didMutate = false;
        }
        g.preStrokeLayers = null;
        g.preStrokeSelectedId = null;

        const [t1, t2] = [e.touches[0], e.touches[1]];
        g.mode = 'pinch';
        g.initialPinchDist = Math.max(1, Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY));
        g.initialScale = viewRef.current.scale;
        g.lastClientX = (t1.clientX + t2.clientX) / 2;
        g.lastClientY = (t1.clientY + t2.clientY) / 2;
        setIsManipulating(true);
        return;
      }
      if (e.touches.length === 1) {
        startSinglePointer(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!propsRef.current.sourceImage) return;
      e.preventDefault();
      const g = gestureRef.current;
      if (e.touches.length === 2 && g.mode === 'pinch') {
        const [t1, t2] = [e.touches[0], e.touches[1]];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;

        const translated: ViewTransform = {
          ...viewRef.current,
          offsetX: viewRef.current.offsetX + (midX - g.lastClientX),
          offsetY: viewRef.current.offsetY + (midY - g.lastClientY),
        };
        const rect = canvas.getBoundingClientRect();
        const factor = (g.initialScale * (dist / g.initialPinchDist)) / translated.scale;
        viewRef.current = zoomAroundPoint(translated, midX - rect.left, midY - rect.top, factor);
        g.lastClientX = midX;
        g.lastClientY = midY;
        setZoomPct(Math.round(viewRef.current.scale * 100));
        setViewVersion((v) => v + 1);
        scheduleRender();
        return;
      }
      if (e.touches.length === 1 && g.mode !== 'pinch') {
        moveSinglePointer(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const onTouchEndOrCancel = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        hoverImgPosRef.current = null;
        endSinglePointer();
      }
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEndOrCancel);
    canvas.addEventListener('touchcancel', onTouchEndOrCancel);
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEndOrCancel);
      canvas.removeEventListener('touchcancel', onTouchEndOrCancel);
    };
  }, [startSinglePointer, moveSinglePointer, endSinglePointer, scheduleRender]);

  const selectedBox =
    sourceImage &&
    !isComparing &&
    !isManipulating &&
    (activeTool === 'rect' || activeTool === 'ellipse')
      ? layers.find((l) => l.id === selectedLayerId && l.visible && isBoxShape(l.shapeType)) || null
      : null;

  const floatingActionPos =
    selectedBox && stageSize.w > 0 && viewVersion >= 0
      ? computeFloatingToolbarPos(selectedBox.rect, viewRef.current, stageSize.w, stageSize.h)
      : null;

  return (
    <main
      ref={containerRef}
      data-testid="canvas-stage"
      className={`relative flex-1 min-h-0 w-full overflow-hidden flex items-center justify-center ${
        showCheckerboard ? 'checkerboard-subtle' : 'studio-backdrop'
      }`}
    >
      <canvas
        ref={canvasRef}
        id="mainCanvas"
        data-testid="main-canvas"
        onMouseDown={(e) => {
          if (e.button === 0) startSinglePointer(e.clientX, e.clientY);
        }}
        onMouseLeave={() => {
          if (hoverImgPosRef.current) {
            hoverImgPosRef.current = null;
            scheduleRender();
          }
        }}
        style={{ cursor: sourceImage ? cursorStyle : 'default', touchAction: 'none' }}
        className="block w-full h-full"
      />

      {isDragOver && (
        <div className="pointer-events-none absolute inset-3 rounded-2xl border-2 border-dashed border-blue-500 bg-blue-500/10 backdrop-blur-[1px] z-30 flex items-center justify-center">
          <div className="px-4 py-2 rounded-xl bg-white shadow-md border border-blue-200 text-xs font-semibold text-blue-700">
            ドロップして画像を読み込む
          </div>
        </div>
      )}

      {!sourceImage && (
        <EmptyDropOverlay
          isDragOver={isDragOver}
          onSelectFile={onSelectFile}
          onLoadDemo={onLoadDemo}
        />
      )}

      {sourceImage && layers.length === 0 && !isManipulating && !isToastVisible && (
        <FirstDrawGuide activeTool={activeTool} />
      )}

      {sourceImage && layers.length > 0 && (
        <CompareButton isComparing={isComparing} onStartCompare={() => setIsComparing(true)} />
      )}

      {selectedBox && floatingActionPos && (
        <BoxQuickActions
          pos={floatingActionPos}
          onDuplicate={onDuplicateSelected}
          onDelete={onDeleteSelected}
          onDone={() => onSelectLayerOnly(null)}
        />
      )}

      {sourceImage && (
        <QuickToolDock
          activeTool={activeTool}
          spacePanning={spacePanning}
          onChangeTool={onChangeTool}
        />
      )}

      {sourceImage && (
        <ZoomHud
          zoomPct={zoomPct}
          showCheckerboard={showCheckerboard}
          onZoomOut={() => zoomAtCenter(0.83)}
          onZoomIn={() => zoomAtCenter(1.2)}
          onFit={fitToScreen}
          onToggleCheckerboard={() => setShowCheckerboard((prev) => !prev)}
        />
      )}

      {/* Real-time 2.2x Loupe */}
      <div
        className={`${
          loupeVisible ? 'block' : 'hidden'
        } pointer-events-none absolute top-3 left-3 w-28 h-28 rounded-xl border-2 border-blue-600 shadow-lg overflow-hidden bg-white z-20`}
      >
        <canvas ref={loupeCanvasRef} width={112} height={112} className="w-full h-full" />
        <div className="absolute bottom-1 right-1 text-[9px] font-mono font-semibold text-white bg-slate-900/80 px-1.5 py-0.5 rounded">
          2.2x
        </div>
      </div>
    </main>
  );
};
