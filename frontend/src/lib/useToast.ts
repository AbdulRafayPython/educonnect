import { useCallback, useState } from 'react';
import type { ToastMessage, ToastVariant } from '../components/Toast';

let nextId = 1;

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((variant: ToastVariant, title: string, body?: string) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, variant, title, body }]);
  }, []);

  return {
    toasts,
    dismiss,
    success: (title: string, body?: string) => show('success', title, body),
    error: (title: string, body?: string) => show('error', title, body),
    info: (title: string, body?: string) => show('info', title, body),
  };
}
