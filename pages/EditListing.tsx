
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Loader2, 
  Camera, 
  Plus, 
  Trash2, 
  Maximize2, 
  Bath, 
  Bed, 
  Tag, 
  Info,
  Building,
  Home as HomeIcon,
  MapPin,
  Sparkles,
  Upload,
  CheckCircle,
  XCircle,
  Armchair,
  Lock
} from 'lucide-react';
import { Button } from '../components/Button';
import { useListings } from '../contexts/ListingContext';
import { useAuth } from '../contexts/AuthContext';
import { Listing, Room } from '../types';
import { aiService } from '../services/ai';
import { toast } from 'sonner';

export const EditListing: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { getListingById, updateListing } = useListings();
  
  const [listing, setListing] = useState<Listing | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'ROOMS' | 'PHOTOS'>('GENERAL');

  useEffect(() => {
    const data = getListingById(id || '');
    if (data) {
      // Check ownership
      if (data.ownerId !== currentUser?.id && currentUser?.role !== 'ADMIN') {
        toast.error("Vous n'êtes pas autorisé à modifier ce logement.");
        navigate('/owner/dashboard');
        return;
      }
      
      // Ensure all potentially used fields are initialized to avoid uncontrolled component warnings
      const normalizedListing = {
        title: '',
        description: '',
        address: '',
        city: '',
        zipCode: '',
        type: 'APARTMENT',
        surface: 0,
        totalRooms: 0,
        availableRooms: 0,
        bathrooms: 1,
        minStay: 30,
        price: 0,
        amenities: [],
        galleryUrls: [],
        mainPhotoUrl: '',
        cleaningFee: 15,
        isMixed: true,
        bookingMode: 'INSTANT',
        status: 'PENDING',
        ...JSON.parse(JSON.stringify(data))
      };
      
      // Normalize rooms too
      normalizedListing.rooms = (normalizedListing.rooms || []).map((r: any) => ({
        name: '',
        pricePerDay: 40,
        size: 10,
        hasPrivateBath: false,
        hasDesk: false,
        hasLock: false,
        hasWardrobe: false,
        ...r
      }));

      setListing(normalizedListing);
    } else {
      toast.error("Logement non trouvé.");
      navigate('/owner/dashboard');
    }
  }, [id, getListingById, currentUser, navigate]);

  if (!listing) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-haven-navy"/></div>;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateListing(listing);
      toast.success("Annonce mise à jour avec succès !");
      navigate('/owner/dashboard');
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la mise à jour.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateDescription = async () => {
    setIsGenerating(true);
    try {
      const generated = await aiService.generateListingDescription(listing as any);
      if (generated) {
        setListing({ ...listing, description: generated });
        toast.success("Description générée !");
      }
    } catch (e) {
      toast.error("Erreur Gemini AI");
    } finally {
      setIsGenerating(false);
    }
  };

  const updateRoom = (roomId: string, updates: Partial<Room>) => {
    setListing({
      ...listing,
      rooms: listing.rooms.map(r => r.id === roomId ? { ...r, ...updates } : r)
    });
  };

  const addRoom = () => {
    const newRoom: Room = {
      id: `r-${Date.now()}`,
      name: `Nouvelle chambre`,
      pricePerDay: 40,
      size: 10,
      hasPrivateBath: false,
      bedSize: 'Double',
      isAvailable: true,
      photoUrl: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&q=80',
      hasDesk: true,
      hasLock: true,
      hasWardrobe: true,
      roomPhotos: []
    };
    setListing({
      ...listing,
      rooms: [...listing.rooms, newRoom],
      totalRooms: listing.totalRooms + 1,
      availableRooms: listing.availableRooms + 1
    });
  };

  const removeRoom = (roomId: string) => {
    if (listing.rooms.length <= 1) {
      toast.error("Il doit y avoir au moins une chambre.");
      return;
    }
    setListing({
      ...listing,
      rooms: listing.rooms.filter(r => r.id !== roomId),
      totalRooms: listing.totalRooms - 1,
      availableRooms: Math.max(0, listing.availableRooms - 1)
    });
  };

  const removePhoto = (url: string) => {
    setListing({
      ...listing,
      galleryUrls: listing.galleryUrls.filter(u => u !== url),
      mainPhotoUrl: listing.mainPhotoUrl === url ? listing.galleryUrls.find(u => u !== url) || '' : listing.mainPhotoUrl
    });
  };

  return (
    <div className="min-h-screen bg-haven-cream pb-32 pt-12">
      <div className="max-w-4xl mx-auto px-4 md:px-0">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/owner/dashboard')}
              className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-haven-stone hover:bg-gray-100 transition-colors shadow-premium"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-3xl font-heading font-bold text-haven-navy">Modifier l'annonce</h1>
              <p className="text-haven-stone text-sm">Gestion rapide de votre bien : {listing.title}</p>
            </div>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
             <Button variant="ghost" onClick={() => navigate(`/listing/${listing.id}`)} className="flex-1 md:flex-none">Aperçu</Button>
             <Button 
                onClick={handleSave} 
                disabled={isSaving}
                className="flex-1 md:flex-none gap-2 bg-haven-navy shadow-lg shadow-haven-navy/20"
             >
                {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                Enregistrer les modifications
             </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-white/50 backdrop-blur-sm p-1.5 rounded-[2rem] border border-gray-100 mb-8 max-w-lg">
           {[
             { id: 'GENERAL', label: 'Informations', icon: Info },
             { id: 'ROOMS', label: 'Chambres', icon: Bed },
             { id: 'PHOTOS', label: 'Photos', icon: Camera }
           ].map(tab => (
             <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[1.5rem] text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-white text-haven-navy shadow-premium' : 'text-haven-stone hover:text-haven-navy/70'}`}
             >
                <tab.icon size={16} />
                {tab.label}
             </button>
           ))}
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-premium p-8 md:p-12 border border-gray-100 animate-fade-in">
          
          {activeTab === 'GENERAL' && (
            <div className="space-y-10">
               <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-haven-stone">Nom du logement</label>
                    <input 
                      type="text" 
                      value={listing.title || ''}
                      onChange={(e) => setListing({...listing, title: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-haven-navy font-bold focus:ring-2 focus:ring-haven-navy/20 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-haven-stone">Type de bien</label>
                    <div className="flex bg-gray-50 p-1.5 rounded-2xl">
                      <button onClick={() => setListing({...listing, type: 'APARTMENT'})} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${listing.type === 'APARTMENT' ? 'bg-white text-haven-navy shadow-sm' : 'text-haven-stone'}`}>
                        <Building size={16} /> Appart
                      </button>
                      <button onClick={() => setListing({...listing, type: 'HOUSE'})} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${listing.type === 'HOUSE' ? 'bg-white text-haven-navy shadow-sm' : 'text-haven-stone'}`}>
                        <HomeIcon size={16} /> Maison
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-haven-stone">Frais de ménage (€ par location)</label>
                    <input 
                      type="number" 
                      value={listing.cleaningFee || 0}
                      onChange={(e) => setListing({...listing, cleaningFee: parseInt(e.target.value) || 0})}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-haven-navy font-bold focus:ring-2 focus:ring-haven-navy/20 outline-none transition-all"
                    />
                  </div>
               </div>

               <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase tracking-widest text-haven-stone">Description détaillée</label>
                    <button onClick={handleGenerateDescription} disabled={isGenerating} className="text-[10px] font-black uppercase tracking-widest text-haven-red flex items-center gap-1.5 hover:opacity-80 transition-opacity disabled:opacity-50">
                      {isGenerating ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />}
                      Récrire avec IA
                    </button>
                  </div>
                  <textarea 
                    rows={8}
                    value={listing.description || ''}
                    onChange={(e) => setListing({...listing, description: e.target.value})}
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-haven-navy leading-relaxed focus:ring-2 focus:ring-haven-navy/20 outline-none transition-all resize-none"
                  />
               </div>

               <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-haven-stone">Séjour Minimum (jours)</label>
                    <input 
                      type="number" 
                      value={listing.minStay || 0}
                      onChange={(e) => setListing({...listing, minStay: parseInt(e.target.value) || 0})}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-haven-navy font-bold focus:ring-2 focus:ring-haven-navy/20 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-haven-stone">Surface totale (m²)</label>
                    <input 
                      type="number" 
                      value={listing.surface || 0}
                      onChange={(e) => setListing({...listing, surface: parseInt(e.target.value) || 0})}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-haven-navy font-bold focus:ring-2 focus:ring-haven-navy/20 outline-none transition-all"
                    />
                  </div>
               </div>

               <div className="space-y-3">
                 <label className="text-[10px] font-black uppercase tracking-widest text-haven-stone">Processus de réservation</label>
                 <div className="grid md:grid-cols-2 gap-4">
                   <button 
                     type="button"
                     onClick={() => setListing({...listing, bookingMode: 'INSTANT'})} 
                     className={`p-5 rounded-2xl border text-left transition-all flex flex-col justify-between ${listing.bookingMode !== 'MANUAL' ? 'border-haven-navy bg-haven-navy/5 shadow-sm' : 'border-gray-100 bg-gray-50/50 hover:border-gray-200'}`}
                   >
                     <div>
                       <p className="font-bold text-base text-haven-navy">Validation instantanée</p>
                       <p className="text-xs text-haven-stone mt-1 leading-relaxed">Le locataire réserve et paye directement. Sa chambre est confirmée instantanément.</p>
                     </div>
                   </button>
                   <button 
                     type="button"
                     onClick={() => setListing({...listing, bookingMode: 'MANUAL'})} 
                     className={`p-5 rounded-2xl border text-left transition-all flex flex-col justify-between ${listing.bookingMode === 'MANUAL' ? 'border-haven-navy bg-haven-navy/5 shadow-sm' : 'border-gray-100 bg-gray-50/50 hover:border-gray-200'}`}
                   >
                     <div>
                       <p className="font-bold text-base text-haven-navy">Validation manuelle (48h/72h)</p>
                       <p className="text-xs text-haven-stone mt-1 leading-relaxed">Le locataire fait une demande. Vous avez 48h pour l'accepter, puis il aura 72h pour payer.</p>
                     </div>
                   </button>
                 </div>
               </div>

               <div className="p-6 bg-haven-red/5 rounded-3xl border border-haven-red/10 flex items-start gap-4">
                  <MapPin size={24} className="text-haven-red shrink-0" />
                  <div className="space-y-1">
                    <p className="font-bold text-haven-navy">Emplacement</p>
                    <p className="text-sm text-haven-stone">L'adresse et la ville ({listing.address}, {listing.city}) ne peuvent être modifiées pour préserver l'intégrité de l'annonce. Contactez le support si besoin.</p>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'ROOMS' && (
            <div className="space-y-12">
               <div className="flex justify-between items-center">
                  <h3 className="font-heading font-bold text-2xl text-haven-navy">Configuration des chambres</h3>
                  <Button variant="outline" size="sm" onClick={addRoom} className="gap-2"><Plus size={16} /> Ajouter</Button>
               </div>

               <div className="space-y-8">
                  {listing.rooms.map((room, idx) => (
                    <div key={room.id} className="relative group p-8 rounded-[2rem] border border-gray-100 bg-gray-50/50 hover:bg-white hover:shadow-premium transition-all">
                       <button 
                        onClick={() => removeRoom(room.id)}
                        className="absolute top-6 right-6 w-10 h-10 rounded-xl bg-white text-haven-red flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                       >
                         <Trash2 size={18} />
                       </button>

                       <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
                          <div className="space-y-2 col-span-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Nom</label>
                            <input type="text" value={room.name || ''} onChange={(e) => updateRoom(room.id, { name: e.target.value })} className="w-full bg-white rounded-xl px-4 py-3 font-bold text-haven-navy outline-none border border-gray-100" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Prix / Jour (€)</label>
                            <input type="number" value={room.pricePerDay || 0} onChange={(e) => updateRoom(room.id, { pricePerDay: parseInt(e.target.value) || 0 })} className="w-full bg-white rounded-xl px-4 py-3 font-bold text-haven-navy outline-none border border-gray-100" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Surface (m²)</label>
                            <input type="number" value={room.size || 0} onChange={(e) => updateRoom(room.id, { size: parseInt(e.target.value) || 0 })} className="w-full bg-white rounded-xl px-4 py-3 font-bold text-haven-navy outline-none border border-gray-100" />
                          </div>
                       </div>

                       <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                          {[
                            { id: 'hasPrivateBath', label: 'SDB Privée', icon: Bath },
                            { id: 'hasDesk', label: 'Bureau', icon: Maximize2 },
                            { id: 'hasLock', label: 'Verrou', icon: Lock },
                            { id: 'hasWardrobe', label: 'Armoire', icon: Armchair }
                          ].map(opt => (
                            <button 
                              key={opt.id}
                              onClick={() => updateRoom(room.id, { [opt.id]: !((room as any)[opt.id]) })}
                              className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${((room as any)[opt.id]) ? 'bg-haven-navy border-haven-navy text-white shadow-sm' : 'bg-white border-gray-100 text-gray-400 hover:border-haven-navy/30'}`}
                            >
                              <opt.icon size={18} />
                              <span className="text-[9px] font-bold uppercase">{opt.label}</span>
                            </button>
                          ))}
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          )}

          {activeTab === 'PHOTOS' && (
            <div className="space-y-10">
               <div>
                  <h3 className="font-heading font-bold text-2xl text-haven-navy mb-2">Galerie Photos</h3>
                  <p className="text-sm text-haven-stone">Gérez les photos des parties communes. La première sera la photo principale.</p>
               </div>

               <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {listing.galleryUrls.map((url, idx) => (
                    <div key={idx} className="aspect-[4/3] rounded-[2rem] overflow-hidden relative group border border-gray-100 shadow-premium">
                       <img src={url} className="w-full h-full object-cover" alt="" />
                       <div className="absolute inset-0 bg-haven-navy/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button onClick={() => removePhoto(url)} className="w-10 h-10 rounded-xl bg-white text-haven-red flex items-center justify-center"><Trash2 size={20} /></button>
                          {listing.mainPhotoUrl !== url && (
                            <button onClick={() => setListing({...listing, mainPhotoUrl: url})} className="w-10 h-10 rounded-xl bg-white text-haven-navy flex items-center justify-center"><CheckCircle size={20} /></button>
                          )}
                       </div>
                       {listing.mainPhotoUrl === url && (
                         <div className="absolute top-4 left-4 bg-haven-red text-white text-[9px] font-black uppercase px-2 py-1 rounded-full shadow-sm">Principal</div>
                       )}
                    </div>
                  ))}
                  {listing.galleryUrls.length < 8 && (
                    <div className="aspect-[4/3] rounded-[2rem] border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-haven-navy hover:text-haven-navy transition-all cursor-pointer">
                       <Plus size={24} />
                       <span className="text-[10px] font-bold uppercase">Ajouter</span>
                    </div>
                  )}
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
