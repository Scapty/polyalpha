import { useState, useCallback, createContext, useContext } from "react";

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
            className="animate-fade-in-up"
            style={{
              background: "var(--bg-elevated)",
              border: `1px solid ${t.type === "success" ? "rgba(16,185,129,0.2)" : t.type === "error" ? "rgba(239,68,68,0.2)" : "var(--border)"}`,
              borderRadius: 0,
              padding: "12px 20px",
              fontFamily: "var(--font-body)",
              fontSize: 13,
              color: t.type === "success" ? "var(--green)" : t.type === "error" ? "var(--red)" : "var(--text-primary)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              minWidth: 200,
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
