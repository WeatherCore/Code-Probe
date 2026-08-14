import { motion, AnimatePresence } from "motion/react";
import { XIcon, CheckCircleIcon, WarningIcon, XCircleIcon, InfoIcon } from "@phosphor-icons/react";
import { useToastStore, type ToastVariant } from "@/hooks/useToast";
import { cn } from "@/lib/utils";

// Toast 视觉配置：不同 variant 配不同图标和颜色
const iconMap: Record<ToastVariant, React.ReactNode> = {
  default: <InfoIcon size={18} className="text-info" />,
  success: <CheckCircleIcon size={18} className="text-accent" />,
  error: <XCircleIcon size={18} className="text-danger" />,
  warning: <WarningIcon size={18} className="text-warning" />,
};

// Toaster：固定在右下角，AnimatePresence 进出场动画
export function Toaster() {
  const { toasts, dismiss } = useToastStore();

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-lg border border-border bg-surface-elevated p-3.5 shadow-xl backdrop-blur"
            )}
          >
            <div className="mt-0.5 shrink-0">{iconMap[t.variant]}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground">{t.title}</div>
              {t.description && (
                <div className="mt-0.5 text-xs text-foreground-muted break-words">
                  {t.description}
                </div>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 rounded p-0.5 text-foreground-subtle hover:text-foreground hover:bg-surface-hover transition-colors"
            >
              <XIcon size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
