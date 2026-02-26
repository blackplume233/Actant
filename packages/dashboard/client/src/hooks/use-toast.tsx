import {
  createContext,
  useContext,
  useCallback,
  useState,
  useRef,
  type ReactNode,
} from "react";

export type ToastVariant = "default" | "success" | "error" | "warning";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
  action?: { label: string; onClick: () => void };
}

type AddToastOptions = Omit<Toast, "id"> & { id?: string };

interface ToastContextValue {
  toasts: Toast[];
  addToast: (opts: AddToastOptions) => string;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  addToast: () => "",
  removeToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

let globalIdCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (opts: AddToastOptions): string => {
      const id = opts.id ?? `toast-${++globalIdCounter}`;
      const toast: Toast = { ...opts, id };

      setToasts((prev) => {
        const filtered = prev.filter((t) => t.id !== id);
        return [...filtered, toast].slice(-5);
      });

      if (toast.duration > 0) {
        const timer = setTimeout(() => removeToast(id), toast.duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [removeToast],
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}
