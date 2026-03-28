import { useState, useEffect, createContext, useContext, useCallback } from "react";

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8 }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className="toast-enter"
            style={{
              background: "rgba(17, 19, 24, 0.95)",
              backdropFilter: "blur(16px)",
              border: `1px solid ${t.type === "success" ? "rgba(0,212,170,0.2)" : t.type === "error" ? "rgba(255,68,102,0.2)" : "rgba(255,255,255,0.06)"}`,
              borderRadius: "var(--radius-md)",
              padding: "12px 20px",
              fontFamily: "var(--font-body)",
              fontSize: 13,
              color: t.type === "success" ? "var(--accent)" : t.type === "error" ? "var(--negative)" : "var(--text-primary)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
              minWidth: 200,
            }}
          >
            {t.type === "success" ? "✓ " : t.type === "error" ? "✗ " : ""}{t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
