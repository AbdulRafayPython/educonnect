import Modal from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmClass =
    variant === 'danger'
      ? 'bg-error-container text-on-error-container hover:opacity-90'
      : 'academic-gradient text-white hover:opacity-90';

  const iconBg =
    variant === 'danger' ? 'bg-error-container/40 text-error' : 'bg-primary/10 text-primary';

  const icon = variant === 'danger' ? 'warning' : 'help';

  return (
    <Modal open={open} onClose={onCancel} maxWidth="sm">
      <div className="flex items-start gap-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          <span className="material-symbols-outlined" style={{ fontSize: '1.4rem' }}>
            {icon}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-extrabold text-primary">{title}</h3>
          <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">{message}</p>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button
          onClick={onCancel}
          className="px-5 py-2.5 text-sm font-bold text-on-surface-variant rounded-xl hover:bg-surface-container transition-colors"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          className={`px-5 py-2.5 text-sm font-bold rounded-xl shadow-md transition-all ${confirmClass}`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
