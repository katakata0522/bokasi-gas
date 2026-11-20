import type { BlurType, Layer, LayerStyle, PresetConfig, PresetId } from '../types/editor';

export const PRESET_LIST: PresetConfig[] = [
  {
    id: 'tease',
    label: '匂わせチラ見せ',
    shortDesc: '雰囲気を残す弱ガウス',
    blurType: 'gaussian',
    strength: 9,
    opacity: 0.92,
    feather: 16,
    borderRadius: 18,
  },
  {
    id: 'strong',
    label: '強ぼかし',
    shortDesc: '判読しにくい強ガウス',
    blurType: 'gaussian',
    strength: 30,
    opacity: 1,
    feather: 10,
    borderRadius: 12,
  },
  {
    id: 'redact',
    label: '完全秘匿（黒塗り）',
    shortDesc: '復元不能な完全塗りつぶし',
    blurType: 'solid-black',
    strength: 1,
    opacity: 1,
    feather: 0,
    borderRadius: 8,
  },
  {
    id: 'frosted',
    label: 'すりガラス',
    shortDesc: '白み＋微細ノイズ',
    blurType: 'frosted',
    strength: 18,
    opacity: 0.95,
    feather: 12,
    borderRadius: 18,
  },
  {
    id: 'mosaic',
    label: 'モザイク',
    shortDesc: 'ドット状のモザイク処理',
    blurType: 'mosaic',
    strength: 16,
    opacity: 1,
    feather: 4,
    borderRadius: 10,
  },
];

export const PRESETS_BY_ID: Record<PresetId, PresetConfig> = PRESET_LIST.reduce(
  (acc, preset) => {
    acc[preset.id] = preset;
    return acc;
  },
  {} as Record<PresetId, PresetConfig>
);

export const DEFAULT_LAYER_STYLE: LayerStyle = {
  blurType: PRESETS_BY_ID.tease.blurType,
  strength: PRESETS_BY_ID.tease.strength,
  opacity: PRESETS_BY_ID.tease.opacity,
  feather: PRESETS_BY_ID.tease.feather,
  borderRadius: PRESETS_BY_ID.tease.borderRadius,
};

export interface BlurTypeOption {
  id: BlurType;
  label: string;
}

export const BLUR_TYPE_OPTIONS: BlurTypeOption[] = [
  { id: 'gaussian', label: 'ガウス' },
  { id: 'frosted', label: 'すりガラス' },
  { id: 'mosaic', label: 'モザイク' },
  { id: 'motion', label: 'モーション' },
  { id: 'solid-black', label: '黒塗り' },
  { id: 'solid-white', label: '白塗り' },
];

export const BADGE_PRESETS: { value: string; label: string }[] = [
  { value: '', label: 'なし' },
  { value: '？', label: '？' },
  { value: 'SECRET', label: 'SECRET' },
  { value: 'チラ見せ', label: 'チラ見せ' },
  { value: 'ネタバレ注意', label: 'ネタバレ注意' },
];

export function isSolidBlurType(blurType: BlurType): boolean {
  return blurType === 'solid-black' || blurType === 'solid-white';
}

export function detectActivePreset(style: LayerStyle | null): PresetId | null {
  if (!style) return null;
  for (const preset of PRESET_LIST) {
    if (style.blurType !== preset.blurType) continue;
    if (Math.abs(style.opacity - preset.opacity) > 0.015) continue;
    if (isSolidBlurType(preset.blurType)) {
      if (style.feather === preset.feather) return preset.id;
      continue;
    }
    if (style.strength === preset.strength && style.feather === preset.feather) {
      return preset.id;
    }
  }
  return null;
}

export function applyPresetToLayer(layer: Layer, presetId: PresetId): Layer {
  const preset = PRESETS_BY_ID[presetId];
  return {
    ...layer,
    blurType: preset.blurType,
    strength: preset.strength,
    opacity: preset.opacity,
    feather: preset.feather,
  };
}

export function presetToStyle(presetId: PresetId): LayerStyle {
  const preset = PRESETS_BY_ID[presetId];
  return {
    blurType: preset.blurType,
    strength: preset.strength,
    opacity: preset.opacity,
    feather: preset.feather,
    borderRadius: preset.borderRadius,
  };
}
