import type { Incident } from '../types';
export function HavenFollowUpNotice({ followUp }: { followUp?: Incident['havenFollowUp'] }) {
  if (!followUp) return null;
  const label = followUp.status === 'WAITING_OWNER' ? 'Haven : en attente du propriétaire' : followUp.status === 'INVESTIGATING' ? 'Signalement en cours d’examen par Haven' : followUp.status === 'RESOLVED' ? 'Signalement résolu par Haven' : 'Signalement classé par Haven';
  return <div className="space-y-2 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-gray-700"><p className="font-bold text-haven-navy">{label}</p><p className="whitespace-pre-wrap">{followUp.note}</p>{followUp.reviewDate && <p className="text-xs text-gray-500">Réexamen prévu le {new Date(`${followUp.reviewDate}T12:00:00`).toLocaleDateString('fr-FR')} · suivi manuel</p>}</div>;
}
