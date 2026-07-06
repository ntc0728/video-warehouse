import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';

interface ToastContextValue {
  show: (msg: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

export function usePlayerToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((msg: string, duration = 2000) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMessage(msg);
    timerRef.current = setTimeout(() => {
      setMessage(null);
      timerRef.current = null;
    }, duration);
  }, []);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {message && (
        <div className="up-player-toast">
          {message}
        </div>
      )}
    </ToastContext.Provider>
  );
}
