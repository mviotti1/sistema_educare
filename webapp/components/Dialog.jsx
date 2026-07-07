import { useEffect } from 'react';
import { createPortal } from 'react-dom';

function WarnIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <circle cx="12" cy="17" r=".5" fill="currentColor"/>
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
      <path d="M10 11v6M14 11v6"/>
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
    </svg>
  );
}

function BlockIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
    </svg>
  );
}

export default function Dialog({ type, message, confirmLabel = 'Eliminar', icon = null, onClose }) {
  const isAlert = type === 'alert';

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose(false);
      if (e.key === 'Enter' && isAlert) onClose(true);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, isAlert]);

  return createPortal(
    <div className="dialog-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(false); }}>
      <div className="dialog-card" role="dialog" aria-modal="true">
        <div className={`dialog-icon-wrap dialog-icon-wrap--${isAlert ? 'warn' : 'danger'}`}>
          {isAlert ? <WarnIcon /> : icon === 'block' ? <BlockIcon /> : <TrashIcon />}
        </div>
        <p className="dialog-message">{message}</p>
        <div className="dialog-actions">
          {!isAlert && (
            <button className="btn btn-ghost" onClick={() => onClose(false)}>Cancelar</button>
          )}
          <button
            className={`btn ${isAlert ? 'btn-primary' : 'btn-danger'}`}
            onClick={() => onClose(isAlert ? true : true)}
            autoFocus
          >
            {isAlert ? 'Entendido' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
