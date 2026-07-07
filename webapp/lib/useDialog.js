import { useState, useRef } from 'react';
import Dialog from '../components/Dialog';

export function useDialog() {
  const [dialog, setDialog] = useState(null);
  const resolveRef = useRef(null);

  function showAlert(message) {
    return new Promise(resolve => {
      resolveRef.current = resolve;
      setDialog({ type: 'alert', message });
    });
  }

  function showConfirm(message, confirmLabel = 'Eliminar', icon = null) {
    return new Promise(resolve => {
      resolveRef.current = resolve;
      setDialog({ type: 'confirm', message, confirmLabel, icon });
    });
  }

  function handleClose(result) {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setDialog(null);
  }

  const dialogNode = dialog
    ? <Dialog {...dialog} onClose={handleClose} />
    : null;

  return { showAlert, showConfirm, dialogNode };
}
