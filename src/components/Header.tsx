import React, { useEffect, useRef, useState } from 'react';
import {
  HelpCircle,
  ImagePlus,
  MoreHorizontal,
  Redo2,
  Share2,
  Trash2,
  Undo2,
} from 'lucide-react';
import { IMAGE_ACCEPT_ATTR } from '../core/fileLoader';

interface HeaderProps {
  hasImage: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSelectFile: (file: File) => void;
  onOpenClearConfirm: () => void;
  onOpenSnsPreview: () => void;
  onOpenHelp: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  hasImage,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSelectFile,
  onOpenClearConfirm,
  onOpenSnsPreview,
  onOpenHelp,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onSelectFile(file);
    e.target.value = '';
  };

  return (
    <header className="h-13 bg-white border-b border-slate-200 px-3 sm:px-5 flex items-center justify-between gap-3 shrink-0 z-30">
      {/* Brand Wordmark - always readable in full even at 360px */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="font-bold text-[15px] sm:text-base tracking-tight text-slate-900 whitespace-nowrap">
          ぼかしメーカー
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onUndo}
          disabled={!hasImage || !canUndo}
          aria-label="元に戻す"
          title="元に戻す (Ctrl+Z)"
          className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-slate-100 hover:bg-slate-200/80 disabled:opacity-35 disabled:pointer-events-none active:scale-95 transition text-slate-700 flex items-center justify-center focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <Undo2 className="w-4 h-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onRedo}
          disabled={!hasImage || !canRedo}
          aria-label="やり直す"
          title="やり直す (Ctrl+Y / Ctrl+Shift+Z)"
          className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-slate-100 hover:bg-slate-200/80 disabled:opacity-35 disabled:pointer-events-none active:scale-95 transition text-slate-700 flex items-center justify-center focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <Redo2 className="w-4 h-4" aria-hidden="true" />
        </button>

        <div className="h-4 w-px bg-slate-200 mx-0.5 hidden sm:block" aria-hidden="true" />

        <input
          ref={fileInputRef}
          type="file"
          accept={IMAGE_ACCEPT_ATTR}
          onChange={handleFileChange}
          className="hidden"
          aria-label="画像を読み込む"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="h-9 sm:h-8 px-2.5 sm:px-3 rounded-lg bg-slate-100 hover:bg-slate-200/80 active:scale-95 transition text-xs font-semibold text-slate-800 border border-slate-200 flex items-center gap-1.5 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-600"
          title="画像を読み込む・差し替える"
        >
          <ImagePlus className="w-3.5 h-3.5 text-slate-600 shrink-0" aria-hidden="true" />
          <span>画像選択</span>
        </button>

        {/* Desktop actions */}
        <div className="hidden sm:flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenSnsPreview}
            disabled={!hasImage}
            className="h-8 px-3 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-35 disabled:pointer-events-none active:scale-95 transition text-xs font-semibold text-slate-700 border border-slate-200 flex items-center gap-1.5 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-600"
            title="SNSタイムラインでの見え方を確認"
          >
            <Share2 className="w-3.5 h-3.5 text-slate-600 shrink-0" aria-hidden="true" />
            <span>見栄え確認</span>
          </button>

          <button
            type="button"
            onClick={onOpenClearConfirm}
            disabled={!hasImage}
            className="h-8 px-2.5 rounded-lg bg-white hover:bg-rose-50 disabled:opacity-35 disabled:pointer-events-none active:scale-95 transition text-xs font-semibold text-rose-700 border border-rose-200 flex items-center gap-1.5 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-600"
            title="画像とぼかし設定を一括クリア"
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>クリア</span>
          </button>

          <div className="h-4 w-px bg-slate-200 mx-0.5" aria-hidden="true" />

          <button
            type="button"
            onClick={onOpenHelp}
            aria-label="使い方とQ&A"
            title="使い方とショートカット"
            className="h-8 px-2.5 rounded-lg bg-white hover:bg-slate-100 active:scale-95 transition text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <HelpCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="hidden md:inline">使い方</span>
          </button>
        </div>

        {/* Mobile overflow menu */}
        <div className="relative sm:hidden" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="その他のメニュー"
            aria-expanded={menuOpen}
            className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200/80 active:scale-95 transition text-slate-700 flex items-center justify-center focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-1.5 w-48 rounded-xl bg-white border border-slate-200 shadow-lg py-1.5 z-50"
            >
              <button
                type="button"
                role="menuitem"
                disabled={!hasImage}
                onClick={() => {
                  setMenuOpen(false);
                  onOpenSnsPreview();
                }}
                className="w-full px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-2.5"
              >
                <Share2 className="w-4 h-4 text-slate-500" aria-hidden="true" />
                <span>SNS見栄え確認</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenHelp();
                }}
                className="w-full px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
              >
                <HelpCircle className="w-4 h-4 text-slate-500" aria-hidden="true" />
                <span>使い方・ショートカット</span>
              </button>
              <div className="my-1 border-t border-slate-100" />
              <button
                type="button"
                role="menuitem"
                disabled={!hasImage}
                onClick={() => {
                  setMenuOpen(false);
                  onOpenClearConfirm();
                }}
                className="w-full px-3.5 py-2.5 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40 flex items-center gap-2.5"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                <span>画像と設定をクリア</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
