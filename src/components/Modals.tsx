import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Share2, X } from 'lucide-react';

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  titleId: string;
  maxWidthClass?: string;
  children: React.ReactNode;
}

const ModalShell: React.FC<ModalShellProps> = ({
  open,
  onClose,
  titleId,
  maxWidthClass = 'max-w-lg',
  children,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      prevFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/55 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`bg-white border border-slate-200 rounded-2xl ${maxWidthClass} w-full overflow-hidden shadow-2xl flex flex-col max-h-[88vh] outline-none`}
      >
        {children}
      </div>
    </div>
  );
};

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ open, onClose }) => (
  <ModalShell open={open} onClose={onClose} titleId="helpModalTitle" maxWidthClass="max-w-lg">
    <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
      <h2 id="helpModalTitle" className="text-sm font-bold text-slate-900">
        使い方・ショートカット・Q&amp;A
      </h2>
      <button
        type="button"
        onClick={onClose}
        aria-label="閉じる"
        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>

    <div className="p-5 overflow-y-auto space-y-5 text-xs text-slate-600 leading-relaxed">
      <section className="space-y-2">
        <h3 className="font-bold text-slate-900 text-sm">基本の操作</h3>
        <ul className="list-disc pl-4 space-y-1.5">
          <li>
            <strong className="text-slate-800">四角・丸で囲む</strong>：画像の上をドラッグするとそのままぼかし枠を作成できます。枠の外をクリック（または「完了」）すると枠線が消えて仕上がりを確認できます。
          </li>
          <li>
            <strong className="text-slate-800">なぞる（ブラシ）</strong>：指やマウスでなぞった部分だけを自由にぼかせます。選んだ質感や強さは次の描画にも引き継がれます。
          </li>
          <li>
            <strong className="text-slate-800">全体ぼかし</strong>：画像全体をぼかします。「消す」で見せたい部分だけくり抜き、「なぞる」で再度ぼかしを塗り戻せます。
          </li>
          <li>
            <strong className="text-slate-800">完全秘匿（黒塗り・白塗り）</strong>：ガウスぼかしやモザイクは文字解析で復元される可能性があります。個人情報や口座番号など絶対に読まれたくない箇所は「黒塗り」をご利用ください。
          </li>
        </ul>
      </section>

      <section className="space-y-2 border-t border-slate-100 pt-4">
        <h3 className="font-bold text-slate-900 text-sm">キーボードショートカット</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
          <div className="flex justify-between items-center gap-2">
            <span>元に戻す / やり直す</span>
            <kbd className="font-mono text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">Ctrl+Z / Y</kbd>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span>一時的に移動（パン）</span>
            <kbd className="font-mono text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">Space + ドラッグ</kbd>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span>枠を微調整（1px / 10px）</span>
            <kbd className="font-mono text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">矢印 / Shift+矢印</kbd>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span>ブラシ太さを変更</span>
            <kbd className="font-mono text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">[ / ]</kbd>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span>拡大 / 縮小 / フィット</span>
            <kbd className="font-mono text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">+ / - / 0</kbd>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span>選択解除 / 枠を削除</span>
            <kbd className="font-mono text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">Esc / Delete</kbd>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span>画像を直接貼り付け</span>
            <kbd className="font-mono text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">Ctrl+V</kbd>
          </div>
        </div>
      </section>

      <section className="space-y-2 border-t border-slate-100 pt-4">
        <h3 className="font-bold text-slate-900 text-sm">よくある質問</h3>
        <p>
          <strong className="text-slate-800">Q. 画像はサーバーに送信されますか？</strong>
          <br />
          いいえ。すべての処理はお使いのブラウザ内のCanvasで完結するため、外部サーバーへの送信は一切行いません。
        </p>
        <p>
          <strong className="text-slate-800">Q. 位置情報（Exif）は残りますか？</strong>
          <br />
          Canvasから新規画像として書き出すため、GPS位置情報や撮影端末などのExifメタデータは自動的に除去されます。
        </p>
      </section>
    </div>

    <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
      <button
        type="button"
        onClick={onClose}
        className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition"
      >
        閉じる
      </button>
    </div>
  </ModalShell>
);

interface SnsPreviewModalProps {
  open: boolean;
  imageDataUrl: string;
  onClose: () => void;
}

export const SnsPreviewModal: React.FC<SnsPreviewModalProps> = ({
  open,
  imageDataUrl,
  onClose,
}) => (
  <ModalShell open={open} onClose={onClose} titleId="snsModalTitle" maxWidthClass="max-w-md">
    <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-white">
      <div className="flex items-center gap-2">
        <Share2 className="w-4 h-4 text-slate-700" aria-hidden="true" />
        <h2 id="snsModalTitle" className="text-xs sm:text-sm font-bold text-slate-900">
          SNSタイムライン表示チェック
        </h2>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="閉じる"
        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>

    <div className="p-4 overflow-y-auto space-y-3 bg-slate-50">
      <p className="text-[11px] text-slate-500 text-center">
        タイムラインサイズに縮小された際の見え方や判読性を確認できます
      </p>
      <div className="border border-slate-200 rounded-xl p-3.5 bg-white">
        <div className="flex gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-900 flex items-center justify-center text-white font-bold text-xs shrink-0">
            PR
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-bold text-slate-900 truncate">プレビュー投稿</span>
              <span className="text-slate-500 truncate">@preview · 1分</span>
            </div>
            <p className="text-xs text-slate-800 mt-1 mb-2.5 leading-relaxed">
              制作中のスクリーンショットを一部ぼかして共有します。
            </p>
            <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
              {imageDataUrl && (
                <img
                  src={imageDataUrl}
                  alt="SNS投稿時の縮小プレビュー"
                  className="w-full h-auto max-h-80 object-contain mx-auto"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div className="px-4 py-3 border-t border-slate-200 bg-white flex justify-end">
      <button
        type="button"
        onClick={onClose}
        className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition"
      >
        編集に戻る
      </button>
    </div>
  </ModalShell>
);

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  title,
  description,
  confirmLabel,
  danger = true,
  onCancel,
  onConfirm,
}) => (
  <ModalShell open={open} onClose={onCancel} titleId="confirmModalTitle" maxWidthClass="max-w-xs">
    <div className="p-5 text-center">
      <div
        className={`w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center ${
          danger ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
        }`}
      >
        <AlertTriangle className="w-5 h-5" aria-hidden="true" />
      </div>
      <h2 id="confirmModalTitle" className="text-sm font-bold text-slate-900 mb-1.5">
        {title}
      </h2>
      <p className="text-xs text-slate-600 leading-relaxed mb-5">{description}</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`py-2.5 rounded-lg text-white font-semibold text-xs transition ${
            danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </ModalShell>
);
