import React, { useEffect, useState } from 'react';

export interface ToastMessage {
  id: string;
  message: string;
  timestamp: number;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: () => void }> = ({
  toast,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="bg-slate-900/95 border border-rose-500/70 text-rose-200 text-xs font-mono px-3 py-2 rounded-xl shadow-2xl backdrop-blur-md flex items-start gap-2.5 pointer-events-auto transition-all animate-in fade-in slide-in-from-bottom-2">
      <span className="text-rose-400 font-bold shrink-0">⚠️</span>
      <span className="flex-1 leading-snug break-words">{toast.message}</span>
      <button
        onClick={onDismiss}
        className="text-slate-500 hover:text-slate-200 font-bold text-xs shrink-0 cursor-pointer p-0.5"
        title="Chiudi"
      >
        ✕
      </button>
    </div>
  );
};
