import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  BlurType,
  CanvasSource,
  ExportFormat,
  Layer,
  LayerStyle,
  PresetId,
  Rect,
  ShapeType,
  ToolMode,
} from './types/editor';
import {
  applyPresetToLayer,
  DEFAULT_LAYER_STYLE,
  isSolidBlurType,
  PRESETS_BY_ID,
  presetToStyle,
} from './core/presets';
import { isBoxShape, reorderLayer } from './core/geometry';
import {
  canRedo,
  canUndo,
  createInitialHistory,
  HistoryState,
  pushHistoryState,
  stepRedo,
  stepUndo,
} from './core/history';
import { CanvasRenderer, createDemoScreenshotCanvas } from './core/renderer';
import { buildExportFilename, decodeImageFile } from './core/fileLoader';
import { Header } from './components/Header';
import { CanvasStage } from './components/CanvasStage';
import { Sidebar } from './components/Sidebar';
import { ConfirmModal, HelpModal, SnsPreviewModal } from './components/Modals';
import { Toast } from './components/Toast';

function getPreferredDefaultTool(): ToolMode {
  if (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches) {
    return 'brush';
  }
  return 'rect';
}

export function App() {
  const renderer = useMemo(() => new CanvasRenderer(), []);

  const [sourceImage, setSourceImage] = useState<CanvasSource | null>(null);
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolMode>(getPreferredDefaultTool);
  const [activeStyle, setActiveStyle] = useState<LayerStyle>(DEFAULT_LAYER_STYLE);
  const [brushSize, setBrushSize] = useState<number>(38);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('image/png');
  const [history, setHistory] = useState<HistoryState>(createInitialHistory);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSliderInteracting, setIsSliderInteracting] = useState(false);

  const [helpOpen, setHelpOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [pendingReplaceFile, setPendingReplaceFile] = useState<File | null>(null);
  const [snsPreviewUrl, setSnsPreviewUrl] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const layerCounterRef = useRef(1);
  const toastTimerRef = useRef<number | null>(null);
  const arrowCommitTimerRef = useRef<number | null>(null);
  const badgeCommitTimerRef = useRef<number | null>(null);
  const dragDepthRef = useRef(0);
  const zoomActionsRef = useRef<{
    zoomIn: () => void;
    zoomOut: () => void;
    fit: () => void;
  } | null>(null);

  const layersRef = useRef(layers);
  const selectedIdRef = useRef(selectedLayerId);
  const sourceImageRef = useRef(sourceImage);
  const hasUnsavedRef = useRef(hasUnsavedChanges);
  const activeStyleRef = useRef(activeStyle);
  const sliderDirtyRef = useRef(false);
  const isModalOpenRef = useRef(false);

  layersRef.current = layers;
  selectedIdRef.current = selectedLayerId;
  sourceImageRef.current = sourceImage;
  hasUnsavedRef.current = hasUnsavedChanges;
  activeStyleRef.current = activeStyle;
  isModalOpenRef.current =
    helpOpen || clearConfirmOpen || Boolean(pendingReplaceFile) || Boolean(snsPreviewUrl);

  const clearPendingCommitTimers = useCallback(() => {
    if (arrowCommitTimerRef.current !== null) {
      window.clearTimeout(arrowCommitTimerRef.current);
      arrowCommitTimerRef.current = null;
    }
    if (badgeCommitTimerRef.current !== null) {
      window.clearTimeout(badgeCommitTimerRef.current);
      badgeCommitTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearPendingCommitTimers();
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, [clearPendingCommitTimers]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMsg(null);
      toastTimerRef.current = null;
    }, 2400);
  }, []);

  const commitHistorySnapshot = useCallback(
    (nextLayers: Layer[], nextSelectedId: string | null, markUnsaved = true) => {
      setHistory((prev) => pushHistoryState(prev, nextLayers, nextSelectedId));
      if (markUnsaved) setHasUnsavedChanges(true);
    },
    []
  );

  const createLayerWithActiveStyle = useCallback(
    (
      shapeType: ShapeType,
      customRect?: Rect,
      imgW = imgSize.width,
      imgH = imgSize.height
    ): Layer => {
      const style = activeStyleRef.current;
      const labelMap: Record<ShapeType, string> = {
        rect: '四角 #',
        ellipse: '丸 #',
        full: '全体 #',
        brush: 'ブラシ #',
      };
      const defaultW = Math.max(80, Math.round(imgW * 0.45));
      const defaultH = Math.max(50, Math.round(imgH * 0.16));

      return {
        id: `layer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: `${labelMap[shapeType]}${layerCounterRef.current++}`,
        shapeType,
        blurType: style.blurType,
        strength: style.strength,
        opacity: style.opacity,
        feather: style.feather,
        borderRadius: style.borderRadius,
        badge: '',
        visible: true,
        rect: customRect || {
          x: Math.round((imgW - defaultW) / 2),
          y: Math.round((imgH - defaultH) / 2),
          w: defaultW,
          h: defaultH,
        },
        strokes: [],
        erasers: [],
      };
    },
    [imgSize.width, imgSize.height]
  );

  // Start clean with 0 layers so the user sees their image directly and draws blurs themselves
  const applyLoadedSource = useCallback(
    (source: CanvasSource, width: number, height: number, isDemo: boolean, wasResized = false) => {
      clearPendingCommitTimers();
      sliderDirtyRef.current = false;
      setIsSliderInteracting(false);
      renderer.clearCaches();
      layerCounterRef.current = 1;
      setSourceImage(source);
      setImgSize({ width, height });
      setLayers([]);
      setSelectedLayerId(null);
      setActiveTool(getPreferredDefaultTool());
      setHistory(pushHistoryState(createInitialHistory(), [], null));
      setHasUnsavedChanges(false);

      if (isDemo) {
        showToast('サンプル画像を読み込みました');
      } else if (wasResized) {
        showToast('高解像度画像を最適サイズにリサイズして読み込みました');
      } else {
        showToast('画像を読み込みました');
      }
    },
    [clearPendingCommitTimers, renderer, showToast]
  );

  const loadFileDirectly = useCallback(
    async (file: File) => {
      try {
        const result = await decodeImageFile(file);
        applyLoadedSource(result.source, result.width, result.height, false, result.wasResized);
      } catch (err) {
        showToast(err instanceof Error ? err.message : '画像の読み込みに失敗しました');
      }
    },
    [applyLoadedSource, showToast]
  );

  const handleIncomingFile = useCallback(
    (file: File) => {
      if (sourceImageRef.current && hasUnsavedRef.current) {
        setPendingReplaceFile(file);
        return;
      }
      void loadFileDirectly(file);
    },
    [loadFileDirectly]
  );

  const handleLoadDemo = useCallback(() => {
    const demoCanvas = createDemoScreenshotCanvas();
    applyLoadedSource(demoCanvas, demoCanvas.width, demoCanvas.height, true);
  }, [applyLoadedSource]);

  const handleClearAll = useCallback(() => {
    clearPendingCommitTimers();
    sliderDirtyRef.current = false;
    setIsSliderInteracting(false);
    renderer.clearCaches();
    setSourceImage(null);
    setImgSize({ width: 0, height: 0 });
    setLayers([]);
    setSelectedLayerId(null);
    setHistory(createInitialHistory());
    setHasUnsavedChanges(false);
    setClearConfirmOpen(false);
    showToast('画像とぼかし設定を一括クリアしました');
  }, [clearPendingCommitTimers, renderer, showToast]);

  const syncActiveStyleFromLayer = useCallback((target: Layer | undefined) => {
    if (!target) return;
    setActiveStyle({
      blurType: target.blurType,
      strength: target.strength,
      opacity: target.opacity,
      feather: target.feather,
      borderRadius: target.borderRadius,
    });
  }, []);

  const handleUndo = useCallback(() => {
    clearPendingCommitTimers();
    const res = stepUndo(history);
    if (!res) return;
    setHistory(res.history);
    setLayers(res.snapshot.layers);
    setSelectedLayerId(res.snapshot.selectedLayerId);
    syncActiveStyleFromLayer(
      res.snapshot.layers.find((l) => l.id === res.snapshot.selectedLayerId)
    );
    showToast('1つ前の状態に戻しました');
  }, [clearPendingCommitTimers, history, syncActiveStyleFromLayer, showToast]);

  const handleRedo = useCallback(() => {
    clearPendingCommitTimers();
    const res = stepRedo(history);
    if (!res) return;
    setHistory(res.history);
    setLayers(res.snapshot.layers);
    setSelectedLayerId(res.snapshot.selectedLayerId);
    syncActiveStyleFromLayer(
      res.snapshot.layers.find((l) => l.id === res.snapshot.selectedLayerId)
    );
    showToast('操作をやり直しました');
  }, [clearPendingCommitTimers, history, syncActiveStyleFromLayer, showToast]);

  const handleAddFullLayer = useCallback(() => {
    if (!sourceImage) return;
    const newLayer = createLayerWithActiveStyle('full');
    const nextLayers = [...layers, newLayer];
    setLayers(nextLayers);
    setSelectedLayerId(newLayer.id);
    setActiveTool('eraser');
    commitHistorySnapshot(nextLayers, newLayer.id);
    showToast('全体ぼかしを追加（消すで見せたい部分を抜けます）');
  }, [sourceImage, createLayerWithActiveStyle, layers, commitHistorySnapshot, showToast]);

  const handleSelectLayer = useCallback(
    (id: string | null) => {
      setSelectedLayerId(id);
      if (id) {
        syncActiveStyleFromLayer(layersRef.current.find((l) => l.id === id));
      }
    },
    [syncActiveStyleFromLayer]
  );

  // Selecting a layer from the Layers list also switches tool so handles/controls immediately appear
  const handleSelectLayerFromList = useCallback(
    (id: string | null) => {
      setSelectedLayerId(id);
      if (!id) return;
      const target = layersRef.current.find((l) => l.id === id);
      if (!target) return;
      syncActiveStyleFromLayer(target);
      if (target.shapeType === 'rect') {
        setActiveTool('rect');
      } else if (target.shapeType === 'ellipse') {
        setActiveTool('ellipse');
      } else if (target.shapeType === 'brush') {
        setActiveTool('brush');
      } else if (target.shapeType === 'full') {
        setActiveTool((prev) => (prev === 'brush' || prev === 'eraser' ? prev : 'eraser'));
      }
    },
    [syncActiveStyleFromLayer]
  );

  const handleChangeTool = useCallback(
    (nextTool: ToolMode) => {
      setActiveTool(nextTool);
      // When switching to a different drawing/pan tool, finalize the currently selected box so
      // any preset/slider adjustment configures the *next* blur instead of overwriting the previous one.
      if (nextTool !== activeTool && nextTool !== 'eraser' && selectedIdRef.current) {
        setSelectedLayerId(null);
      }
    },
    [activeTool]
  );

  const handleToggleVisibility = useCallback(
    (id: string) => {
      const next = layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l));
      setLayers(next);
      commitHistorySnapshot(next, selectedLayerId);
    },
    [layers, selectedLayerId, commitHistorySnapshot]
  );

  const handleReorderLayer = useCallback(
    (id: string, direction: 'up' | 'down') => {
      const next = reorderLayer(layers, id, direction);
      if (next === layers) return;
      setLayers(next);
      commitHistorySnapshot(next, selectedLayerId);
    },
    [layers, selectedLayerId, commitHistorySnapshot]
  );

  const handleDuplicateLayer = useCallback(() => {
    const sel = layers.find((l) => l.id === selectedLayerId);
    if (!sel) return;
    const offset = Math.round(Math.min(imgSize.width, imgSize.height) * 0.04);
    const copy: Layer = {
      ...sel,
      id: `layer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `${sel.name} コピー`,
      rect: {
        x: sel.rect.x + offset,
        y: sel.rect.y + offset,
        w: sel.rect.w,
        h: sel.rect.h,
      },
      strokes: sel.strokes.map((s) => ({
        size: s.size,
        points: s.points.map((p) => ({ x: p.x + offset, y: p.y + offset })),
      })),
      erasers: sel.erasers.map((e) => ({
        size: e.size,
        points: e.points.map((p) => ({ x: p.x + offset, y: p.y + offset })),
      })),
    };
    const next = [...layers, copy];
    setLayers(next);
    setSelectedLayerId(copy.id);
    commitHistorySnapshot(next, copy.id);
    showToast('レイヤーを複製しました');
  }, [layers, selectedLayerId, imgSize.width, imgSize.height, commitHistorySnapshot, showToast]);

  const handleDeleteLayer = useCallback(() => {
    const sel = layers.find((l) => l.id === selectedLayerId);
    if (!sel) return;
    const next = layers.filter((l) => l.id !== sel.id);
    setLayers(next);
    setSelectedLayerId(null);
    commitHistorySnapshot(next, null);
    showToast('レイヤーを削除しました');
  }, [layers, selectedLayerId, commitHistorySnapshot, showToast]);

  const handleApplyPreset = useCallback(
    (presetId: PresetId) => {
      if (!sourceImage) return;
      const nextStyle = presetToStyle(presetId);
      setActiveStyle(nextStyle);

      if (selectedLayerId && layers.some((l) => l.id === selectedLayerId)) {
        const targetLayers = layers.map((l) =>
          l.id === selectedLayerId ? applyPresetToLayer(l, presetId) : l
        );
        setLayers(targetLayers);
        commitHistorySnapshot(targetLayers, selectedLayerId);
      }
      showToast(`「${PRESETS_BY_ID[presetId].label}」を設定しました`);
    },
    [sourceImage, layers, selectedLayerId, commitHistorySnapshot, showToast]
  );

  const handleChangeBlurType = useCallback(
    (blurType: BlurType) => {
      const solidOpacity = isSolidBlurType(blurType) ? 1 : undefined;
      setActiveStyle((prev) => ({
        ...prev,
        blurType,
        opacity: solidOpacity ?? prev.opacity,
      }));
      if (!selectedLayerId) return;
      const next = layers.map((l) =>
        l.id === selectedLayerId
          ? {
              ...l,
              blurType,
              opacity: solidOpacity ?? l.opacity,
            }
          : l
      );
      setLayers(next);
      commitHistorySnapshot(next, selectedLayerId);
    },
    [layers, selectedLayerId, commitHistorySnapshot]
  );

  const handleSliderInput = useCallback(
    (patch: Partial<LayerStyle>) => {
      setActiveStyle((prev) => ({ ...prev, ...patch }));
      if (!selectedLayerId) return;
      sliderDirtyRef.current = true;
      if (patch.strength !== undefined) setIsSliderInteracting(true);
      setLayers((prev) =>
        prev.map((l) => (l.id === selectedLayerId ? { ...l, ...patch } : l))
      );
    },
    [selectedLayerId]
  );

  const handleSliderCommit = useCallback(() => {
    setIsSliderInteracting(false);
    if (sliderDirtyRef.current && selectedIdRef.current) {
      sliderDirtyRef.current = false;
      commitHistorySnapshot(layersRef.current, selectedIdRef.current);
    } else {
      sliderDirtyRef.current = false;
    }
  }, [commitHistorySnapshot]);

  // Guarantee slider low-res preview exits and history commits even if pointer is released outside input
  useEffect(() => {
    const onGlobalRelease = () => {
      if (sliderDirtyRef.current) {
        handleSliderCommit();
      }
    };
    window.addEventListener('pointerup', onGlobalRelease);
    window.addEventListener('pointercancel', onGlobalRelease);
    return () => {
      window.removeEventListener('pointerup', onGlobalRelease);
      window.removeEventListener('pointercancel', onGlobalRelease);
    };
  }, [handleSliderCommit]);

  const handleChangeBadge = useCallback(
    (badge: string) => {
      if (!selectedLayerId) return;
      const next = layers.map((l) => (l.id === selectedLayerId ? { ...l, badge } : l));
      setLayers(next);
      if (badgeCommitTimerRef.current !== null) {
        window.clearTimeout(badgeCommitTimerRef.current);
      }
      badgeCommitTimerRef.current = window.setTimeout(() => {
        commitHistorySnapshot(layersRef.current, selectedIdRef.current);
        badgeCommitTimerRef.current = null;
      }, 350);
    },
    [layers, selectedLayerId, commitHistorySnapshot]
  );

  const handleCreateBoxAt = useCallback(
    (kind: 'rect' | 'ellipse', rect: Rect): string => {
      const created = createLayerWithActiveStyle(kind, rect);
      setLayers((prev) => [...prev, created]);
      setSelectedLayerId(created.id);
      return created.id;
    },
    [createLayerWithActiveStyle]
  );

  const handleEnsureBrushLayer = useCallback((): string => {
    const created = createLayerWithActiveStyle('brush');
    setLayers((prev) => [...prev, created]);
    setSelectedLayerId(created.id);
    return created.id;
  }, [createLayerWithActiveStyle]);

  const handleMutateLayers = useCallback(
    (updater: (prev: Layer[]) => Layer[], selectId?: string | null) => {
      setLayers(updater);
      if (selectId !== undefined) setSelectedLayerId(selectId);
    },
    []
  );

  const handleCommitFromCanvas = useCallback(() => {
    commitHistorySnapshot(layersRef.current, selectedIdRef.current);
  }, [commitHistorySnapshot]);

  const handleOpenSnsPreview = useCallback(() => {
    if (!sourceImage) return;
    const merged = renderer.renderFinalExport(
      sourceImage,
      imgSize.width,
      imgSize.height,
      layers,
      false
    );
    setSnsPreviewUrl(merged.toDataURL('image/png'));
  }, [sourceImage, renderer, imgSize.width, imgSize.height, layers]);

  const handleCopyClipboard = useCallback(() => {
    if (!sourceImage) return;
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
      showToast('お使いのブラウザ環境ではクリップボードコピーに非対応です');
      return;
    }
    const merged = renderer.renderFinalExport(
      sourceImage,
      imgSize.width,
      imgSize.height,
      layers,
      false
    );
    merged.toBlob(async (blob) => {
      if (!blob) return;
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        showToast('画像をクリップボードにコピーしました');
      } catch {
        showToast('コピーに失敗しました（「保存」ボタンをご利用ください）');
      }
    }, 'image/png');
  }, [sourceImage, renderer, imgSize.width, imgSize.height, layers, showToast]);

  const handleExportImage = useCallback(() => {
    if (!sourceImage) return;
    const quality = exportFormat === 'image/png' ? undefined : 0.92;
    const merged = renderer.renderFinalExport(
      sourceImage,
      imgSize.width,
      imgSize.height,
      layers,
      exportFormat === 'image/jpeg'
    );
    merged.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = buildExportFilename(exportFormat);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setHasUnsavedChanges(false);
        const label = exportFormat.split('/')[1]?.toUpperCase() || 'PNG';
        showToast(`Exif除去済みの ${label} を保存しました`);
      },
      exportFormat,
      quality
    );
  }, [sourceImage, exportFormat, renderer, imgSize.width, imgSize.height, layers, showToast]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (sourceImageRef.current && hasUnsavedRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragDepthRef.current += 1;
      setIsDragOver(true);
    };
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) setIsDragOver(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragDepthRef.current = 0;
      setIsDragOver(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) handleIncomingFile(file);
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [handleIncomingFile]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            handleIncomingFile(blob);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [handleIncomingFile]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!sourceImageRef.current || isModalOpenRef.current) return;
      const activeEl = document.activeElement as HTMLElement | null;
      const tag = (activeEl?.tagName || '').toUpperCase();
      const isEditable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        Boolean(activeEl?.isContentEditable);

      const isTextTyping =
        (tag === 'INPUT' && (activeEl as HTMLInputElement).type === 'text') ||
        tag === 'TEXTAREA' ||
        Boolean(activeEl?.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (isTextTyping) return;
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        if (isTextTyping) return;
        e.preventDefault();
        handleRedo();
        return;
      }

      if (isEditable) return;

      if (e.key === 'Escape' && selectedIdRef.current) {
        setSelectedLayerId(null);
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!selectedIdRef.current) return;
        e.preventDefault();
        handleDeleteLayer();
        return;
      }

      if (e.key === '[') {
        e.preventDefault();
        setBrushSize((s) => Math.max(10, s - 6));
        return;
      }
      if (e.key === ']') {
        e.preventDefault();
        setBrushSize((s) => Math.min(120, s + 6));
        return;
      }

      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        zoomActionsRef.current?.zoomIn();
        return;
      }
      if (e.key === '-') {
        e.preventDefault();
        zoomActionsRef.current?.zoomOut();
        return;
      }
      if (e.key === '0') {
        e.preventDefault();
        zoomActionsRef.current?.fit();
        return;
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const sel = layersRef.current.find((l) => l.id === selectedIdRef.current);
        if (!sel || !isBoxShape(sel.shapeType)) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;

        setLayers((prev) =>
          prev.map((l) =>
            l.id === sel.id ? { ...l, rect: { ...l.rect, x: l.rect.x + dx, y: l.rect.y + dy } } : l
          )
        );

        if (arrowCommitTimerRef.current !== null) {
          window.clearTimeout(arrowCommitTimerRef.current);
        }
        arrowCommitTimerRef.current = window.setTimeout(() => {
          commitHistorySnapshot(layersRef.current, selectedIdRef.current);
          arrowCommitTimerRef.current = null;
        }, 350);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo, handleDeleteLayer, commitHistorySnapshot]);

  const hasImage = Boolean(sourceImage);

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-100 text-slate-900 overflow-hidden">
      <Header
        hasImage={hasImage}
        canUndo={canUndo(history)}
        canRedo={canRedo(history)}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSelectFile={handleIncomingFile}
        onOpenClearConfirm={() => setClearConfirmOpen(true)}
        onOpenSnsPreview={handleOpenSnsPreview}
        onOpenHelp={() => setHelpOpen(true)}
      />

      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        <CanvasStage
          renderer={renderer}
          sourceImage={sourceImage}
          imgWidth={imgSize.width}
          imgHeight={imgSize.height}
          layers={layers}
          selectedLayerId={selectedLayerId}
          activeTool={activeTool}
          brushSize={brushSize}
          isSliderInteracting={isSliderInteracting}
          isDragOver={isDragOver}
          isToastVisible={Boolean(toastMsg)}
          onSelectFile={handleIncomingFile}
          onLoadDemo={handleLoadDemo}
          onChangeTool={handleChangeTool}
          onMutateLayers={handleMutateLayers}
          onSelectLayerOnly={handleSelectLayer}
          onDuplicateSelected={handleDuplicateLayer}
          onDeleteSelected={handleDeleteLayer}
          onCommitHistory={handleCommitFromCanvas}
          onCreateBoxAt={handleCreateBoxAt}
          onEnsureBrushLayer={handleEnsureBrushLayer}
          onToast={showToast}
          zoomActionsRef={zoomActionsRef}
        />

        <Sidebar
          hasImage={hasImage}
          layers={layers}
          selectedLayerId={selectedLayerId}
          activeTool={activeTool}
          activeStyle={activeStyle}
          brushSize={brushSize}
          exportFormat={exportFormat}
          onAddFullLayer={handleAddFullLayer}
          onSelectLayer={handleSelectLayerFromList}
          onToggleVisibility={handleToggleVisibility}
          onReorderLayer={handleReorderLayer}
          onDuplicateLayer={handleDuplicateLayer}
          onDeleteLayer={handleDeleteLayer}
          onApplyPreset={handleApplyPreset}
          onChangeBlurType={handleChangeBlurType}
          onSliderInput={handleSliderInput}
          onSliderCommit={handleSliderCommit}
          onBrushSizeChange={setBrushSize}
          onChangeBadge={handleChangeBadge}
          onChangeExportFormat={setExportFormat}
          onCopyClipboard={handleCopyClipboard}
          onExportImage={handleExportImage}
        />
      </div>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      <SnsPreviewModal
        open={Boolean(snsPreviewUrl)}
        imageDataUrl={snsPreviewUrl || ''}
        onClose={() => setSnsPreviewUrl(null)}
      />

      <ConfirmModal
        open={clearConfirmOpen}
        title="画像と設定をクリアしますか？"
        description="読み込んでいる画像とすべてのぼかしレイヤーがリセットされます。"
        confirmLabel="クリアする"
        danger
        onCancel={() => setClearConfirmOpen(false)}
        onConfirm={handleClearAll}
      />

      <ConfirmModal
        open={Boolean(pendingReplaceFile)}
        title="新しい画像に差し替えますか？"
        description="現在編集中のぼかし設定は破棄され、新しい画像が読み込まれます。"
        confirmLabel="差し替える"
        danger={false}
        onCancel={() => setPendingReplaceFile(null)}
        onConfirm={() => {
          const f = pendingReplaceFile;
          setPendingReplaceFile(null);
          if (f) void loadFileDirectly(f);
        }}
      />

      <Toast message={toastMsg} hasMobileSheet={hasImage} />
    </div>
  );
}

export default App;
