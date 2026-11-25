import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSheet } from './useSheet';

/**
 * Confirmation and short-text dialogs in Haven's own style, replacing the browser's grey boxes
 * (window.confirm / window.prompt). Mount <HavenDialogHost /> once; call askConfirm / askText anywhere.
 */
type ConfirmOptions = { title: string; message?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean };
type TextOptions = ConfirmOptions & { label?: string; placeholder?: string; defaultValue?: string; minLength?: number; multiline?: boolean; mustEqual?: string };
type Request = ({ kind: 'confirm' } & ConfirmOptions) | ({ kind: 'text' } & TextOptions);
type Pending = { request: Request; resolve: (value: boolean | string | null) => void };

let open: ((pending: Pending) => void) | null = null;

export function askConfirm(options: ConfirmOptions): Promise<boolean> {
  if (!open) return Promise.resolve(window.confirm([options.title, options.message].filter(Boolean).join('\n\n')));
  return new Promise(resolve => open!({ request: { kind: 'confirm', ...options }, resolve: value => resolve(value === true) }));
}

export function askText(options: TextOptions): Promise<string | null> {
  if (!open) { const value = window.prompt(options.title, options.defaultValue); return Promise.resolve(value); }
  return new Promise(resolve => open!({ request: { kind: 'text', ...options }, resolve: value => resolve(typeof value === 'string' ? value : null) }));
}

function DialogView({ pending, onDone }: { pending: Pending; onDone: () => void }) {
  const { request } = pending;
  const titleId = useId();
  const [value, setValue] = useState(request.kind === 'text' ? request.defaultValue || '' : '');
  const answer = useRef<boolean | string | null>(null);
  const sheet = useSheet(() => { pending.resolve(answer.current); onDone(); }, { sheetBelow: 640 });
  const fieldRef = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { (request.kind === 'text' ? fieldRef.current : confirmRef.current)?.focus(); }, [request.kind]);
  const finish = (result: boolean | string | null) => { answer.current = result; sheet.requestClose(); };
  const text = value.trim();
  const valid = request.kind !== 'text' || (text.length >= (request.minLength ?? 1) && (!request.mustEqual || text === request.mustEqual));
  const submit = () => { if (valid) finish(request.kind === 'text' ? text : true); };
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') finish(request.kind === 'text' ? null : false); };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  });
  const field = 'mt-1 w-full rounded-xl border border-gray-200 px-3 text-base font-normal text-haven-ink focus:border-haven-navy focus:outline-none';
  return createPortal(<div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4">
    <div ref={sheet.backdropRef} aria-hidden="true" className="haven-backdrop absolute inset-0 bg-haven-navy/50 backdrop-blur-sm" onClick={() => finish(request.kind === 'text' ? null : false)} />
    <form ref={sheet.panelRef as React.RefObject<HTMLFormElement & HTMLDivElement>} role="dialog" aria-modal="true" aria-labelledby={titleId}
      onSubmit={event => { event.preventDefault(); submit(); }}
      className="haven-sheet haven-dialog-panel relative w-full max-w-md rounded-t-[1.75rem] bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[1.75rem]">
      <div {...sheet.dragProps} className="-mx-6 -mt-6 mb-2 px-6 pt-3 pb-1 sm:hidden"><div className="mx-auto h-1.5 w-12 rounded-full bg-gray-200" aria-hidden="true" /></div>
      <h2 id={titleId} className="font-heading text-xl font-normal text-haven-ink">{request.title}</h2>
      {request.message && <p className="mt-2 text-[15px] leading-relaxed text-haven-stone">{request.message}</p>}
      {request.kind === 'text' && <label className="mt-4 block text-sm font-semibold text-haven-ink">{request.label}
        {request.multiline
          ? <textarea ref={fieldRef} rows={3} value={value} placeholder={request.placeholder} onChange={event => setValue(event.target.value)} className={`${field} py-2`} />
          : <input ref={fieldRef} value={value} placeholder={request.placeholder} onChange={event => setValue(event.target.value)} className={`${field} h-11`} />}
      </label>}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={() => finish(request.kind === 'text' ? null : false)} className="min-h-11 rounded-xl px-4 font-semibold text-haven-stone hover:bg-gray-100">{request.cancelLabel || 'Annuler'}</button>
        <button ref={confirmRef} type="submit" disabled={!valid} className={`min-h-11 rounded-xl px-5 font-bold text-white disabled:opacity-40 ${request.danger ? 'bg-haven-red hover:bg-haven-red-deep' : 'bg-haven-navy hover:bg-haven-navy-deep'}`}>{request.confirmLabel || 'Confirmer'}</button>
      </div>
    </form>
  </div>, document.body);
}

export function HavenDialogHost() {
  const [queue, setQueue] = useState<Pending[]>([]);
  useEffect(() => {
    open = pending => setQueue(current => [...current, pending]);
    return () => { open = null; };
  }, []);
  const current = queue[0];
  return current ? <DialogView key={queue.length} pending={current} onDone={() => setQueue(rest => rest.slice(1))} /> : null;
}
