"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export type ModalOptions = {
  title?: string;
  message?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  hideCancel?: boolean;
  danger?: boolean;
};

type InternalModal = ModalOptions & {
  id: number;
  resolve: (value: boolean) => void;
  isLeaving?: boolean;
  accepted?: boolean;
};

type ModalContextValue = {
  confirm: (options: ModalOptions) => Promise<boolean>;
  alert: (options: Omit<ModalOptions, "hideCancel" | "cancelText">) => Promise<void>;
};

const ModalContext = createContext<ModalContextValue | null>(null);

export function useModal(): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("useModal must be used within ModalProvider");
  return ctx;
}

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<InternalModal[]>([]);
  const confirm = useCallback((options: ModalOptions) => {
    return new Promise<boolean>((resolve) => {
      setStack((prev) => [...prev, { id: Date.now() + Math.random(), resolve, ...options }]);
    });
  }, []);
  const alert = useCallback(async (options: Omit<ModalOptions, "hideCancel" | "cancelText">) => {
    await confirm({ ...options, hideCancel: true });
  }, [confirm]);

  const value = useMemo(() => ({ confirm, alert }), [confirm, alert]);

  function onClose(id: number, accepted: boolean) {
    // Mark as leaving to play exit animation, then resolve and remove
    setStack((prev) => prev.map((m) => (m.id === id ? { ...m, isLeaving: true, accepted } : m)));
    // Delay removal slightly to allow exit animation to run
    window.setTimeout(() => {
      setStack((prev) => {
        const next = [...prev];
        const idx = next.findIndex((m) => m.id === id);
        if (idx !== -1) {
          const [m] = next.splice(idx, 1);
          m.resolve(m.accepted ?? accepted);
        }
        return next;
      });
    }, 180);
  }

  return (
    <ModalContext.Provider value={value}>
      {children}
      {stack.map((m) => (
        <div
          key={m.id}
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`modal-${m.id}-title`}
          data-leaving={m.isLeaving ? "" : undefined}
          onClick={(e) => {
            // Dismiss when clicking on the backdrop
            if (e.target === e.currentTarget) onClose(m.id, false);
          }}
        >
          <div
            className="modal-card"
            data-danger={m.danger ? "" : undefined}
            data-leaving={m.isLeaving ? "" : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            {m.title ? <h3 id={`modal-${m.id}-title`} className="modal-title">{m.title}</h3> : null}
            {m.message ? <div className="modal-body">{m.message}</div> : null}
            <div className="modal-actions">
              {!m.hideCancel ? (
                <button type="button" onClick={() => onClose(m.id, false)}>{m.cancelText || "Cancel"}</button>
              ) : null}
              <button type="button" className={m.danger ? "btn-danger" : ""} onClick={() => onClose(m.id, true)}>
                {m.confirmText || (m.hideCancel ? "OK" : "Confirm")}
              </button>
            </div>
          </div>
        </div>
      ))}
    </ModalContext.Provider>
  );
}


