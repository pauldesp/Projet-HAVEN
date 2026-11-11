import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { authenticatedFetch } from '../services/serverApi';
import { SYSTEM_TASKS, type SystemTask, type TaskHealth } from '../services/systemHealth';
import { mailKindLabel, mailStatusLabel, taskStatus } from '../services/adminMonitoring';
import { AdminErrors } from './AdminErrors';

type Mail = { id: string; kind: string; status: string; attempts: number; lastError: string; occurredAt: string; nextAttemptAt: string; sentAt: string; to: string };
type SystemData = { tasks: TaskHealth[]; counts: Record<string, number>; mails: Mail[]; mailConfigured: boolean; emailFrom: string; teamRecipient: boolean };

const when = (value?: string) => value ? new Date(value).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

/** Health of the automatic tasks and of the mail queue, with manual re-sending. */
export function AdminMonitoring() {
  const [data, setData] = useState<SystemData | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'PROBLEMS' | 'ALL'>('PROBLEMS');
  const [busy, setBusy] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      const response = await authenticatedFetch('/api/admin/system');
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Surveillance indisponible.');
      setData(payload);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Surveillance indisponible.'); }
  }, []);
  useEffect(() => { void load(); const timer = setInterval(() => void load(), 60_000); return () => clearInterval(timer); }, [load]);

  const mails = useMemo(() => (data?.mails || []).filter(mail => filter === 'ALL' || !['SENT', 'PENDING', 'SENDING'].includes(mail.status)), [data, filter]);
  const retry = async (id: string) => {
    setBusy(id);
    try {
      const response = await authenticatedFetch(`/api/admin/mail-outbox/${encodeURIComponent(id)}/retry`, { method: 'POST', body: '{}' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Renvoi impossible.');
      toast.success('Nouvel essai d’envoi lancé.');
      await load();
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Renvoi impossible.'); }
    finally { setBusy(''); }
  };

  if (error) return <div className="space-y-3"><p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p><button type="button" onClick={() => void load()} className="text-sm font-semibold underline">Réessayer</button></div>;
  if (!data) return <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" /> Chargement de la surveillance…</p>;

  return <section className="space-y-8">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-xl font-bold text-haven-navy">Surveillance</h2>
        <p className="mt-1 text-sm text-gray-500">État des tâches automatiques du serveur et des e-mails. Trois échecs de suite envoient une alerte par e-mail à l’équipe.</p>
      </div>
      <button type="button" onClick={() => void load()} className="flex min-h-11 items-center gap-1.5 self-start rounded-xl border border-gray-200 px-3 text-sm font-semibold text-haven-navy"><RefreshCw size={15} /> Actualiser</button>
    </div>

    <section className="space-y-3">
      <h3 className="font-bold text-haven-navy">Tâches automatiques</h3>
      <ul className="grid gap-3 md:grid-cols-2">
        {(Object.keys(SYSTEM_TASKS) as SystemTask[]).map(task => {
          const health = data.tasks.find(item => item.task === task);
          const status = taskStatus(task, health);
          return <li key={task} className="rounded-2xl border border-gray-200 p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold text-haven-navy"><span className={`h-2.5 w-2.5 rounded-full ${status.tone === 'ok' ? 'bg-green-500' : status.tone === 'warning' ? 'bg-orange-500' : status.tone === 'error' ? 'bg-haven-red' : 'bg-gray-300'}`} aria-hidden="true" />{SYSTEM_TASKS[task]}</p>
            <p className="mt-1 text-gray-600">{status.label}</p>
            <p className="mt-1 text-xs text-gray-400">Dernière réussite : {when(health?.lastSuccessAt)}{health?.lastErrorAt ? ` · dernier échec : ${when(health.lastErrorAt)}` : ''}</p>
            {health?.consecutiveFailures ? <p className="mt-1 break-words text-xs text-haven-red">{health.lastError}</p> : null}
          </li>;
        })}
      </ul>
    </section>

    <AdminErrors />

    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-bold text-haven-navy">E-mails</h3>
        <div className="flex gap-2">
          {(['PROBLEMS', 'ALL'] as const).map(value => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${filter === value ? 'border-haven-navy bg-haven-navy text-white' : 'border-gray-200 text-haven-navy'}`}>{value === 'PROBLEMS' ? 'À vérifier' : 'Tous les récents'}</button>)}
        </div>
      </div>
      <p className="text-sm text-gray-600">{data.mailConfigured ? `Expéditeur : ${data.emailFrom}` : 'Fournisseur d’e-mails non configuré : aucun message ne part.'}{data.emailFrom.includes('resend.dev') ? ' · domaine de démonstration : seuls les envois vers l’adresse du titulaire Resend sont possibles.' : ''}{!data.teamRecipient ? ' · aucune adresse d’équipe pour les alertes.' : ''}</p>
      <p className="flex flex-wrap gap-2 text-xs">{Object.entries(data.counts).sort().map(([status, count]) => <span key={status} className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">{mailStatusLabel(status)} : {count}</span>)}</p>
      <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
        {mails.map(mail => <li key={mail.id} className="flex flex-col gap-2 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-semibold text-haven-navy">{mailKindLabel(mail.kind)} · <span className={mail.status === 'SENT' ? 'text-green-700' : ['RETRY', 'REVIEW_REQUIRED', 'WAITING_DOMAIN'].includes(mail.status) ? 'text-haven-red' : 'text-gray-600'}>{mailStatusLabel(mail.status)}</span></p>
            <p className="break-all text-xs text-gray-500">{mail.to || 'destinataire déterminé à l’envoi'} · {mail.sentAt ? `envoyé ${when(mail.sentAt)}` : `événement ${when(mail.occurredAt)}`}{mail.attempts ? ` · ${mail.attempts} essai(s)` : ''}</p>
            {mail.lastError && <p className="text-xs text-haven-red">{mail.lastError}</p>}
          </div>
          {mail.status !== 'SENT' && <button type="button" disabled={busy === mail.id} onClick={() => void retry(mail.id)} className="min-h-11 shrink-0 rounded-xl border border-gray-200 px-3 font-semibold text-haven-navy disabled:opacity-40">{busy === mail.id ? 'Envoi…' : 'Renvoyer'}</button>}
        </li>)}
        {!mails.length && <li className="p-8 text-center text-sm text-gray-500">{filter === 'PROBLEMS' ? 'Aucun e-mail en difficulté.' : 'Aucun e-mail récent.'}</li>}
      </ul>
    </section>
  </section>;
}
