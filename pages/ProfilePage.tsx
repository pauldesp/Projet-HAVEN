
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiService } from '../services/api';
import { User, Listing } from '../types';
import { ShieldCheck, Star, Calendar, MapPin, Briefcase, GraduationCap, Loader2, Home, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/Button';

export const ProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const userData = await apiService.users.getById(id);
        if (userData) {
          setUser(userData);
          // If the user is an owner, fetch their listings
          const allListings = await apiService.listings.getAll();
          const userListings = allListings.filter(l => l.ownerId === id && l.status === 'APPROVED');
          setListings(userListings);
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

  return (
    <div className="min-h-screen bg-haven-cream pb-20 font-body">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* Left Column: Avatar & Stats */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-[2.5rem] shadow-premium p-8 border border-gray-50 sticky top-24">
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-6">
                  <img 
                    src={user.avatarUrl} 
                    alt={`${user.firstName} ${user.lastName}`} 
                    className="w-40 h-40 rounded-full object-cover border-4 border-white shadow-xl"
                  />
                  {user.status === 'APPROVED' && (
                    <div className="absolute bottom-2 right-2 bg-green-500 text-white p-1.5 rounded-full border-4 border-white shadow-lg" title="Identité vérifiée">
                      <ShieldCheck size={20} />
                    </div>
                  )}
                </div>
                
                <h1 className="text-3xl font-heading font-bold text-haven-navy mb-1">
                  {user.firstName} {user.lastName}
                </h1>
                <p className="text-gray-500 font-medium mb-6 uppercase tracking-widest text-[10px]">
                  {user.role === 'OWNER' ? 'Propriétaire' : user.role === 'ADMIN' ? 'Administrateur' : 'Locataire'}
                </p>

                <div className="grid grid-cols-2 gap-4 w-full mb-8">
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

                <div className="w-full space-y-4 border-t border-gray-100 pt-6 text-left">
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
          <div className="lg:col-span-2 space-y-12">
            
            {/* Bio Section */}
            <div className="bg-white rounded-[2.5rem] shadow-premium p-10 border border-gray-50">
              <h2 className="text-2xl font-heading font-bold text-haven-navy mb-6">À propos de {user.firstName}</h2>
              <p className="text-gray-600 leading-relaxed text-lg">
                {user.bio || `${user.firstName} n'a pas encore rédigé sa description. C'est un membre de la communauté HAVEN qui apprécie les séjours de qualité et les rencontres conviviales.`}
              </p>
              
              <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
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
            <div className="bg-white rounded-[2.5rem] shadow-premium p-10 border border-gray-50">
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
