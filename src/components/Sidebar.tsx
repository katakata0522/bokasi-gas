import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Circle,
  Copy,
  Download,
  Eye,
  EyeOff,
  Frame,
  Layers,
  Paintbrush,
  SlidersHorizontal,
  Square,
  Tag,
  Trash2,
} from 'lucide-react';
import type {
  BlurType,
  ExportFormat,
  Layer,
  LayerStyle,
  PresetId,
  ToolMode,
} from '../types/editor';
import {
  BADGE_PRESETS,
  BLUR_TYPE_OPTIONS,
  detectActivePreset,
  isSolidBlurType,
  PRESET_LIST,
} from '../core/presets';

type MobileTab = 'adjust' | 'layers' | 'stamp';

interface SidebarProps {
  hasImage: boolean;
  layers: Layer[];
  selectedLayerId: string | null;
  activeTool: ToolMode;
  activeStyle: LayerStyle;
  brushSize: number;
  exportFormat: ExportFormat;
  onAddFullLayer: () => void;
  onSelectLayer: (id: string | null) => void;
  onToggleVisibility: (id: string) => void;
  onReorderLayer: (id: string, direction: 'up' | 'down') => void;
  onDuplicateLayer: () => void;
  onDeleteLayer: () => void;
  onApplyPreset: (presetId: PresetId) => void;
  onChangeBlurType: (blurType: BlurType) => void;
  onSliderInput: (patch: Partial<LayerStyle>) => void;
  onSliderCommit: () => void;
  onBrushSizeChange: (size: number) => void;
  onChangeBadge: (badge: string) => void;
  onChangeExportFormat: (fmt: ExportFormat) => void;
  onCopyClipboard: () => void;
  onExportImage: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  hasImage,
  layers,
  selectedLayerId,
  activeTool,
  activeStyle,
  brushSize,
  exportFormat,
  onAddFullLayer,
  onSelectLayer,
  onToggleVisibility,
  onReorderLayer,
  onDuplicateLayer,
  onDeleteLayer,
  onApplyPreset,
  onChangeBlurType,
  onSliderInput,
  onSliderCommit,
  onBrushSizeChange,
  onChangeBadge,
  onChangeExportFormat,
  onCopyClipboard,
  onExportImage,
}) => {
  const [mobileCollapsed, setMobileCollapsed] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('adjust');

  const selectedLayer = layers.find((l) => l.id === selectedLayerId) || null;
  const currentStyle: LayerStyle = selectedLayer || activeStyle;
  const activePreset = detectActivePreset(currentStyle);
  const isSolid = isSolidBlurType(currentStyle.blurType);

  const isBrushSliderMode =
    activeTool === 'brush' ||
    activeTool === 'eraser' ||
    selectedLayer?.shapeType === 'brush';
  const isFullLayer = selectedLayer?.shapeType === 'full';
  const isEllipseLayer = selectedLayer?.shapeType === 'ellipse' || (!selectedLayer && activeTool === 'ellipse');
  const isFeatherDisabled = !hasImage || isFullLayer;
  const isShapeParamDisabled = !hasImage || (isFullLayer && !isBrushSliderMode) || (!isBrushSliderMode && isEllipseLayer);

  const layersTopFirst = [...layers].reverse();

  const renderLayersSection = () => (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold text-slate-500">
          ぼかしレイヤー{layers.length > 0 ? ` (${layers.length})` : ''}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!hasImage}
            onClick={onAddFullLayer}
            className="px-2 py-1 rounded-md bg-blue-50 hover:bg-blue-100 disabled:opacity-35 text-blue-700 text-[11px] font-semibold flex items-center gap-1 transition whitespace-nowrap"
            title="画像全体をぼかして、消しゴムで一部を見せられます"
          >
            <Frame className="w-3 h-3" aria-hidden="true" />
            <span>全体ぼかし</span>
          </button>
          {selectedLayer && (
            <>
              <button
                type="button"
                onClick={onDuplicateLayer}
                className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-[11px] font-medium transition"
                title="選択中のレイヤーを複製"
              >
                複製
              </button>
              <button
                type="button"
                onClick={onDeleteLayer}
                className="px-2 py-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-medium transition"
                title="選択中のレイヤーを削除 (Delete)"
              >
                削除
              </button>
            </>
          )}
        </div>
      </div>

      <div
        role="listbox"
        aria-label="ぼかしレイヤー一覧"
        className="space-y-1 max-h-36 overflow-y-auto pr-0.5"
      >
        {layersTopFirst.length === 0 ? (
          <p className="text-[11px] text-slate-400 py-2.5 px-3 text-center border border-dashed border-slate-200 rounded-lg leading-relaxed">
            画像上をドラッグ・なぞってぼかしを作成できます
          </p>
        ) : (
          layersTopFirst.map((layer) => {
            const isSelected = layer.id === selectedLayerId;
            const origIndex = layers.findIndex((l) => l.id === layer.id);
            const canMoveUp = origIndex < layers.length - 1;
            const canMoveDown = origIndex > 0;
            const ShapeIcon =
              layer.shapeType === 'full'
                ? Frame
                : layer.shapeType === 'brush'
                ? Paintbrush
                : layer.shapeType === 'ellipse'
                ? Circle
                : Square;

            return (
              <div
                key={layer.id}
                role="option"
                aria-selected={isSelected}
                className={`flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg border text-xs transition ${
                  isSelected
                    ? 'bg-blue-50/80 border-blue-400 text-blue-950 font-semibold'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectLayer(isSelected ? null : layer.id)}
                  className="flex-1 min-w-0 flex items-center gap-2 text-left"
                >
                  <ShapeIcon className="w-3.5 h-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                  <span className={`truncate ${!layer.visible ? 'line-through opacity-45' : ''}`}>
                    {layer.name}
                  </span>
                </button>

                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    disabled={!canMoveUp}
                    onClick={() => onReorderLayer(layer.id, 'up')}
                    aria-label={`${layer.name} を前面へ`}
                    title="前面へ移動"
                    className="w-6 h-6 rounded hover:bg-slate-200/70 disabled:opacity-25 flex items-center justify-center text-slate-600"
                  >
                    <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={!canMoveDown}
                    onClick={() => onReorderLayer(layer.id, 'down')}
                    aria-label={`${layer.name} を背面へ`}
                    title="背面へ移動"
                    className="w-6 h-6 rounded hover:bg-slate-200/70 disabled:opacity-25 flex items-center justify-center text-slate-600"
                  >
                    <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleVisibility(layer.id)}
                    aria-label={layer.visible ? `${layer.name} を非表示` : `${layer.name} を表示`}
                    title={layer.visible ? '一時的に非表示' : '表示する'}
                    className="w-6 h-6 rounded hover:bg-slate-200/70 flex items-center justify-center text-slate-600"
                  >
                    {layer.visible ? (
                      <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );

  const renderAdjustSection = (scope: 'desktop' | 'mobile') => (
    <div className={scope === 'mobile' ? 'space-y-3' : 'space-y-4'}>
      {/* Presets */}
      <section className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold text-slate-500">プリセット</h2>
          <span className="text-[11px] text-slate-400 truncate">
            {selectedLayer ? `適用先: ${selectedLayer.name}` : '次に描くぼかしに適用'}
          </span>
        </div>
        <div
          className={
            scope === 'mobile'
              ? 'flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5'
              : 'flex flex-wrap gap-1.5'
          }
        >
          {PRESET_LIST.map((preset) => {
            const isActive = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                data-preset={preset.id}
                disabled={!hasImage}
                onClick={() => onApplyPreset(preset.id)}
                title={preset.shortDesc}
                className={`shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Sliders */}
      <section className="space-y-2.5">
        <div className="grid grid-cols-2 gap-3">
          <div className={`space-y-1 ${isSolid ? 'opacity-40' : ''}`}>
            <div className="flex justify-between items-baseline text-xs">
              <label htmlFor={`${scope}-sliderStrength`} className="text-slate-700 font-medium">
                ぼかし強さ
              </label>
              <span className="font-mono tabular-nums text-blue-600 font-semibold">
                {isSolid ? '—' : currentStyle.strength}
              </span>
            </div>
            <input
              id={`${scope}-sliderStrength`}
              type="range"
              min={1}
              max={60}
              disabled={!hasImage || isSolid}
              value={currentStyle.strength}
              onChange={(e) => onSliderInput({ strength: Number(e.target.value) })}
              onPointerUp={onSliderCommit}
              onKeyUp={onSliderCommit}
              onBlur={onSliderCommit}
              className="w-full"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-baseline text-xs">
              <label htmlFor={`${scope}-sliderOpacity`} className="text-slate-700 font-medium">
                濃度
              </label>
              <span className="font-mono tabular-nums text-blue-600 font-semibold">
                {Math.round(currentStyle.opacity * 100)}%
              </span>
            </div>
            <input
              id={`${scope}-sliderOpacity`}
              type="range"
              min={15}
              max={100}
              disabled={!hasImage}
              value={Math.round(currentStyle.opacity * 100)}
              onChange={(e) => onSliderInput({ opacity: Number(e.target.value) / 100 })}
              onPointerUp={onSliderCommit}
              onKeyUp={onSliderCommit}
              onBlur={onSliderCommit}
              className="w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className={`space-y-1 ${isFeatherDisabled ? 'opacity-40' : ''}`}>
            <div className="flex justify-between items-baseline text-xs">
              <label htmlFor={`${scope}-sliderFeather`} className="text-slate-600 font-medium">
                フチなじませ
              </label>
              <span className="font-mono tabular-nums text-slate-700 font-semibold">
                {isFeatherDisabled ? '—' : currentStyle.feather}
              </span>
            </div>
            <input
              id={`${scope}-sliderFeather`}
              type="range"
              min={0}
              max={50}
              disabled={isFeatherDisabled}
              value={currentStyle.feather}
              onChange={(e) => onSliderInput({ feather: Number(e.target.value) })}
              onPointerUp={onSliderCommit}
              onKeyUp={onSliderCommit}
              onBlur={onSliderCommit}
              className="w-full"
            />
          </div>

          <div className={`space-y-1 ${isShapeParamDisabled ? 'opacity-40' : ''}`}>
            <div className="flex justify-between items-baseline text-xs">
              <label htmlFor={`${scope}-sliderShapeParam`} className="text-slate-600 font-medium">
                {isBrushSliderMode ? 'ブラシ太さ' : '角丸'}
              </label>
              <span className="font-mono tabular-nums text-slate-700 font-semibold">
                {isShapeParamDisabled
                  ? '—'
                  : isBrushSliderMode
                  ? brushSize
                  : currentStyle.borderRadius}
              </span>
            </div>
            <input
              id={`${scope}-sliderShapeParam`}
              type="range"
              min={isBrushSliderMode ? 10 : 0}
              max={isBrushSliderMode ? 120 : 100}
              disabled={isShapeParamDisabled}
              value={isBrushSliderMode ? brushSize : currentStyle.borderRadius}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (isBrushSliderMode) {
                  onBrushSizeChange(v);
                } else {
                  onSliderInput({ borderRadius: v });
                }
              }}
              onPointerUp={() => {
                if (!isBrushSliderMode) onSliderCommit();
              }}
              onKeyUp={() => {
                if (!isBrushSliderMode) onSliderCommit();
              }}
              onBlur={() => {
                if (!isBrushSliderMode) onSliderCommit();
              }}
              className="w-full"
            />
          </div>
        </div>
      </section>

      {/* Blur / Redact Texture */}
      <section className="space-y-1.5">
        <h2 className="text-xs font-semibold text-slate-500">質感・塗りつぶし</h2>
        <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg">
          {BLUR_TYPE_OPTIONS.map((opt) => {
            const isActive = currentStyle.blurType === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                data-blurtype={opt.id}
                disabled={!hasImage}
                onClick={() => onChangeBlurType(opt.id)}
                className={`py-1.5 rounded-md text-xs transition whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 font-medium'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );

  const renderStampSection = () => (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold text-slate-500">スタンプ（中央ラベル）</h2>
        {!selectedLayer && hasImage && (
          <span className="text-[11px] text-slate-400">枠を選択して追加</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {BADGE_PRESETS.map((item) => {
          const isMatch = Boolean(selectedLayer) && (selectedLayer?.badge ?? '') === item.value;
          return (
            <button
              key={item.label}
              type="button"
              data-badge={item.value}
              disabled={!selectedLayer}
              onClick={() => onChangeBadge(item.value)}
              className={`px-2.5 py-1 rounded-lg text-xs border transition whitespace-nowrap disabled:opacity-40 ${
                isMatch
                  ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 font-medium'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-1.5 pt-0.5">
        <input
          type="text"
          maxLength={24}
          disabled={!selectedLayer}
          value={selectedLayer?.badge ?? ''}
          onChange={(e) => onChangeBadge(e.target.value)}
          placeholder="自由なスタンプ文字を入力（例：社外秘）"
          aria-label="カスタムスタンプ文字"
          className="flex-1 min-w-0 h-8 px-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white disabled:opacity-45 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {selectedLayer?.badge && (
          <button
            type="button"
            onClick={() => onChangeBadge('')}
            aria-label="スタンプを消去"
            className="h-8 px-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 text-xs"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );

  const mobileVisibilityClass = hasImage ? 'flex' : 'hidden lg:flex';

  return (
    <aside
      aria-label="ぼかし設定サイドバー"
      className={`${mobileVisibilityClass} w-full lg:w-[356px] xl:w-[372px] ${
        mobileCollapsed ? 'max-h-none' : 'max-h-[42vh]'
      } lg:max-h-none bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex-col shrink-0 z-20`}
    >
      {/* Mobile tab header + collapse toggle */}
      <div className="flex lg:hidden items-center justify-between px-3 py-1.5 border-b border-slate-200 bg-slate-50 shrink-0 gap-2">
        <div className="flex items-center gap-1" role="tablist" aria-label="設定タブ">
          {(
            [
              { id: 'adjust', label: '調整', icon: SlidersHorizontal },
              { id: 'layers', label: `レイヤー (${layers.length})`, icon: Layers },
              { id: 'stamp', label: 'スタンプ', icon: Tag },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mobileTab === id}
              onClick={() => {
                setMobileTab(id);
                setMobileCollapsed(false);
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition whitespace-nowrap ${
                mobileTab === id && !mobileCollapsed
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setMobileCollapsed((prev) => !prev)}
          aria-label={mobileCollapsed ? '設定パネルを開く' : '設定パネルをたたむ'}
          className="px-2 py-1 rounded-md bg-white border border-slate-200 text-[11px] font-medium text-slate-600 flex items-center gap-1 shrink-0"
        >
          {mobileCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
              <span>開く</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              <span>たたむ</span>
            </>
          )}
        </button>
      </div>

      {/* Desktop scrollable inspector body */}
      <div
        className={`hidden lg:block flex-1 overflow-y-auto px-4 py-4 space-y-5 transition-opacity ${
          hasImage ? 'opacity-100' : 'opacity-40 pointer-events-none'
        }`}
      >
        {renderAdjustSection('desktop')}
        <div className="border-t border-slate-100 pt-4">{renderLayersSection()}</div>
        <div className="border-t border-slate-100 pt-4">{renderStampSection()}</div>
      </div>

      {/* Mobile tabbed scrollable body */}
      {!mobileCollapsed && (
        <div className="lg:hidden flex-1 overflow-y-auto px-3.5 py-3">
          {mobileTab === 'adjust' && renderAdjustSection('mobile')}
          {mobileTab === 'layers' && renderLayersSection()}
          {mobileTab === 'stamp' && renderStampSection()}
        </div>
      )}

      {/* Sticky export footer */}
      <div className="border-t border-slate-200 bg-white px-3.5 py-2.5 pb-[max(0.65rem,env(safe-area-inset-bottom))] shrink-0 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <select
            aria-label="保存形式"
            value={exportFormat}
            onChange={(e) => onChangeExportFormat(e.target.value as ExportFormat)}
            className="h-9 px-2.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="image/png">PNG</option>
            <option value="image/jpeg">JPEG</option>
            <option value="image/webp">WebP</option>
          </select>

          <button
            type="button"
            disabled={!hasImage}
            onClick={onCopyClipboard}
            className="h-9 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] transition text-xs font-semibold text-slate-800 border border-slate-200 flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap"
            title="クリップボードへ画像をコピー"
          >
            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
            <span>コピー</span>
          </button>

          <button
            type="button"
            disabled={!hasImage}
            onClick={onExportImage}
            className="flex-1 h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 active:scale-[0.98] transition text-xs sm:text-sm font-semibold text-white flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>保存</span>
          </button>
        </div>
        <p className="text-[10px] text-slate-400 text-center">
          ブラウザ内処理 · 書き出し時にGPS/Exifを自動除去
        </p>
      </div>
    </aside>
  );
};
