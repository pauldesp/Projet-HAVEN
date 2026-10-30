import React, { useState } from 'react';
import { ChevronDown, ChevronUp, History, Loader2, ExternalLink } from 'lucide-react';
import type { AdminAuditEntry } from '../types';
import { Button } from './Button';
import { auditActionLabel, auditCategoryLabels, auditStatusLabel, filterAuditEntries, initialAuditFilter, readableAuditSummary, resolveAuditTarget, type AuditContext, type AuditFilter } from '../services/auditPresentation';

export function AdminAuditJournal({ entries, context, loading, error, onRefresh, onOpenTarget }: {
  entries: AdminAuditEntry[]; context: AuditContext; loading: boolean; error: string | null;
  onRefresh: () => void; onOpenTarget: (entry: AdminAuditEntry) => void;
}) {
  const [filter, setFilter] = useState<AuditFilter>(initialAuditFilter);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const change = (update: Partial<AuditFilter>) => { setFilter(previous => ({ ...previous, ...update })); setPage(1); };
  const filtered = filterAuditEntries(entries, filter, context);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const actors = Array.from(new Map(entries.map(entry => [entry.actorId, entry.actorName])).entries());
  const categories = Array.from(new Set(entries.map(entry => entry.category)));
  const actions = Array.from(new Set(entries.map(entry => entry.action))).sort((a, b) => auditActionLabel(a).localeCompare(auditActionLabel(b), 'fr'));
  const extraFilterCount = [filter.actorId !== 'ALL', filter.action !== 'ALL', Boolean(filter.from), Boolean(filter.to)].filter(Boolean).length;
  const hasFilters = Object.keys(initialAuditFilter).some(key => filter[key as keyof AuditFilter] !== initialAuditFilter[key as keyof AuditFilter]);
  const inputClass = 'mt-1 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal text-gray-700';
  return <section className="space-y-5 rounded-3xl border border-gray-100 bg-white p-5 shadow-card sm:p-7">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-2xl font-bold text-haven-navy">Journal des actions</h2><p className="mt-1 text-sm text-gray-500">Qui a fait quoi, sur quel élément et quand.</p></div><Button variant="outline" disabled={loading} onClick={onRefresh}>{loading ? <Loader2 size={16} className="mr-2 animate-spin"/> : <History size={16} className="mr-2"/>}Actualiser</Button></header>
    <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-0 w-full sm:min-w-[220px] flex-1 text-xs font-semibold text-gray-500">Rechercher<input value={filter.query} onChange={event => change({ query: event.target.value })} placeholder="Nom, logement, e-mail, action…" className={inputClass}/></label>
      <label className="w-full sm:w-52 text-xs font-semibold text-gray-500">Catégorie<select value={filter.category} onChange={event => change({ category: event.target.value })} className={inputClass}><option value="ALL">Toutes les catégories</option>{categories.map(category => <option key={category} value={category}>{auditCategoryLabels[category] || category}</option>)}</select></label>
    </div>
    <details className="rounded-xl border border-gray-100 px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold text-gray-600">Plus de filtres{extraFilterCount > 0 && ` (${extraFilterCount} actifs)`}</summary>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-semibold text-gray-500">Administrateur<select value={filter.actorId} onChange={event => change({ actorId: event.target.value })} className={inputClass}><option value="ALL">Tous les administrateurs</option>{actors.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label className="text-xs font-semibold text-gray-500">Action<select value={filter.action} onChange={event => change({ action: event.target.value })} className={inputClass}><option value="ALL">Toutes les actions</option>{actions.map(action => <option key={action} value={action}>{auditActionLabel(action)}</option>)}</select></label>
        <label className="text-xs font-semibold text-gray-500">Du<input type="date" value={filter.from} onChange={event => change({ from: event.target.value })} className={inputClass}/></label>
        <label className="text-xs font-semibold text-gray-500">Au<input type="date" value={filter.to} onChange={event => change({ to: event.target.value })} className={inputClass}/></label>
      </div>
    </details>
    {error && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{error}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500"><p><strong className="text-haven-navy">{filtered.length}</strong> action(s) · {new Set(filtered.map(entry => entry.actorId)).size} administrateur(s)</p>{hasFilters && <button onClick={() => { setFilter(initialAuditFilter); setPage(1); }} className="text-xs font-semibold text-haven-navy">Effacer les filtres</button>}</div>
    <div className="overflow-x-auto rounded-2xl border border-gray-100"><table className="haven-table w-full md:min-w-[850px] text-left text-sm"><thead className="bg-gray-50 text-xs text-gray-500"><tr><th className="p-3">Date et heure</th><th className="p-3">Administrateur</th><th className="p-3">Action réalisée</th><th className="p-3">Élément concerné</th><th className="p-3">Ce qui a été fait</th><th className="p-3">Détails</th></tr></thead><tbody className="divide-y divide-gray-100">
      {visible.map(entry => {
        const target = resolveAuditTarget(entry, context);
        const canOpen = target.available && ['USER', 'LISTING'].includes(entry.targetType);
        const time = new Date(entry.createdAt);
        const validDate = Number.isFinite(time.getTime());
        return <React.Fragment key={entry.id}><tr className="align-top hover:bg-gray-50">
          <td data-label="Date et heure" className="whitespace-nowrap p-3 text-xs text-gray-500"><p className="font-semibold text-gray-700">{validDate ? time.toLocaleDateString('fr-FR') : 'Date non renseignée'}</p><p className="mt-1">{validDate ? time.toLocaleTimeString('fr-FR') : ''}</p></td>
          <td data-label="Administrateur" className="p-3 font-semibold text-haven-navy">{entry.actorName}</td>
          <td data-label="Action réalisée" className="p-3"><p className="font-semibold text-haven-navy">{auditActionLabel(entry.action)}</p><p className="mt-1 text-xs text-gray-400">{auditCategoryLabels[entry.category] || entry.category}</p></td>
          <td data-label="Élément concerné" className="min-w-[180px] max-w-[250px] p-3">{canOpen ? <button className="inline-flex items-start gap-2 text-left font-semibold text-haven-navy hover:underline" onClick={() => onOpenTarget(entry)}>{target.label}<ExternalLink size={13} className="mt-1 shrink-0"/></button> : <p className="font-semibold text-haven-navy">{target.label}</p>}<p className="mt-1 break-words text-xs text-gray-500">{target.description}</p></td>
          <td data-label="Ce qui a été fait" className="min-w-[210px] max-w-sm p-3 text-gray-600">{entry.beforeStatus && entry.afterStatus && <p className="mb-1 text-xs font-semibold text-haven-navy">{auditStatusLabel(entry.beforeStatus)} → {auditStatusLabel(entry.afterStatus)}</p>}<p className="line-clamp-2 text-xs leading-relaxed">{readableAuditSummary(entry.summary)}</p></td>
          <td data-label="Détails" className="p-3"><button aria-label={`Détails de l’action ${auditActionLabel(entry.action)}`} aria-expanded={expanded === entry.id} className="rounded-lg border p-2 text-gray-500" onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}>{expanded === entry.id ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</button></td>
        </tr>{expanded === entry.id && <tr><td colSpan={6} className="bg-gray-50 p-5"><div className="space-y-3"><h3 className="font-bold text-haven-navy">{entry.actorName} · {auditActionLabel(entry.action)} · {target.label}</h3><p className="whitespace-pre-wrap text-gray-700">{readableAuditSummary(entry.summary)}</p>{entry.beforeStatus && entry.afterStatus && <p>Statut précédent : <strong>{auditStatusLabel(entry.beforeStatus)}</strong> · Nouveau statut : <strong>{auditStatusLabel(entry.afterStatus)}</strong></p>}<p className="text-xs text-gray-500">{target.historical ? 'Identité de l’élément enregistrée au moment de l’action.' : target.available ? 'Nom de l’élément identifié depuis sa fiche actuelle ; le texte original du journal est conservé.' : 'La fiche de cet élément n’est pas chargée ou n’est plus disponible.'}</p><details className="text-xs text-gray-500"><summary className="cursor-pointer">Références et texte d’origine</summary><div className="mt-2 space-y-1 break-all"><p>Action : {entry.action}</p><p>Élément : {entry.targetType} · {entry.targetId}</p><p>Entrée : {entry.id} · Administrateur : {entry.actorId}</p><p>Texte enregistré : {entry.summary}</p></div></details></div></td></tr>}</React.Fragment>;
      })}
    </tbody></table>{!loading && !filtered.length && <p className="p-10 text-center text-sm text-gray-500">{entries.length ? 'Aucune action ne correspond à ces filtres.' : 'Aucune action administrative enregistrée.'}</p>}{loading && <p className="p-8 text-center text-sm text-gray-500">Chargement du journal…</p>}</div>
    <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500"><p>Historique en lecture seule · {entries.length >= 250 ? '250 dernières actions chargées' : `${entries.length} actions chargées`}</p><div className="flex flex-wrap items-center gap-3"><label>Par page <select aria-label="Actions par page" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }} className="ml-2 rounded-lg border p-2">{[15, 25, 50].map(size => <option key={size}>{size}</option>)}</select></label><Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Précédent</Button><span>{currentPage} / {pageCount}</span><Button variant="outline" size="sm" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Suivant</Button></div></footer>
  </section>;
}
