import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  HelpCircle
} from 'lucide-react';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const toastIdRef = useRef(0);

  // Add a toast
  const addToast = useCallback((type, message, title = '') => {
    const id = ++toastIdRef.current;
    const defaultTitles = {
      success: 'Success',
      error: 'Error',
      warning: 'Attention',
      info: 'Notice',
    };

    const newToast = {
      id,
      type,
      title: title || defaultTitles[type] || 'Notification',
      message: typeof message === 'string' ? message : JSON.stringify(message),
      timestamp: Date.now(),
    };

    setToasts((prev) => [...prev, newToast]);

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      removeToast(id);
    }, 4000);

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Convenient toast helpers
  const toast = {
    success: (msg, title) => addToast('success', msg, title),
    error: (msg, title) => addToast('error', msg, title),
    warning: (msg, title) => addToast('warning', msg, title),
    info: (msg, title) => addToast('info', msg, title),
  };

  // Promise-based confirm dialog (replaces window.confirm)
  const confirm = useCallback(
    ({
      title = 'Confirm Action',
      message = 'Are you sure you want to proceed?',
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      isDanger = false,
    }) => {
      return new Promise((resolve) => {
        setConfirmDialog({
          title,
          message,
          confirmText,
          cancelText,
          isDanger,
          onConfirm: () => {
            setConfirmDialog(null);
            resolve(true);
          },
          onCancel: () => {
            setConfirmDialog(null);
            resolve(false);
          },
        });
      });
    },
    []
  );

  return (
    <NotificationContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Floating Toasts Container (Top-Right) */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col space-y-2.5 max-w-sm w-full pointer-events-none px-3 sm:px-0">
        {toasts.map((t) => {
          const isSuccess = t.type === 'success';
          const isError = t.type === 'error';
          const isWarning = t.type === 'warning';
          const isInfo = t.type === 'info';

          return (
            <div
              key={t.id}
              className={`pointer-events-auto p-4 rounded-2xl shadow-xl border transition-all duration-200 transform translate-y-0 flex items-start space-x-3 bg-white ${
                isSuccess
                  ? 'border-emerald-200 ring-1 ring-emerald-400/20'
                  : isError
                  ? 'border-red-200 ring-1 ring-red-400/20'
                  : isWarning
                  ? 'border-amber-200 ring-1 ring-amber-400/20'
                  : 'border-blue-200 ring-1 ring-blue-400/20'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                {isError && <AlertCircle className="w-5 h-5 text-red-600" />}
                {isWarning && <AlertTriangle className="w-5 h-5 text-amber-600" />}
                {isInfo && <Info className="w-5 h-5 text-blue-600" />}
              </div>

              <div className="flex-1 min-w-0 pr-1">
                <p
                  className={`text-xs font-black uppercase tracking-wider ${
                    isSuccess
                      ? 'text-emerald-900'
                      : isError
                      ? 'text-red-900'
                      : isWarning
                      ? 'text-amber-900'
                      : 'text-blue-900'
                  }`}
                >
                  {t.title}
                </p>
                <p className="text-xs font-medium text-slate-600 mt-0.5 leading-snug break-words">
                  {t.message}
                </p>
              </div>

              <button
                onClick={() => removeToast(t.id)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start space-x-3.5">
              <div
                className={`p-3 rounded-2xl shrink-0 ${
                  confirmDialog.isDanger
                    ? 'bg-red-50 text-red-600 border border-red-200'
                    : 'bg-blue-50 text-blue-600 border border-blue-200'
                }`}
              >
                {confirmDialog.isDanger ? (
                  <AlertCircle className="w-6 h-6" />
                ) : (
                  <HelpCircle className="w-6 h-6" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-black text-slate-900 leading-snug">
                  {confirmDialog.title}
                </h3>
                <p className="text-xs font-medium text-slate-600 mt-1.5 leading-relaxed">
                  {confirmDialog.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={confirmDialog.onCancel}
                className="py-2.5 px-4 rounded-xl text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-100 transition"
              >
                {confirmDialog.cancelText}
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className={`py-2.5 px-5 rounded-xl text-xs font-bold text-white transition shadow-xs active:scale-98 ${
                  confirmDialog.isDanger
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationContext;
