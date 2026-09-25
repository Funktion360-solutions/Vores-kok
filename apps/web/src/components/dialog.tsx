'use client';
import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

/** Accessible modal built on <dialog> (focus trap, Escape, backdrop). */
export function Dialog({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} aria-label={title}
      className={`m-auto w-[calc(100%-2rem)] ${wide ? 'max-w-2xl' : 'max-w-lg'} rounded-[var(--radius-card)] border border-line bg-paper p-0 text-ink shadow-2xl backdrop:bg-ink/40`}>
      {open ? (
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="text-xl font-semibold">{title}</h2>
            <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-sand" aria-label="Luk"><X className="size-5" /></button>
          </div>
          <div className="overflow-y-auto p-5">{children}</div>
        </div>
      ) : null}
    </dialog>
  );
}
