import { useEffect, useId, useRef, type ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  resultCount: number;
  children: ReactNode;
}

/**
 * Built on a modal <dialog>: showModal() makes the rest of the page inert, which
 * traps focus; Escape fires the native cancel/close; and focus returns to the
 * Filters button on close. Backdrop clicks land on the <dialog> element itself.
 */
export function MobileFilterDrawer({ open, onClose, resultCount, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);


  return (
    <dialog
      ref={ref}
      className="sb-drawer"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="sb-drawer__panel">
        <header className="sb-drawer__header">
          <h2 id={titleId}>Filters</h2>
          <button type="button" className="sb-icon-button" onClick={onClose} aria-label="Close filters">
            ×
          </button>
        </header>
        <div className="sb-drawer__body">{open && children}</div>
        <footer className="sb-drawer__footer">
          <button type="button" className="sb-button sb-button--block" onClick={onClose}>
            Show {resultCount} {resultCount === 1 ? 'result' : 'results'}
          </button>
        </footer>
      </div>
    </dialog>
  );
}
