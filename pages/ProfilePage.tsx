
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { User, Listing, UserRole } from '../types';
import { ShieldCheck, Shield, Star, Calendar, Briefcase, GraduationCap, Loader2, Home, CheckCircle2, FileText, HelpCircle, LogOut, ChevronRight, UserRound, Mail, LockKeyhole, ClipboardCheck } from 'lucide-react';
import { Button } from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { userFacingErrorMessage } from '../services/errorHandling';

interface AdminProfileViewProps {
  user: User;
  memberSince: string;
  onOpenAdministration: () => void;
  onLogout: () => void;
}

const AdminProfileView: React.FC<AdminProfileViewProps> = ({ user, memberSince, onOpenAdministration, onLogout }) => (
  <div className="min-h-screen bg-haven-cream pb-20 font-body">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 md:pt-12">
      <div className="mb-8 flex items-center gap-3 text-haven-red">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-haven-red/10"><Shield size={22} /></div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em]">HAVEN</p>
          <p className="text-sm font-semibold text-haven-navy">Espace administrateur privé</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-10">
        <aside className="lg:col-span-1">
          <div className="sticky top-24 rounded-3xl border border-gray-100 bg-white p-7 text-center shadow-soft md:rounded-[2.5rem] md:p-8">
            <div className="relative mx-auto mb-5 h-32 w-32">
              <img src={user.avatarUrl} alt={`${user.firstName} ${user.lastName}`} className="h-full w-full rounded-full border-4 border-white object-cover shadow-xl" />
              <div className="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full border-4 border-white bg-haven-navy text-white shadow-lg" title="Accès administrateur actif"><ShieldCheck size={19} /></div>
            </div>
            <h1 className="font-heading text-2xl font-bold text-haven-navy">{user.firstName} {user.lastName}</h1>
            <p className="mt-2 text-[11px] font-black uppercase tracking-[0.17em] text-haven-red">{user.adminLevel === 'PRIMARY' ? 'Administrateur principal HAVEN' : 'Administrateur HAVEN'}</p>

            <div className="mt-7 space-y-4 border-t border-gray-100 pt-6 text-left">
              <div className="flex items-center gap-3 text-sm text-gray-600"><Mail size={17} className="text-haven-stone" /><span className="truncate">{user.email}</span></div>
              <div className="flex items-center gap-3 text-sm text-gray-600"><Calendar size={17} className="text-haven-stone" /><span>Membre depuis {memberSince}</span></div>
            </div>

            <button onClick={onOpenAdministration} className="mt-7 w-full rounded-xl bg-haven-navy px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-haven-navy/90">Ouvrir l’administration</button>
            <button onClick={onLogout} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-haven-red transition-colors hover:bg-red-100"><LogOut size={17} /> Se déconnecter</button>
          </div>
        </aside>

        <section className="space-y-6 lg:col-span-2">
          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-soft md:rounded-[2.5rem] md:p-10">
            <h2 className="font-heading text-2xl font-bold text-haven-navy md:text-3xl">Mon compte administrateur</h2>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-gray-600">Cet espace est strictement interne à HAVEN. Il n’est pas présenté aux locataires, aux propriétaires ou aux visiteurs de la plateforme.</p>

            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-haven-navy/5 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-haven-navy text-white"><ShieldCheck size={20} /></div>
                <p className="mt-4 text-sm font-bold text-haven-navy">{user.adminLevel === 'PRIMARY' ? 'Accès principal' : 'Accès administrateur'}</p>
                <p className="mt-1 text-sm text-gray-500">{user.adminLevel === 'PRIMARY' ? 'Gestion des accès administrateurs et consultation de leur historique.' : 'Compte approuvé et accès actif.'}</p>
              </div>
              <div className="rounded-2xl bg-blue-50 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white"><LockKeyhole size={19} /></div>
                <p className="mt-4 text-sm font-bold text-haven-navy">Profil confidentiel</p>
                <p className="mt-1 text-sm text-gray-500">Aucune note, aucun avis ni visibilité auprès des membres.</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-soft md:rounded-[2.5rem] md:p-10">
            <div className="flex items-center gap-3"><ClipboardCheck className="text-haven-red" size={24} /><h2 className="font-heading text-xl font-bold text-haven-navy md:text-2xl">Périmètre d’administration</h2></div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                ['Comptes', 'Validation des dossiers et gestion des accès.'],
                ['Annonces', 'Contrôle des logements et de leur publication.'],
                [user.adminLevel === 'PRIMARY' ? 'Supervision' : 'Assistance', user.adminLevel === 'PRIMARY' ? 'Gestion des administrateurs et consultation du journal des actions.' : 'Traitement des contacts, incidents et signalements.'],
              ].map(([title, description]) => (
                <div key={title} className="rounded-2xl border border-gray-100 p-4">
                  <p className="font-bold text-haven-navy">{title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
);

export const ProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser, logout, refreshUser } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isVisibilityUpdating, setIsVisibilityUpdating] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const userData = await apiService.users.getById(id);
        if (userData) {
          setUser(userData);
          // Administrative accounts have no public listings or community profile.
          if (userData.role !== UserRole.ADMIN) {
            const allListings = await apiService.listings.getAll();
            const userListings = allListings.filter(l => l.ownerId === id && l.status === 'APPROVED');
            setListings(userListings);
          } else {
            setListings([]);
          }
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-haven-cream">
        <Loader2 className="animate-spin text-haven-navy" size={48} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-haven-cream">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-haven-navy mb-4">Utilisateur non trouvé</h2>
          <Link to="/">
            <Button variant="primary">Retour à l'accueil</Button>
          </Link>
        </div>
      </div>
    );
  }

  const memberSince = user.createdAt 
    ? new Date(user.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : "Mars 2026";
  const isOwnProfile = currentUser?.id === user.id;
  const isAdminProfile = user.role === UserRole.ADMIN;

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleHousemateVisibility = async () => {
    if (!isOwnProfile) return;
    setIsVisibilityUpdating(true);
    try {
      const nextVisibility = !user.shareProfileWithHousemates;
      await apiService.users.setHousemateVisibility(nextVisibility);
      setUser(current => current ? { ...current, shareProfileWithHousemates: nextVisibility } : current);
      await refreshUser();
      toast.success(nextVisibility ? 'Votre profil peut désormais être présenté aux futurs colocataires.' : 'Votre profil n’est plus présenté aux futurs colocataires.');
    } catch (error) {
      console.error('Impossible de mettre à jour la visibilité du profil', error);
      toast.error(userFacingErrorMessage(error));
    } finally {
      setIsVisibilityUpdating(false);
    }
  };

  if (isAdminProfile && currentUser?.role !== UserRole.ADMIN) {
    return (
      <div className="min-h-screen bg-haven-cream flex items-center justify-center px-6">
        <div className="max-w-md rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-soft">
          <LockKeyhole className="mx-auto text-haven-red" size={32} />
          <h1 className="mt-4 text-xl font-bold text-haven-navy">Profil réservé à l’administration</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">Les profils administrateurs sont privés et ne sont pas visibles par les membres de HAVEN.</p>
          <Link to="/" className="mt-6 inline-flex"><Button variant="primary">Retour à l’accueil</Button></Link>
        </div>
      </div>
    );
  }

  if (isAdminProfile) {
    return <AdminProfileView user={user} memberSince={memberSince} onOpenAdministration={() => navigate('/admin/dashboard')} onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen bg-haven-cream pb-20 font-body">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-5 md:pt-12">
        {isOwnProfile && (
          <div className="mb-4 px-1 md:hidden">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-haven-red">Mon compte</p>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-12">
          
          {/* Left Column: Avatar & Stats */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl md:rounded-[2.5rem] shadow-soft md:shadow-premium p-5 md:p-8 border border-gray-50 sticky top-24">
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-4 md:mb-6">
                  <img 
                    src={user.avatarUrl} 
                    alt={`${user.firstName} ${user.lastName}`} 
                    className="w-28 h-28 md:w-40 md:h-40 rounded-full object-cover border-4 border-white shadow-xl"
                  />
                  {user.status === 'APPROVED' && (
                    <div className="absolute bottom-2 right-2 bg-green-500 text-white p-1.5 rounded-full border-4 border-white shadow-lg" title="Identité vérifiée">
                      <ShieldCheck size={20} />
                    </div>
                  )}
                </div>
                
                <h1 className="text-2xl md:text-3xl font-heading font-bold text-haven-navy mb-1">
                  {user.firstName} {user.lastName}
                </h1>
                <p className="text-gray-500 font-medium mb-6 uppercase tracking-widest text-[10px]">
                  {user.role === 'OWNER' ? 'Propriétaire' : user.role === 'ADMIN' ? 'Administrateur' : 'Locataire'}
                </p>

                <div className="grid grid-cols-2 gap-3 md:gap-4 w-full mb-5 md:mb-8">
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <div className="flex items-center justify-center gap-1 text-haven-navy font-black text-xl mb-1">
                      {user.rating || 4.8} <Star size={16} className="fill-haven-red text-haven-red" />
                    </div>
                    <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Note moyenne</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <div className="text-haven-navy font-black text-xl mb-1">
                      {user.reviewsCount || 12}
                    </div>
                    <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Avis reçus</p>
                  </div>
                </div>

                <div className="w-full space-y-3 md:space-y-4 border-t border-gray-100 pt-5 md:pt-6 text-left">
                  <div className="flex items-center gap-3 text-gray-600">
                    <Calendar size={18} className="text-haven-stone" />
                    <span className="text-sm">Membre depuis {memberSince}</span>
                  </div>
                  {user.school && (
                    <div className="flex items-center gap-3 text-gray-600">
                      <GraduationCap size={18} className="text-haven-stone" />
                      <span className="text-sm">Étudie à {user.school}</span>
                    </div>
                  )}
                  {user.job && (
                    <div className="flex items-center gap-3 text-gray-600">
                      <Briefcase size={18} className="text-haven-stone" />
                      <span className="text-sm">Travaille comme {user.job}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Bio & Listings */}
          <div className="lg:col-span-2 space-y-5 md:space-y-12">

            {isOwnProfile && (
              <div className="space-y-2 md:hidden">
                <div className="flex w-full items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-soft">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-haven-navy/5 text-haven-navy"><UserRound size={20} /></div>
                  <div className="min-w-0 flex-1"><p className="font-bold text-haven-navy">Mon profil public</p><p className="text-xs text-gray-400">Présentation visible par la communauté</p></div>
                  <ChevronRight size={19} className="text-gray-300" />
                </div>
                <button onClick={() => navigate('/dashboard')} className="flex w-full items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-soft">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><FileText size={20} /></div>
                  <div className="min-w-0 flex-1"><p className="font-bold text-haven-navy">Identité et documents</p><p className="text-xs text-gray-400">Justificatifs et documents de séjour</p></div>
                  <ChevronRight size={19} className="text-gray-300" />
                </button>
                <button onClick={() => navigate('/help')} className="flex w-full items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-soft">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-600"><HelpCircle size={20} /></div>
                  <div className="min-w-0 flex-1"><p className="font-bold text-haven-navy">Aide et sécurité</p><p className="text-xs text-gray-400">Obtenir de l’aide ou signaler un problème</p></div>
                  <ChevronRight size={19} className="text-gray-300" />
                </button>
                <button onClick={handleLogout} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-haven-red">
                  <LogOut size={18} /> Se déconnecter
                </button>
              </div>
            )}
            
            {/* Bio Section */}
            <div className="bg-white rounded-3xl md:rounded-[2.5rem] shadow-soft md:shadow-premium p-5 md:p-10 border border-gray-50">
              <h2 className="text-xl md:text-2xl font-heading font-bold text-haven-navy mb-4 md:mb-6">{isOwnProfile ? 'Mon profil public' : `À propos de ${user.firstName}`}</h2>
              <p className="text-gray-600 leading-relaxed text-base md:text-lg">
                {user.bio || `${user.firstName} n'a pas encore rédigé sa description. C'est un membre de la communauté HAVEN qui apprécie les séjours de qualité et les rencontres conviviales.`}
              </p>
              
              <div className="mt-6 md:mt-10 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-haven-navy text-sm mb-1">Identité confirmée</h4>
                    <p className="text-xs text-gray-500">A fourni une pièce d'identité officielle validée par nos services.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-haven-navy text-sm mb-1">Email vérifié</h4>
                    <p className="text-xs text-gray-500">L'adresse email a été confirmée lors de l'inscription.</p>
                  </div>
                </div>
              </div>
            </div>

            {isOwnProfile && (
              <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-soft md:rounded-[2.5rem] md:p-10 md:shadow-premium">
                <h2 className="font-heading text-xl font-bold text-haven-navy md:text-2xl">Visibilité avec les futurs colocataires</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">Autorisez HAVEN à présenter votre prénom, votre photo, votre activité et votre âge aux personnes dont le séjour confirmé chevauche le vôtre. Vos coordonnées restent privées.</p>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(user.shareProfileWithHousemates)}
                  disabled={isVisibilityUpdating}
                  onClick={handleHousemateVisibility}
                  className={`mt-5 inline-flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-colors disabled:cursor-wait ${user.shareProfileWithHousemates ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                >
                  <span className={`h-5 w-9 rounded-full p-0.5 transition-colors ${user.shareProfileWithHousemates ? 'bg-green-500' : 'bg-gray-300'}`}>
                    <span className={`block h-4 w-4 rounded-full bg-white transition-transform ${user.shareProfileWithHousemates ? 'translate-x-4' : ''}`} />
                  </span>
                  {isVisibilityUpdating ? 'Mise à jour…' : user.shareProfileWithHousemates ? 'Mon profil est visible' : 'Mon profil est privé'}
                </button>
              </section>
            )}

            {/* Listings Section (if owner) */}
            {listings.length > 0 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-heading font-bold text-haven-navy px-4">Annonces de {user.firstName}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {listings.map(listing => (
                    <Link key={listing.id} to={`/listing/${listing.id}`} className="group">
                      <div className="bg-white rounded-[2rem] overflow-hidden shadow-premium border border-gray-50 hover:shadow-card transition-all duration-300">
                        <div className="relative h-48 overflow-hidden">
                          <img 
                            src={listing.mainPhotoUrl} 
                            alt={listing.title} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          />
                          <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-black uppercase text-haven-navy shadow-sm">
                            {listing.city}
                          </div>
                        </div>
                        <div className="p-6">
                          <h3 className="font-bold text-haven-navy mb-2 group-hover:text-haven-red transition-colors line-clamp-1">
                            {listing.title}
                          </h3>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-haven-red font-bold text-sm">
                              <Star size={14} className="fill-haven-red" />
                              {listing.rating}
                            </div>
                            <div className="text-xs text-gray-400 font-medium flex items-center gap-1">
                              <Home size={12} /> {listing.availableRooms} ch. dispos
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews Section (Mocked for now) */}
            <div className={`${isOwnProfile ? 'hidden md:block' : ''} bg-white rounded-[2.5rem] shadow-premium p-10 border border-gray-50`}>
              <h2 className="text-2xl font-heading font-bold text-haven-navy mb-8 flex items-center gap-3">
                <Star className="text-haven-red fill-haven-red" size={24} />
                Ce que les gens disent de {user.firstName}
              </h2>
              
              <div className="space-y-8">
                {[1, 2].map(i => (
                  <div key={i} className="border-b border-gray-100 last:border-0 pb-8 last:pb-0">
                    <div className="flex items-center gap-4 mb-4">
                      <img 
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=Reviewer${i}`} 
                        alt="Reviewer" 
                        className="w-12 h-12 rounded-full bg-gray-100"
                      />
                      <div>
                        <h4 className="font-bold text-haven-navy text-sm">{i === 1 ? 'Thomas' : 'Sophie'}</h4>
                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">Mars 2026</p>
                      </div>
                      <div className="ml-auto flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star key={star} size={12} className="fill-haven-red text-haven-red" />
                        ))}
                      </div>
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed italic">
                      {i === 1 
                        ? "Super expérience avec ce membre. Très respectueux des lieux et communication fluide. Je recommande vivement !" 
                        : "Un séjour parfait. Tout était conforme à la description et l'accueil a été très chaleureux. Merci encore !"}
                    </p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
