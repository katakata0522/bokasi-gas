import React, { useRef } from 'react';
import {
  Check,
  Circle,
  Copy,
  Eraser,
  Eye,
  Grid2x2,
  Hand,
  Image as ImageIcon,
  ImagePlus,
  Minus,
  Paintbrush,
  Plus,
  Square,
  Trash2,
} from 'lucide-react';
import type { ToolMode } from '../types/editor';
import type { FloatingActionPos } from '../core/geometry';
import { IMAGE_ACCEPT_ATTR } from '../core/fileLoader';

const DOCK_TOOLS: {
  id: ToolMode;
  label: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'rect', label: '四角', title: 'ドラッグで四角くぼかす', icon: Square },
  {
    id: 'ellipse',
    label: '丸',
    title: 'ドラッグで丸・楕円にぼかす（顔・アイコン向け）',
    icon: Circle,
  },
  { id: 'brush', label: 'なぞる', title: '指やマウスでなぞって自由にぼかす', icon: Paintbrush },
  { id: 'eraser', label: '消す', title: 'ぼかしの一部をなぞって解除', icon: Eraser },
  { id: 'pan', label: '移動', title: 'キャンバスを移動 (Space+ドラッグ)', icon: Hand },
];

const FIRST_DRAW_PROMPT: Record<ToolMode, string> = {
  rect: 'ドラッグで囲むとぼかしが入ります',
  ellipse: 'ドラッグで丸く囲むとぼかしが入ります',
  brush: '隠したい場所をなぞるとぼかしが入ります',
  eraser: 'なぞるとぼかしの一部を解除できます',
  pan: 'ドラッグで画面を移動できます',
};

export const EmptyDropOverlay: React.FC<{
  isDragOver: boolean;
  onSelectFile: (file: File) => void;
  onLoadDemo: () => void;
}> = ({ isDragOver, onSelectFile, onLoadDemo }) => {
  const welcomeFileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="absolute inset-0 flex items-center justify-center p-5 z-10">
      <div
        className={`relative max-w-md w-full rounded-2xl border-2 border-dashed bg-white p-6 sm:p-8 text-center transition-colors shadow-sm ${
          isDragOver ? 'border-blue-500 bg-blue-50/40' : 'border-slate-300 hover:border-blue-400'
        }`}
      >
        <input
          ref={welcomeFileRef}
          type="file"
          accept={IMAGE_ACCEPT_ATTR}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onSelectFile(file);
            e.target.value = '';
          }}
          className="hidden"
          aria-label="加工する画像を選択"
        />
        <div className="w-12 h-12 mx-auto mb-3.5 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
          <ImagePlus className="w-6 h-6" aria-hidden="true" />
        </div>
        <h1 className="text-base sm:text-lg font-bold text-slate-900 mb-1.5 text-balance">
          ここに画像をドロップ、または選択
        </h1>
        <p className="text-xs text-slate-500 mb-5 leading-relaxed">
          スクショや写真を{' '}
          <kbd className="px-1.5 py-0.5 text-[11px] font-mono bg-slate-100 border border-slate-200 rounded text-slate-700">
            Ctrl + V
          </kbd>{' '}
          で直接貼り付けできます。
          <br />
          すべてブラウザ内処理のためサーバー送信は行いません。
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={() => welcomeFileRef.current?.click()}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition whitespace-nowrap"
          >
            画像ファイルを開く
          </button>
          <button
            type="button"
            id="btnLoadDemo"
            onClick={onLoadDemo}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-800 font-semibold text-xs border border-slate-200 transition flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <ImageIcon className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
            <span>サンプル画像で試す</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export const FirstDrawGuide: React.FC<{ activeTool: ToolMode }> = ({ activeTool }) => (
  <div
    data-testid="first-draw-guide"
    className="pointer-events-none absolute top-3 left-3 sm:left-1/2 sm:-translate-x-1/2 px-3 py-1.5 rounded-lg bg-slate-900/80 text-white text-[11px] font-medium backdrop-blur-xs shadow-sm z-10 max-w-[calc(100%-24px)] sm:max-w-md truncate"
  >
    {FIRST_DRAW_PROMPT[activeTool]}
  </div>
);

export const CompareButton: React.FC<{
  isComparing: boolean;
  onStartCompare: () => void;
}> = ({ isComparing, onStartCompare }) => (
  <div id="floatingHud" className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onStartCompare();
      }}
      onTouchStart={(e) => {
        e.preventDefault();
        onStartCompare();
      }}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border shadow-xs flex items-center gap-1.5 transition whitespace-nowrap ${
        isComparing
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white/95 hover:bg-white text-slate-700 border-slate-200'
      }`}
      title="押している間だけ元の画像を表示"
    >
      <Eye className="w-3.5 h-3.5" aria-hidden="true" />
      <span>元画像比較</span>
    </button>
  </div>
);

export const BoxQuickActions: React.FC<{
  pos: FloatingActionPos;
  onDuplicate: () => void;
  onDelete: () => void;
  onDone: () => void;
}> = ({ pos, onDuplicate, onDelete, onDone }) => (
  <div
    data-testid="box-quick-actions"
    style={{ left: `${pos.left}px`, top: `${pos.top}px` }}
    className="absolute -translate-x-1/2 flex items-center gap-0.5 bg-slate-900/92 text-white rounded-lg shadow-lg p-1 z-20 backdrop-blur-xs"
  >
    <button
      type="button"
      onClick={onDuplicate}
      title="選択枠を複製"
      className="h-7 px-2 rounded-md hover:bg-white/15 text-[11px] font-medium flex items-center gap-1 transition whitespace-nowrap"
    >
      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
      <span>複製</span>
    </button>
    <button
      type="button"
      onClick={onDelete}
      title="選択枠を削除 (Delete)"
      className="h-7 px-2 rounded-md hover:bg-rose-500/80 text-rose-200 hover:text-white text-[11px] font-medium flex items-center gap-1 transition whitespace-nowrap"
    >
      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
      <span>削除</span>
    </button>
    <div className="w-px h-4 bg-white/20 mx-0.5" aria-hidden="true" />
    <button
      type="button"
      onClick={onDone}
      title="枠線を消して仕上がり確認 (Esc)"
      className="h-7 px-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold flex items-center gap-1 transition whitespace-nowrap"
    >
      <Check className="w-3.5 h-3.5" aria-hidden="true" />
      <span>完了</span>
    </button>
  </div>
);

export const QuickToolDock: React.FC<{
  activeTool: ToolMode;
  spacePanning: boolean;
  onChangeTool: (tool: ToolMode) => void;
}> = ({ activeTool, spacePanning, onChangeTool }) => (
  <div
    role="toolbar"
    aria-label="ぼかし描画ツール"
    className="absolute bottom-3 left-3 sm:left-1/2 sm:-translate-x-1/2 flex items-center gap-0.5 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-md p-1 z-20"
  >
    {DOCK_TOOLS.map(({ id, label, title, icon: Icon }) => {
      const isActive = (spacePanning ? 'pan' : activeTool) === id;
      return (
        <button
          key={id}
          type="button"
          data-tool={id}
          aria-pressed={isActive}
          title={title}
          onClick={() => onChangeTool(id)}
          className={`h-8 px-2 sm:px-3 rounded-lg text-xs flex items-center gap-1.5 transition whitespace-nowrap ${
            isActive
              ? 'bg-slate-900 text-white font-semibold shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium'
          }`}
        >
          <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      );
    })}
  </div>
);

export const ZoomHud: React.FC<{
  zoomPct: number;
  showCheckerboard: boolean;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onFit: () => void;
  onToggleCheckerboard: () => void;
}> = ({ zoomPct, showCheckerboard, onZoomOut, onZoomIn, onFit, onToggleCheckerboard }) => (
  <div
    id="zoomHud"
    className="absolute bottom-3 right-3 flex items-center bg-white/95 backdrop-blur-xs border border-slate-200 rounded-xl shadow-sm p-1 gap-0.5 z-10"
  >
    <button
      type="button"
      onClick={onZoomOut}
      aria-label="縮小"
      title="縮小 (-)"
      className="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-700 flex items-center justify-center transition"
    >
      <Minus className="w-3.5 h-3.5" aria-hidden="true" />
    </button>
    <span
      data-testid="zoom-label"
      className="hidden sm:inline-block px-1.5 text-[11px] font-mono tabular-nums font-semibold text-slate-700 min-w-[42px] text-center"
    >
      {zoomPct}%
    </span>
    <button
      type="button"
      onClick={onZoomIn}
      aria-label="拡大"
      title="拡大 (+)"
      className="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-700 flex items-center justify-center transition"
    >
      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
    </button>
    <div className="w-px h-4 bg-slate-200 mx-0.5 hidden sm:block" aria-hidden="true" />
    <button
      type="button"
      onClick={onFit}
      title="画面にフィット (0)"
      className="hidden sm:flex px-2 h-7 rounded-lg hover:bg-slate-100 text-slate-700 text-[11px] font-semibold items-center transition"
    >
      Fit
    </button>
    <div className="w-px h-4 bg-slate-200 mx-0.5 hidden md:block" aria-hidden="true" />
    <button
      type="button"
      onClick={onToggleCheckerboard}
      aria-label="透過チェック背景を切り替え"
      aria-pressed={showCheckerboard}
      title="透過チェック背景を切り替え"
      className={`hidden md:flex w-7 h-7 rounded-lg items-center justify-center transition ${
        showCheckerboard
          ? 'bg-blue-50 text-blue-600'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
      }`}
    >
      <Grid2x2 className="w-3.5 h-3.5" aria-hidden="true" />
    </button>
  </div>
);
