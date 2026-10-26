import { useState } from 'react';
import type { Report } from '../types';
import { Button } from './Button';
import { apiService } from '../services/api';
import { Loader2, XCircle } from 'lucide-react';
export function ReportOwnerWaitDialog({ report, onClose }: { report: Report; onClose: () => void }) {
  const [note, setNote] = useState(report.ownerMessage || 'La résolution de cet incident relève du propriétaire. Haven lui laisse le temps d’intervenir et conserve le suivi du signalement.');
  const [reviewDate, setReviewDate] = useState(report.ownerReviewDate || '');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    if (sending || !note.trim()) return;
    setSending(true); setError('');
    try { await apiService.reports.updateStatus(report.id, 'WAITING_OWNER', note, reviewDate); onClose(); }
    catch (error) { setError(error instanceof Error ? error.message : 'Impossible d’enregistrer cette décision.'); }
    finally { setSending(false); }
  };
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-haven-navy/60 p-4"><section role="dialog" aria-modal="true" aria-labelledby="owner-wait-title" className="w-full max-w-xl space-y-5 rounded-3xl bg-white p-6 shadow-xl">
    <header className="flex items-center justify-between gap-4"><h2 id="owner-wait-title" className="text-xl font-bold text-haven-navy">Laisser le propriétaire intervenir</h2><button aria-label="Fermer" disabled={sending} onClick={onClose}><XCircle/></button></header>
    <p className="text-sm text-gray-600">Le signalement reste ouvert et passe en attente du propriétaire. Vous pourrez reprendre son examen à tout moment.</p>
    <label className="block text-sm font-bold text-haven-navy">Message visible par le locataire et le propriétaire<textarea value={note} maxLength={2000} rows={5} disabled={sending} onChange={event => setNote(event.target.value)} className="mt-2 w-full rounded-xl border p-3 font-normal"/></label>
    <label className="block text-sm font-bold text-haven-navy">Date de réexamen (facultative)<input type="date" value={reviewDate} disabled={sending} onChange={event => setReviewDate(event.target.value)} className="mt-2 w-full rounded-xl border p-3 font-normal"/></label>
    <p className="text-xs text-gray-500">Cette date sert de repère. Aucun changement de statut ni signalement ne sera déclenché automatiquement.</p>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="flex justify-end gap-3"><Button variant="outline" onClick={onClose} disabled={sending}>Annuler</Button><Button onClick={() => void save()} disabled={sending || !note.trim()}>{sending && <Loader2 className="mr-2 animate-spin" size={16}/>}Mettre en attente du propriétaire</Button></div>
  </section></div>;
}
