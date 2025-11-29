import { useEffect, useState } from 'react'

/**
 * Toast Notification System - Financial Editorial Style
 *
 * Elegant, unobtrusive notifications that slide in from top-right
 * Matches the app's editorial aesthetic with serif typography for titles
 *
 * Usage:
 *   const toast = useToast()
 *   toast.success('Upload complete!')
 *   toast.error('Failed to upload', 'File size exceeds limit')
 *   toast.info('Processing document...')
 */

let toastId = 0
const listeners = new Set()

const toastManager = {
  show: (type, title, description = '', duration = 5000) => {
    const id = ++toastId
    const toast = { id, type, title, description, duration }
    listeners.forEach(listener => listener(toast))
    return id
  },

  success: (title, description) => toastManager.show('success', title, description),
  error: (title, description) => toastManager.show('error', title, description),
  warning: (title, description) => toastManager.show('warning', title, description),
  info: (title, description) => toastManager.show('info', title, description),
}

export const useToast = () => toastManager

export function ToastContainer() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const listener = (toast) => {
      setToasts(prev => [...prev, toast])

      // Auto-dismiss after duration
      if (toast.duration > 0) {
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== toast.id))
        }, toast.duration)
      }
    }

    listeners.add(listener)
    return () => listeners.delete(listener)
  }, [])

  const dismissToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast, index) => (
        <Toast
          key={toast.id}
          toast={toast}
          onDismiss={() => dismissToast(toast.id)}
          index={index}
        />
      ))}
    </div>
  )
}

function Toast({ toast, onDismiss, index }) {
  const [isExiting, setIsExiting] = useState(false)

  const handleDismiss = () => {
    setIsExiting(true)
    setTimeout(onDismiss, 200) // Match exit animation duration
  }

  const icons = {
    success: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  }

  const styles = {
    success: {
      bg: 'bg-[var(--color-success-light)]',
      border: 'border-[var(--color-success)]',
      icon: 'text-[var(--color-success)]',
    },
    error: {
      bg: 'bg-[var(--color-error-light)]',
      border: 'border-[var(--color-error)]',
      icon: 'text-[var(--color-error)]',
    },
    warning: {
      bg: 'bg-[var(--color-warning-light)]',
      border: 'border-[var(--color-warning)]',
      icon: 'text-[var(--color-warning)]',
    },
    info: {
      bg: 'bg-[var(--color-bg-secondary)]',
      border: 'border-[var(--color-border)]',
      icon: 'text-[var(--color-text-secondary)]',
    },
  }

  const style = styles[toast.type] || styles.info

  return (
    <div
      className={`
        pointer-events-auto
        min-w-[320px] max-w-md
        ${style.bg}
        border ${style.border}
        rounded-xl
        shadow-[var(--shadow-lg)]
        backdrop-blur-sm
        p-4
        flex items-start gap-3
        ${isExiting ? 'toast-exit' : 'toast-enter'}
      `}
      style={{
        animationDelay: `${index * 75}ms`
      }}
    >
      {/* Icon */}
      <div className={`flex-shrink-0 ${style.icon}`}>
        {icons[toast.type]}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-serif font-semibold text-sm text-[var(--color-text-primary)] mb-0.5">
          {toast.title}
        </p>
        {toast.description && (
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            {toast.description}
          </p>
        )}
      </div>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors p-1 -mr-1 -mt-1"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <style jsx>{`
        @keyframes toast-slide-in {
          from {
            transform: translateX(120%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes toast-slide-out {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(120%);
            opacity: 0;
          }
        }

        .toast-enter {
          animation: toast-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .toast-exit {
          animation: toast-slide-out 0.2s ease-in forwards;
        }
      `}</style>
    </div>
  )
}
