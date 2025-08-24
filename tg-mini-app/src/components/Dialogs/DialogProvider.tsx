import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { dialogService, type PopupButton } from '../../services/dialogService';
import './DialogProvider.scss';

type PopupState = {
  title: string;
  message: string;
  buttons: PopupButton[];
  cb?: (id?: string) => void;
} | null;

type ConfirmState = {
  message: string;
  cb: (confirmed: boolean) => void;
} | null;

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [popup, setPopup] = useState<PopupState>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const showPopup = useCallback((args: { title: string; message: string; buttons?: PopupButton[] }, cb?: (id?: string) => void) => {
    setPopup({ title: args.title, message: args.message, buttons: args.buttons || [{ type: 'ok' }], cb });
  }, []);

  const showConfirm = useCallback((message: string, cb: (confirmed: boolean) => void) => {
    setConfirm({ message, cb });
  }, []);

  // Bind imperative service on mount
  useEffect(() => {
    dialogService.bind(showPopup, showConfirm);
    return () => dialogService.unbind();
  }, [showPopup, showConfirm]);

  // Global Esc to close dialogs
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Prevent other global handlers (like navigation/back)
      e.preventDefault();
      e.stopPropagation();
      if (popup) {
        // Prefer cancel button if exists
        const cancel = popup.buttons.find((b) => b.type === 'cancel');
        setPopup(null);
        popup.cb?.(cancel?.id ?? cancel?.type);
        return;
      }
      if (confirm) {
        setConfirm(null);
        confirm.cb(false);
      }
    };
    if (popup || confirm) {
      document.addEventListener('keydown', onKeyDown, { capture: true } as any);
      return () => document.removeEventListener('keydown', onKeyDown, { capture: true } as any);
    }
  }, [popup, confirm]);

  const portalRoot = typeof document !== 'undefined' ? document.body : null;

  const popupNode = useMemo(() => {
    if (!popup) return null;
    const onOverlayClick = (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        // Outside click acts like cancel if available
        const cancel = popup.buttons.find((b) => b.type === 'cancel');
        setPopup(null);
        popup.cb?.(cancel?.id ?? cancel?.type);
      }
    };
    return (
      <div className="dialog-overlay" onClick={onOverlayClick} role="dialog" aria-modal="true">
        <div className="dialog" onClick={(e) => e.stopPropagation()}>
          <div className="dialog-title">{popup.title}</div>
          <div className="dialog-message">{popup.message}</div>
          <div className="dialog-actions">
            {popup.buttons.map((b, i) => {
              const label = b.text || (b.type === 'ok' ? 'OK' : b.type === 'cancel' ? 'Cancel' : 'Delete');
              return (
                <button
                  key={(b.id || b.type || '') + i}
                  className={`dialog-btn ${b.type}`}
                  onClick={() => {
                    setPopup(null);
                    popup.cb?.(b.id ?? b.type);
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }, [popup]);

  const confirmNode = useMemo(() => {
    if (!confirm) return null;
    const onOverlayClick = (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        setConfirm(null);
        confirm.cb(false);
      }
    };
    return (
      <div className="dialog-overlay" onClick={onOverlayClick} role="dialog" aria-modal="true">
        <div className="dialog" onClick={(e) => e.stopPropagation()}>
          <div className="dialog-title">Confirm</div>
          <div className="dialog-message">{confirm.message}</div>
          <div className="dialog-actions">
            <button
              className="dialog-btn cancel"
              onClick={() => {
                setConfirm(null);
                confirm.cb(false);
              }}
            >
              Cancel
            </button>
            <button
              className="dialog-btn ok"
              onClick={() => {
                setConfirm(null);
                confirm.cb(true);
              }}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    );
  }, [confirm]);

  return (
    <>
      {children}
      {portalRoot && (popupNode || confirmNode) ? ReactDOM.createPortal(
        <>
          {popupNode}
          {confirmNode}
        </>,
        portalRoot
      ) : null}
    </>
  );
};

export default DialogProvider;
