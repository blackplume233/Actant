import { useEffect, useState } from "react";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast, type Toast, type ToastVariant } from "@/hooks/use-toast";

const variantConfig: Record<
  ToastVariant,
  { icon: typeof Info; bg: string; border: string; iconColor: string }
> = {
  default: {
    icon: Info,
    bg: "bg-background",
    border: "border-border",
    iconColor: "text-muted-foreground",
  },
  success: {
    icon: CheckCircle2,
    bg: "bg-background",
    border: "border-emerald-500/30",
    iconColor: "text-emerald-500",
  },
  error: {
    icon: AlertCircle,
    bg: "bg-background",
    border: "border-red-500/30",
    iconColor: "text-red-500",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-background",
    border: "border-amber-500/30",
    iconColor: "text-amber-500",
  },
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const config = variantConfig[toast.variant];
  const Icon = config.icon;

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 200);
  };

  return (
    <div
      className={cn(
        "pointer-events-auto flex w-80 items-start gap-3 rounded-lg border p-3 shadow-lg transition-all duration-200",
        config.bg,
        config.border,
        visible
          ? "translate-y-0 opacity-100"
          : "translate-y-2 opacity-0",
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", config.iconColor)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-3">
            {toast.description}
          </p>
        )}
        {toast.action && (
          <button
            className="mt-1.5 text-xs font-medium text-primary hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              toast.action!.onClick();
              handleDismiss();
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
        onClick={handleDismiss}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}
