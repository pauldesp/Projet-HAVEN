import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, X } from 'lucide-react';
import { OwnerAccessInstructions } from './OwnerAccessInstructions';
import { useLanguage } from '../contexts/LanguageContext';

export function OwnerStayGuideButton({ listingId, title }: { listingId: string; title: string }) {
  const { tr } = useLanguage();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); };
  }, [open]);
  return <><button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-haven-navy"><BookOpen size={16} />{tr('Guide du séjour')}</button>
    {open && createPortal(<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-haven-navy/60 p-4 backdrop-blur-sm" onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}><section role="dialog" aria-modal="true" aria-label={tr('Guide du séjour')} className="haven-dialog-panel flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"><header className="flex items-center justify-between gap-4 border-b border-gray-100 p-5"><h2 className="font-bold text-haven-navy">{title}</h2><button autoFocus type="button" onClick={() => setOpen(false)} aria-label={tr('Fermer')} className="rounded-full bg-gray-100 p-3"><X size={20} /></button></header><div className="haven-dialog-scroll overflow-y-auto p-4"><OwnerAccessInstructions listingId={listingId} /></div></section></div>, document.body)}
  </>;
}
