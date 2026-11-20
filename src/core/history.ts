import type { HistorySnapshot, Layer } from '../types/editor';

export const MAX_HISTORY = 40;

export interface HistoryState {
  entries: HistorySnapshot[];
  index: number;
}

export function createInitialHistory(): HistoryState {
  return { entries: [], index: -1 };
}

export function cloneLayers(layers: Layer[]): Layer[] {
  return layers.map((l) => ({
    ...l,
    rect: { ...l.rect },
    strokes: l.strokes.map((s) => ({
      size: s.size,
      points: s.points.map((p) => ({ x: p.x, y: p.y })),
    })),
    erasers: l.erasers.map((e) => ({
      size: e.size,
      points: e.points.map((p) => ({ x: p.x, y: p.y })),
    })),
  }));
}

export function pushHistoryState(
  history: HistoryState,
  layers: Layer[],
  selectedLayerId: string | null,
  maxEntries = MAX_HISTORY
): HistoryState {
  const snapshot: HistorySnapshot = {
    layers: cloneLayers(layers),
    selectedLayerId,
  };
  const nextEntries = history.entries.slice(0, history.index + 1);
  nextEntries.push(snapshot);
  if (nextEntries.length > maxEntries) {
    nextEntries.shift();
    return { entries: nextEntries, index: nextEntries.length - 1 };
  }
  return { entries: nextEntries, index: nextEntries.length - 1 };
}

export function canUndo(history: HistoryState): boolean {
  return history.index > 0;
}

export function canRedo(history: HistoryState): boolean {
  return history.index >= 0 && history.index < history.entries.length - 1;
}

export function stepUndo(
  history: HistoryState
): { history: HistoryState; snapshot: HistorySnapshot } | null {
  if (!canUndo(history)) return null;
  const nextIndex = history.index - 1;
  const raw = history.entries[nextIndex];
  return {
    history: { entries: history.entries, index: nextIndex },
    snapshot: {
      layers: cloneLayers(raw.layers),
      selectedLayerId: raw.selectedLayerId,
    },
  };
}

export function stepRedo(
  history: HistoryState
): { history: HistoryState; snapshot: HistorySnapshot } | null {
  if (!canRedo(history)) return null;
  const nextIndex = history.index + 1;
  const raw = history.entries[nextIndex];
  return {
    history: { entries: history.entries, index: nextIndex },
    snapshot: {
      layers: cloneLayers(raw.layers),
      selectedLayerId: raw.selectedLayerId,
    },
  };
}
