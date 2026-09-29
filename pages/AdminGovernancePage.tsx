import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, History, Loader2, Shield, ShieldCheck, UserRoundCog } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { AdminAuditEntry, User, UserRole } from '../types';
import { Button } from '../components/Button';

type GovernanceSection = 'TEAM' | 'AUDIT';

export const AdminGovernancePage: React.FC = () => {
  const { currentUser, isLoading } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState<GovernanceSection>('TEAM');
  const [team, setTeam] = useState<User[]>([]);
  const [entries, setEntries] = useState<AdminAuditEntry[]>([]);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [filters, setFilters] = useState({ actorId: 'ALL', category: 'ALL', query: '' });
  const [newAdmin, setNewAdmin] = useState({ firstName: '', lastName: '', email: '' });

  const isPrimaryAdmin = currentUser?.role === UserRole.ADMIN && currentUser.adminLevel === 'PRIMARY';

  const loadGovernance = async () => {
    if (!isPrimaryAdmin) {
      setIsLoadingPage(false);
      return;
    }
    setIsLoadingPage(true);
    try {
      const [users, audit] = await Promise.all([apiService.users.getAll(), apiService.admin.listAudit()]);
      setTeam(users.filter(user => user.role === UserRole.ADMIN));
      setEntries(audit);
    } catch (error) {
      console.error('Unable to load governance', error);
      toast.error('Impossible de charger la gouvernance administrative.');
    } finally {
      setIsLoadingPage(false);
    }
  };

  useEffect(() => {
    if (!isLoading && (!currentUser || currentUser.role !== UserRole.ADMIN)) navigate('/');
    if (!isLoading) void loadGovernance();
  }, [currentUser, isLoading]);

  const addAdministrator = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await apiService.admin.createAdministrator(newAdmin);
      setNewAdmin({ firstName: '', lastName: '', email: '' });
      toast.success('Accès administrateur accordé.');
      await loadGovernance();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible de créer l’accès administrateur.');
    } finally {
      setIsSaving(false);
    }
  };

  const revokeAdministrator = async (admin: User) => {
    if (!window.confirm(`Retirer l’accès administrateur de ${admin.firstName} ${admin.lastName} ?`)) return;
    setIsSaving(true);
    try {
      await apiService.admin.revokeAdministrator(admin.id);
      toast.success(`Accès retiré pour ${admin.firstName} ${admin.lastName}.`);
      await loadGovernance();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible de retirer cet accès.');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredEntries = useMemo(() => entries.filter(entry => (
    (filters.actorId === 'ALL' || entry.actorId === filters.actorId) &&
    (filters.category === 'ALL' || entry.category === filters.category) &&
    `${entry.action} ${entry.summary} ${entry.targetId}`.toLowerCase().includes(filters.query.toLowerCase())
  )), [entries, filters]);

  if (isLoading || !currentUser || currentUser.role !== UserRole.ADMIN) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="border-b-4 border-haven-red bg-haven-navy px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl items-start justify-between gap-6">
          <div>
            <Link to="/admin/dashboard" className="inline-flex items-center gap-2 text-sm font-bold text-white/65 transition hover:text-white"><ArrowLeft size={16} />Retour à l’administration</Link>
            <div className="mt-6 flex items-center gap-3"><div className="rounded-xl bg-haven-red p-2 text-white"><Shield size={20} /></div><h1 className="font-heading text-3xl font-bold text-white">Gouvernance administrative</h1></div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70">Espace distinct de la gestion quotidienne : accès des administrateurs et historique des décisions prises dans le back-office.</p>
          </div>
          <div className="hidden rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-right sm:block"><p className="text-[10px] font-black uppercase tracking-widest text-white/60">Compte connecté</p><p className="mt-1 text-sm font-bold text-white">{currentUser.email}</p></div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="-mt-6 flex w-fit rounded-2xl border border-gray-100 bg-white p-1 shadow-card">
          <button onClick={() => setSection('TEAM')} className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition ${section === 'TEAM' ? 'bg-haven-navy text-white' : 'text-gray-500 hover:bg-gray-50'}`}><UserRoundCog size={17} />Administrateurs</button>
          <button onClick={() => setSection('AUDIT')} className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition ${section === 'AUDIT' ? 'bg-haven-navy text-white' : 'text-gray-500 hover:bg-gray-50'}`}><History size={17} />Journal des actions</button>
        </div>

        {!isPrimaryAdmin ? (
          <div className="mt-8 rounded-3xl border border-amber-100 bg-amber-50 p-8 shadow-card"><div className="flex items-start gap-4"><Shield className="mt-1 text-amber-600" /><div><h2 className="font-heading text-2xl font-bold text-haven-navy">Accès réservé à l’administrateur principal</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600">Cette page est prête. Votre compte <strong>{currentUser.email}</strong> sera le seul à pouvoir gérer les administrateurs et consulter le journal dès l’activation de son statut principal.</p></div></div></div>
        ) : isLoadingPage ? (
          <div className="flex min-h-64 items-center justify-center text-gray-400"><Loader2 className="mr-3 animate-spin" size={24} />Chargement…</div>
        ) : section === 'TEAM' ? (
          <div className="mt-8 space-y-7">
            <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-card">
              <h2 className="font-heading text-2xl font-bold text-haven-navy">Accorder un accès administrateur</h2>
              <p className="mt-2 text-sm text-gray-500">La personne doit déjà avoir créé son compte HAVEN avec l’adresse indiquée.</p>
              <form onSubmit={addAdministrator} className="mt-7 grid gap-4 md:grid-cols-4">
                <input required value={newAdmin.firstName} onChange={event => setNewAdmin({ ...newAdmin, firstName: event.target.value })} placeholder="Prénom" className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-haven-red" />
                <input required value={newAdmin.lastName} onChange={event => setNewAdmin({ ...newAdmin, lastName: event.target.value })} placeholder="Nom" className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-haven-red" />
                <input required type="email" value={newAdmin.email} onChange={event => setNewAdmin({ ...newAdmin, email: event.target.value })} placeholder="Adresse e-mail HAVEN" className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-haven-red" />
                <Button type="submit" disabled={isSaving} className="bg-haven-navy text-white">{isSaving ? <Loader2 className="animate-spin" size={17} /> : 'Accorder l’accès'}</Button>
              </form>
            </div>
            <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-card">
              <h2 className="font-heading text-2xl font-bold text-haven-navy">Équipe d’administration</h2>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {team.map(admin => <div key={admin.id} className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-gray-50 p-5"><img src={admin.avatarUrl} alt="" className="h-12 w-12 rounded-full border-2 border-white object-cover" /><div className="min-w-0 flex-1"><p className="truncate font-bold text-haven-navy">{admin.firstName} {admin.lastName}</p><p className="truncate text-xs text-gray-400">{admin.email}</p><p className={`mt-2 text-[10px] font-black uppercase tracking-widest ${admin.adminLevel === 'PRIMARY' ? 'text-amber-600' : 'text-haven-red'}`}>{admin.adminLevel === 'PRIMARY' ? 'Administrateur principal' : 'Administrateur'}</p></div>{admin.adminLevel !== 'PRIMARY' && <button onClick={() => void revokeAdministrator(admin)} disabled={isSaving} className="rounded-lg border border-red-100 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-haven-red hover:bg-red-50">Retirer</button>}</div>)}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-8 rounded-3xl border border-gray-100 bg-white p-8 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-5"><div><h2 className="font-heading text-2xl font-bold text-haven-navy">Journal des actions</h2><p className="mt-2 text-sm text-gray-500">Entrées immuables : auteur, action, élément concerné et date.</p></div><Button variant="outline" onClick={() => void loadGovernance()}><History size={16} className="mr-2" />Actualiser</Button></div>
            <div className="mt-7 grid gap-4 md:grid-cols-3"><select value={filters.actorId} onChange={event => setFilters({ ...filters, actorId: event.target.value })} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"><option value="ALL">Tous les administrateurs</option>{Array.from(new Map(entries.map(entry => [entry.actorId, entry.actorName])).entries()).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select><select value={filters.category} onChange={event => setFilters({ ...filters, category: event.target.value })} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"><option value="ALL">Toutes les catégories</option>{Array.from(new Set(entries.map(entry => entry.category))).sort().map(category => <option key={category} value={category}>{category}</option>)}</select><input value={filters.query} onChange={event => setFilters({ ...filters, query: event.target.value })} placeholder="Rechercher…" className="rounded-xl border border-gray-200 px-4 py-3 text-sm" /></div>
            <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[740px] text-left"><thead><tr className="border-b border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-400"><th className="p-4">Date</th><th className="p-4">Administrateur</th><th className="p-4">Action</th><th className="p-4">Élément</th><th className="p-4">Détail</th></tr></thead><tbody>{filteredEntries.map(entry => <tr key={entry.id} className="border-b border-gray-50 text-sm"><td className="p-4 whitespace-nowrap text-gray-500">{new Date(entry.createdAt).toLocaleString('fr-FR')}</td><td className="p-4 font-bold text-haven-navy">{entry.actorName}</td><td className="p-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black tracking-wider text-slate-600">{entry.action}</span></td><td className="p-4 text-gray-500">{entry.targetType} · {entry.targetId}</td><td className="p-4 text-gray-600">{entry.summary}</td></tr>)}</tbody></table>{filteredEntries.length === 0 && <p className="py-12 text-center text-sm text-gray-400">Aucune action enregistrée pour le moment.</p>}</div>
          </div>
        )}
      </div>
    </div>
  );
};
