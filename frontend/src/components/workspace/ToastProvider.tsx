import * as React from 'react';
import { cva } from 'class-variance-authority';
import { CheckCircle2, Info, XCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastVariant = 'success' | 'info' | 'error';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

const toastVariants = cva(
  'pointer-events-auto flex w-80 items-start gap-3 rounded-xl border bg-card p-4 shadow-lg animate-fade-in',
  {
    variants: {
      variant: {
        success: 'border-emerald-200',
        info: 'border-primary-200',
        error: 'border-danger-500/30',
      },
    },
    defaultVariants: { variant: 'success' },
  },
);

const toastIcon: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />,
  info: <Info className="mt-0.5 h-5 w-5 text-primary-600" />,
  error: <XCircle className="mt-0.5 h-5 w-5 text-danger-500" />,
};

type ShowToast = (message: string, variant?: ToastVariant) => void;

const ToastContext = React.createContext<ShowToast>(() => {});

export function useToast() {
  return React.useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const show = React.useCallback<ShowToast>((message, variant = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, variant }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={cn(toastVariants({ variant: t.variant }))}>
            {toastIcon[t.variant]}
            <p className="flex-1 text-sm text-foreground">{t.message}</p>
            <button
              type="button"
              aria-label="Dismiss"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
