import { useEffect, useState, useCallback } from "react";

/**
 * Premium Toast Notification System
 *
 * Beautiful, crystal-clear notifications with:
 * - Glassmorphism effect
 * - Smooth spring animations
 * - Colored accent bars
 * - Progress indicator
 * - Theme-aware design
 */

let toastId = 0;
const listeners = new Set();

const toastManager = {
  show: (type, title, description = "", duration = 4000) => {
    const id = ++toastId;
    const toast = {
      id,
      type,
      title,
      description,
      duration,
      createdAt: Date.now(),
    };
    listeners.forEach((listener) => listener(toast));
    return id;
  },

  success: (title, description) =>
    toastManager.show("success", title, description),
  error: (title, description) =>
    toastManager.show("error", title, description, 6000),
  warning: (title, description) =>
    toastManager.show("warning", title, description, 5000),
  info: (title, description) => toastManager.show("info", title, description),
};

export const useToast = () => toastManager;

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const listener = (toast) => {
      setToasts((prev) => [...prev, toast]);
    };

    listeners.add(listener);
    return () => listeners.delete(listener);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isExiting: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col-reverse gap-3">
      {toasts.map((toast, index) => (
        <Toast
          key={toast.id}
          toast={toast}
          onDismiss={() => dismissToast(toast.id)}
          index={index}
          total={toasts.length}
        />
      ))}
    </div>
  );
}

function Toast({ toast, onDismiss, index, total }) {
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (toast.duration <= 0 || isPaused || toast.isExiting) return;

    const startTime = Date.now();
    const endTime = startTime + toast.duration;

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, endTime - now);
      const newProgress = (remaining / toast.duration) * 100;
      setProgress(newProgress);

      if (remaining <= 0) {
        clearInterval(interval);
        onDismiss();
      }
    }, 30);

    return () => clearInterval(interval);
  }, [toast.duration, toast.isExiting, isPaused, onDismiss]);

  // Toast configurations
  const config = {
    success: {
      gradient: "from-emerald-500 to-emerald-600",
      glow: "shadow-emerald-500/25",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      text: "text-emerald-600 dark:text-emerald-400",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24">
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M5 13l4 4L19 7"
          />
        </svg>
      ),
    },
    error: {
      gradient: "from-red-500 to-red-600",
      glow: "shadow-red-500/25",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
      text: "text-red-600 dark:text-red-400",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24">
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      ),
    },
    warning: {
      gradient: "from-amber-500 to-orange-500",
      glow: "shadow-amber-500/25",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      text: "text-amber-600 dark:text-amber-400",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24">
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M12 9v3m0 4h.01M12 3l9.5 16.5H2.5L12 3z"
          />
        </svg>
      ),
    },
    info: {
      gradient: "from-blue-500 to-indigo-500",
      glow: "shadow-blue-500/25",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
      text: "text-blue-600 dark:text-blue-400",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24">
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
  };

  const { gradient, glow, bg, border, text, icon } =
    config[toast.type] || config.info;

  return (
    <div
      className={`
        pointer-events-auto
        w-[380px]
        rounded-2xl
        overflow-hidden
        backdrop-blur-xl
        bg-[var(--color-bg-primary)]/95
        border
        ${border}
        shadow-2xl
        ${glow}
        transition-all duration-300 ease-out
        ${toast.isExiting ? "animate-toast-out" : "animate-toast-in"}
      `}
      style={{
        transform: toast.isExiting ? undefined : `translateY(${index * -4}px)`,
        zIndex: total - index,
      }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Colored top accent bar */}
      <div className={`h-1 w-full bg-gradient-to-r ${gradient}`} />

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div
            className={`
              flex-shrink-0 
              w-10 h-10 
              rounded-xl 
              ${bg}
              ${text}
              flex items-center justify-center
              ring-1 ring-inset ${border}
            `}
          >
            {icon}
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0 pt-0.5">
            <h4 className="font-semibold text-[15px] text-[var(--color-text-primary)] leading-tight">
              {toast.title}
            </h4>
            {toast.description && (
              <p className="mt-1.5 text-sm text-[var(--color-text-secondary)] leading-relaxed">
                {toast.description}
              </p>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={onDismiss}
            className="
              flex-shrink-0 
              p-2 
              -mr-2 -mt-1
              rounded-xl
              text-[var(--color-text-tertiary)] 
              hover:text-[var(--color-text-primary)] 
              hover:bg-[var(--color-bg-tertiary)]
              transition-all duration-200
            "
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-1 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-100 ease-linear`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
