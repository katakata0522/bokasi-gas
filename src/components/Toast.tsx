import React from 'react';

interface ToastProps {
  message: string | null;
  hasMobileSheet: boolean;
}

export const Toast: React.FC<ToastProps> = ({ message, hasMobileSheet }) => {
  // On mobile with active sheet, dock top-left inside the canvas clear of 元画像比較 (top-right) and bottom sheet.
  // On desktop with active image, float cleanly above the bottom Quick-Tool Dock centered over the canvas stage.
  const positionClass = hasMobileSheet
    ? 'top-16 left-3 max-w-[calc(100vw-138px)] lg:top-auto lg:left-[calc((100vw-356px)/2)] xl:left-[calc((100vw-372px)/2)] lg:-translate-x-1/2 lg:bottom-[68px] lg:max-w-[420px]'
    : 'bottom-6 left-1/2 -translate-x-1/2 max-w-[90vw]';

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed px-3.5 py-2 rounded-lg bg-slate-900/95 text-white text-xs font-medium shadow-lg z-50 truncate ${positionClass}`}
    >
      {message}
    </div>
  );
};
