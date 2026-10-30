import { useState } from 'react';
import { Loader2, XCircle } from 'lucide-react';
import { Button } from './Button';
import { apiService } from '../services/api';
import type { prepareVerificationException } from '../services/verificationException';
export function VerificationExceptionDialog({ targetType, targetId, label, revoke, onClose, onSaved }: {
  targetType: 'USER' | 'LISTING'; targetId: string; label: string; revoke: boolean;
  onClose: () => void; onSaved: (update: ReturnType<typeof prepareVerificationException>) => void;
}) {
  const [reason, setReason] = useState(revoke ? 'Fin de la période de test' : 'Tests de développement');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    if (!confirmed || !reason.trim() || saving) return;
    setSaving(true); setError('');
    try { onSaved(await apiService.admin.setVerificationException(targetType, targetId, revoke ? 'REVOKE' : 'GRANT', reason)); }
    catch (error) { setError(error instanceof Error ? error.message : 'Impossible d’enregistrer la dérogation.'); }
    finally { setSaving(false); }
  };
  return <div className="fixed inset-0 z-[140] flex items-center justify-center bg-haven-navy/60 p-4"><section role="dialog" aria-modal="true" aria-labelledby="exception-title" className="haven-dialog-panel w-full max-w-lg space-y-5 rounded-3xl bg-white p-6 shadow-xl">
    <header className="flex items-center justify-between gap-4"><h2 id="exception-title" className="text-xl font-bold text-haven-navy">{revoke ? 'Retirer la dérogation de test' : 'Validation exceptionnelle de test'}</h2><button aria-label="Fermer" disabled={saving} onClick={onClose}><XCircle/></button></header>
    <p className="font-semibold text-haven-navy">{label}</p>
    <p className="text-sm text-gray-600">{revoke ? 'L’élément repassera en attente. Une validation normale sera nécessaire pour conserver son accès.' : 'Cette action de l’administrateur principal autorise les parcours de test malgré un dossier incomplet. Elle ne vérifie ni les coordonnées ni les documents et reste identifiée comme une dérogation.'}</p>
    <label className="block text-sm font-bold text-haven-navy">Motif enregistré dans le journal<textarea rows={3} maxLength={2000} value={reason} disabled={saving} onChange={event => setReason(event.target.value)} className="mt-2 w-full rounded-xl border p-3 font-normal"/></label>
    <label className="flex items-start gap-3 text-sm text-gray-600"><input type="checkbox" checked={confirmed} disabled={saving} onChange={event => setConfirmed(event.target.checked)} className="mt-1"/>Je confirme cette décision exceptionnelle pour les tests.</label>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="flex justify-end gap-3"><Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button><Button onClick={() => void save()} disabled={saving || !confirmed || !reason.trim()}>{saving && <Loader2 size={16} className="mr-2 animate-spin"/>}{revoke ? 'Retirer la dérogation' : 'Forcer la validation'}</Button></div>
  </section></div>;
}
