import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  variant: ToastVariant;
  title: string;
  body?: string;
}

interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: number) => void;
}

const variantStyles: Record<ToastVariant, { bg: string; icon: string; iconColor: string }> = {
  success: { bg: 'bg-emerald-50 border-emerald-200', icon: 'check_circle', iconColor: 'text-emerald-600' },
  error: { bg: 'bg-error-container border-error/20', icon: 'error', iconColor: 'text-error' },
  info: { bg: 'bg-primary/10 border-primary/20', icon: 'info', iconColor: 'text-primary' },
};

function ToastItem({ toast, onDismiss }: ToastProps) {
  const style = variantStyles[toast.variant];

  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 4500);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 40, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.96, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className={`flex items-start gap-3 px-4 py-3 rounded-2xl border shadow-lg backdrop-blur-sm w-80 ${style.bg}`}
    >
      <span className={`material-symbols-outlined shrink-0 ${style.iconColor}`} style={{ fontSize: '1.3rem' }}>
        {style.icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-on-surface">{toast.title}</p>
        {toast.body && <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">{toast.body}</p>}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center hover:bg-black/5 text-on-surface-variant"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>
          close
        </span>
      </button>
    </motion.div>
  );
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="fixed top-5 right-5 z-[200] flex flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}
