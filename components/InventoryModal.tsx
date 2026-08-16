
import React, { useState } from 'react';
import { X, Camera, Check, AlertTriangle, Star, ClipboardList, Info, Loader2, Sparkles, Home, User, Users, CheckCircle, Calendar } from 'lucide-react';
import { Button } from './Button';
import { Booking, Listing, Room, AppDocument } from '../types';
import { INCIDENT_CATEGORIES } from '../src/constants';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'IN' | 'OUT';
  booking: Booking;
  listing?: Listing;
  room?: Room;
  onComplete: (data: any) => void;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({ 
  isOpen, 
  onClose, 
  type, 
  booking, 
  listing, 
  room,
  onComplete 
}) => {
  const { currentUser } = useAuth();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isForcedOverride, setIsForcedOverride] = useState(false);
  
  // Form state
  const [condition, setCondition] = useState<'EXCELLENT'>('EXCELLENT');
  const [cleaningRating, setCleaningRating] = useState(5);
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<Record<string, string[]>>({
    'bedroom': [],
    'kitchen': [],
    'fridge': [],
    'living': [],
    'common_bath': [],
    'common_wc': [],
    'entrance': [],
    'key': [],
    'private_bath': [],
    'incident': []
  });

  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    // Private - Bedroom
    'bed_stripped': false, 'mattress_clean': false, 'floor_clean_priv': false, 'dust_done': false, 'desk_cleaned': false,
    'bedside_tables': false, 'storage_empty': false, 'closet_empty': false, 'mirror_clean_priv': false, 'window_closed_priv': false,
    'radiator_clear': false, 'no_trash_priv': false, 'no_personal_items_priv': false,
    
    // Private - Bathroom (conditional)
    'priv_sink': false, 'priv_taps': false, 'priv_shower': false, 'priv_shower_wall': false, 'priv_wc': false,
    'priv_mirror': false, 'priv_floor': false, 'priv_trash': false, 'priv_no_products': false,

    // Common - Kitchen
    'dishes_done': false, 'sink_clean': false, 'counter_clean': false, 'plates_clean': false, 'microwave_clean': false,
    'oven_clean': false, 'fridge_empty': false, 'freezer_empty': false, 'table_chairs': false, 'floor_clean_kitchen': false, 'trash_empty_kitchen': false,

    // Common - Living
    'sofa_order': false, 'furniture_clean': false, 'floor_clean_living': false, 'objects_reset': false, 'no_trash_living': false,

    // Common - Bath
    'comm_sink': false, 'comm_taps': false, 'comm_shower': false, 'comm_mirror': false, 'comm_floor': false, 'comm_trash': false, 'comm_no_products': false,

    // Common - WC
    'wc_bowl': false, 'wc_seat': false, 'wc_floor': false, 'wc_trash': false,

    // Common - Corridor
    'corridor_floor': false,

    // Final checks
    'all_personal_items': false, 'furniture_reset': false, 'no_new_damage': false, 'keys_returned': false,
    'lights_off': false, 'windows_closed': false, 'taps_closed': false, 'door_locked': false,

    // Final Final Confirmation
    'clean_check': false, 'tidy_check': false, 'personal_check': false, 'photo_check': false
  });

  const [incidentReport, setIncidentReport] = useState({ category: '', subCategory: '', description: '', photo: '' });
  const [reviews, setReviews] = useState({
    listing: { rating: 5, comment: '' },
    roommates: { rating: 5, comment: '' },
    haven: { rating: 5, comment: '' }
  });

  if (!isOpen) return null;

  const handleToggleCheck = (id: string) => setChecklist(prev => ({ ...prev, [id]: !prev[id] }));

  const handleAddPhoto = (category: string) => {
    setPhotos(prev => ({
      ...prev,
      [category]: [...(prev[category] || []), `https://picsum.photos/400/300?random=${Date.now()}`]
    }));
  };

  const handleRemovePhoto = (category: string, index: number) => {
    setPhotos(prev => ({ ...prev, [category]: prev[category].filter((_, i) => i !== index) }));
  };

  const handleSubmit = async () => {
    if (!currentUser) return;
    setIsSubmitting(true);
    
    try {
      // 1. Logic for generating a document reference
      const docType = type === 'IN' ? 'INVENTORY_IN' : 'INVENTORY_OUT';
      const docTitle = type === 'IN' ? 'État des lieux d\'entrée' : 'État des lieux de sortie';
      const docId = `doc_${type.toLowerCase()}_${booking.id}_${Date.now()}`;
      
      const inventoryDoc: AppDocument = {
        id: docId,
        userId: currentUser.id,
        bookingId: booking.id,
        title: `${docTitle} - ${listing?.title || 'Logement'}`,
        type: docType,
        url: `https://example.com/reports/${docId}.pdf`, // Simulation of a generated PDF
        createdAt: new Date().toISOString(),
        listingTitle: listing?.title
      };

      await apiService.documents.create(inventoryDoc);
      
      // 2. Wrap up and notify parent
      await new Promise(resolve => setTimeout(resolve, 1500));
      onComplete({ condition, checklist, photos, incidentReport, reviews, documentId: docId });
      setStep(1);
      onClose();
    } catch (e) {
      console.error("Error creating report document", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isChecklistSectionComplete = (keys: string[]) => keys.every(k => checklist[k]);
  
  const bedroomKeys = ['bed_stripped', 'mattress_clean', 'floor_clean_priv', 'dust_done', 'desk_cleaned', 'bedside_tables', 'storage_empty', 'closet_empty', 'mirror_clean_priv', 'window_closed_priv', 'radiator_clear', 'no_trash_priv', 'no_personal_items_priv'];
  const privBathKeys = ['priv_sink', 'priv_taps', 'priv_shower', 'priv_shower_wall', 'priv_wc', 'priv_mirror', 'priv_floor', 'priv_trash', 'priv_no_products'];
  const kitchenKeys = ['dishes_done', 'sink_clean', 'counter_clean', 'plates_clean', 'microwave_clean', 'oven_clean', 'fridge_empty', 'freezer_empty', 'table_chairs', 'floor_clean_kitchen', 'trash_empty_kitchen'];
  const livingKeys = ['sofa_order', 'furniture_clean', 'floor_clean_living', 'objects_reset', 'no_trash_living'];
  const commonBathKeys = ['comm_sink', 'comm_taps', 'comm_shower', 'comm_mirror', 'comm_floor', 'comm_trash', 'comm_no_products'];
  const commonWcKeys = ['wc_bowl', 'wc_seat', 'wc_floor', 'wc_trash'];
  const corridorKeys = ['corridor_floor'];
  const finalCheckKeys = ['all_personal_items', 'furniture_reset', 'no_new_damage', 'keys_returned', 'lights_off', 'windows_closed', 'taps_closed', 'door_locked'];
  const validationKeys = ['clean_check', 'tidy_check', 'personal_check', 'photo_check'];

  const canProceedToReviews = 
    isChecklistSectionComplete(bedroomKeys) && (room?.hasPrivateBath ? (isChecklistSectionComplete(privBathKeys) && photos.private_bath.length >= 2) : true) &&
    photos.bedroom.length >= 3 && isChecklistSectionComplete(kitchenKeys) && photos.kitchen.length >= 3 && photos.fridge.length >= 1 &&
    isChecklistSectionComplete(livingKeys) && photos.living.length >= 1 && (!room?.hasPrivateBath ? (isChecklistSectionComplete(commonBathKeys) && photos.common_bath.length >= 1) : true) &&
    isChecklistSectionComplete(commonWcKeys) && photos.common_wc.length >= 1 && isChecklistSectionComplete(corridorKeys) && photos.entrance.length >= 1 &&
    isChecklistSectionComplete(finalCheckKeys) && photos.key.length >= 1 && isChecklistSectionComplete(validationKeys);

  const today = new Date();
  const [year, month, day] = booking.endDate.split('-').map(Number);
  const endDate = new Date(year, month - 1, day);
  const isActuallyLastDayOrLater = today.getTime() >= endDate.getTime();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-haven-navy/40 backdrop-blur-md" onClick={onClose}></div>
      
      <div className="relative bg-white rounded-[2.5rem] w-full max-w-7xl max-h-[90vh] overflow-hidden shadow-2xl animate-fade-in-up flex flex-col">
        <div className="flex-1 overflow-y-auto">
          {type === 'OUT' && !isActuallyLastDayOrLater && !isForcedOverride ? (
            <div className="min-h-[500px] flex flex-col items-center justify-center p-12 text-center space-y-8">
              <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 shadow-xl shadow-amber-500/10">
                <Calendar size={48} />
              </div>
              <div className="space-y-4">
                <h2 className="text-3xl font-heading font-bold text-haven-navy">Départ anticipé</h2>
                <p className="text-haven-stone leading-relaxed">
                  Le formulaire de départ n'est normalement accessible que le dernier jour de votre location ({endDate.toLocaleDateString('fr-FR')}).
                </p>
              </div>
              <Button variant="primary" className="h-14 px-10 rounded-2xl" onClick={() => setIsForcedOverride(true)}>
                Forcer avec un départ anticipé
              </Button>
            </div>
          ) : (
            <React.Fragment>
              <div className="p-12 border-b border-gray-100 bg-white">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h2 className="text-3xl font-heading font-bold text-haven-navy">Mon départ</h2>
                    <p className="text-haven-stone flex items-center gap-2">
                      <Home size={16} /> {listing?.title} • Chambre {room?.name}
                    </p>
                  </div>
                  <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X size={24} /></button>
                </div>
              </div>

              <div className="p-12 pb-32 space-y-12">
                {type === 'OUT' ? (
                  <React.Fragment>
                    {step === 1 && (
                      <div className="space-y-12 animate-fade-in-up">
                        <div className="bg-haven-red/5 p-8 rounded-3xl border border-haven-red/10">
                          <div className="flex items-center gap-3 text-haven-red font-bold mb-4">
                            <Info size={24} /> <h3 className="text-lg">Consignes de départ</h3>
                          </div>
                          <p className="text-gray-600 leading-relaxed">
                            Le départ d’un locataire est un moment clé pour la communauté. Il est de votre responsabilité d’effectuer un ménage complet dans vos parties privatives ainsi que dans les parties communes.
                          </p>
                        </div>

                        <div className="space-y-8">
                          {/* Part 1: Private */}
                          <div className="space-y-6">
                            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                              <User size={24} className="text-haven-navy" /> <h4 className="font-heading font-bold text-xl text-haven-navy">1. Parties privatives</h4>
                            </div>
                            <div className="space-y-4">
                              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Chambre</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {bedroomKeys.map(k => (
                                  <CheckItem key={k} checked={checklist[k]} label={checklistLabels[k] || k} onToggle={() => handleToggleCheck(k)} />
                                ))}
                              </div>
                              {isChecklistSectionComplete(bedroomKeys) && (
                                <div className="p-8 bg-haven-navy/5 rounded-[2rem] space-y-4 animate-fade-in mt-4">
                                  <label className="block text-[10px] font-black text-haven-stone uppercase tracking-widest">Photos de la chambre (Min 3)</label>
                                  <PhotoGrid category="bedroom" photos={photos.bedroom} onAdd={() => handleAddPhoto('bedroom')} onRemove={(i: number) => handleRemovePhoto('bedroom', i)} label="Ajouter photos chambre" />
                                </div>
                              )}
                            </div>

                            {room?.hasPrivateBath && (
                              <div className="space-y-4 pt-6">
                                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Salle de bain privative</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {privBathKeys.map(k => (
                                    <CheckItem key={k} checked={checklist[k]} label={checklistLabels[k] || k} onToggle={() => handleToggleCheck(k)} />
                                  ))}
                                </div>
                                {isChecklistSectionComplete(privBathKeys) && (
                                  <div className="p-8 bg-haven-navy/5 rounded-[2rem] space-y-4 animate-fade-in mt-4">
                                    <label className="block text-[10px] font-black text-haven-stone uppercase tracking-widest">Photos SDB Privée (Min 2)</label>
                                    <PhotoGrid category="private_bath" photos={photos.private_bath} onAdd={() => handleAddPhoto('private_bath')} onRemove={(i: number) => handleRemovePhoto('private_bath', i)} label="Ajouter photos SDB" mini />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Part 2: Common */}
                          <div className="space-y-6 pt-10">
                            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                              <Users size={24} className="text-haven-navy" /> <h4 className="font-heading font-bold text-xl text-haven-navy">2. Parties communes</h4>
                            </div>
                            
                            <div className="space-y-4">
                              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Cuisine</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {kitchenKeys.map(k => (
                                  <CheckItem key={k} checked={checklist[k]} label={checklistLabels[k] || k} onToggle={() => handleToggleCheck(k)} />
                                ))}
                              </div>
                              {isChecklistSectionComplete(kitchenKeys) && (
                                <div className="p-8 bg-haven-navy/5 rounded-[2rem] space-y-4 animate-fade-in mt-4 grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-[10px] font-black text-haven-stone uppercase tracking-widest mb-2">Cuisine (Min 3)</label>
                                    <PhotoGrid category="kitchen" photos={photos.kitchen} onAdd={() => handleAddPhoto('kitchen')} onRemove={(i: number) => handleRemovePhoto('kitchen', i)} label="Cuisine" mini />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-black text-haven-stone uppercase tracking-widest mb-2">Frigo Ouvert (Min 1)</label>
                                    <PhotoGrid category="fridge" photos={photos.fridge} onAdd={() => handleAddPhoto('fridge')} onRemove={(i: number) => handleRemovePhoto('fridge', i)} label="Frigo" mini />
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="space-y-4 pt-6">
                              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Salon</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {livingKeys.map(k => (
                                  <CheckItem key={k} checked={checklist[k]} label={checklistLabels[k] || k} onToggle={() => handleToggleCheck(k)} />
                                ))}
                              </div>
                              {isChecklistSectionComplete(livingKeys) && (
                                <div className="p-8 bg-haven-navy/5 rounded-[2rem] space-y-4 animate-fade-in mt-4">
                                  <label className="block text-[10px] font-black text-haven-stone uppercase tracking-widest">Salon (Min 1)</label>
                                  <PhotoGrid category="living" photos={photos.living} onAdd={() => handleAddPhoto('living')} onRemove={(i: number) => handleRemovePhoto('living', i)} label="Salon" mini />
                                </div>
                              )}
                            </div>

                            {!room?.hasPrivateBath && (
                              <div className="space-y-4 pt-6">
                                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">SDB Commune</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {commonBathKeys.map(k => (
                                    <CheckItem key={k} checked={checklist[k]} label={checklistLabels[k] || k} onToggle={() => handleToggleCheck(k)} />
                                  ))}
                                </div>
                                {isChecklistSectionComplete(commonBathKeys) && (
                                  <div className="p-8 bg-haven-navy/5 rounded-[2rem] space-y-4 animate-fade-in mt-4">
                                    <label className="block text-[10px] font-black text-haven-stone uppercase tracking-widest">SDB Commune (Min 1)</label>
                                    <PhotoGrid category="common_bath" photos={photos.common_bath} onAdd={() => handleAddPhoto('common_bath')} onRemove={(i: number) => handleRemovePhoto('common_bath', i)} label="SDB" mini />
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="space-y-4 pt-6">
                              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">WC & Entrée</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {[...commonWcKeys, ...corridorKeys].map(k => (
                                  <CheckItem key={k} checked={checklist[k]} label={checklistLabels[k] || k} onToggle={() => handleToggleCheck(k)} />
                                ))}
                              </div>
                              {isChecklistSectionComplete([...commonWcKeys, ...corridorKeys]) && (
                                <div className="p-8 bg-haven-navy/5 rounded-[2rem] space-y-4 animate-fade-in mt-4 grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-[10px] font-black text-haven-stone uppercase tracking-widest mb-2">WC (Min 1)</label>
                                    <PhotoGrid category="common_wc" photos={photos.common_wc} onAdd={() => handleAddPhoto('common_wc')} onRemove={(i: number) => handleRemovePhoto('common_wc', i)} label="WC" mini />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-black text-haven-stone uppercase tracking-widest mb-2">Entrée (Min 1)</label>
                                    <PhotoGrid category="entrance" photos={photos.entrance} onAdd={() => handleAddPhoto('entrance')} onRemove={(i: number) => handleRemovePhoto('entrance', i)} label="Entrée" mini />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Part 3: Final */}
                          <div className="space-y-6 pt-10">
                            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                              <CheckCircle size={24} className="text-haven-navy" /> <h4 className="font-heading font-bold text-xl text-haven-navy">3. Vérifications finales</h4>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
                              {finalCheckKeys.map(k => (
                                <CheckItem key={k} checked={checklist[k]} label={checklistLabels[k] || k} onToggle={() => handleToggleCheck(k)} />
                              ))}
                            </div>
                            {isChecklistSectionComplete(finalCheckKeys) && (
                              <div className="p-8 bg-haven-navy/5 rounded-[2rem] space-y-4 animate-fade-in mt-4">
                                <label className="block text-[10px] font-black text-haven-stone uppercase tracking-widest">Remise des clés (Min 1 photo)</label>
                                <PhotoGrid category="key" photos={photos.key} onAdd={() => handleAddPhoto('key')} onRemove={(i: number) => handleRemovePhoto('key', i)} label="Photo des clés" mini />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Summary Confirmation */}
                        <div className="p-8 bg-haven-navy rounded-[2.5rem] text-white space-y-6">
                           <h4 className="font-bold text-lg">Dernier engagement</h4>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {validationKeys.map(k => (
                                <div key={k} onClick={() => handleToggleCheck(k)} className="flex items-center gap-3 cursor-pointer group">
                                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${checklist[k] ? 'bg-haven-red border-haven-red' : 'border-white/20 group-hover:border-white/40'}`}>
                                    {checklist[k] && <Check size={14} strokeWidth={4} />}
                                  </div>
                                  <span className="text-sm font-medium text-white/90">{checklistLabels[k]}</span>
                                </div>
                              ))}
                           </div>
                        </div>
                      </div>
                    )}

                    {step === 3 && (
                      <div className="space-y-12 animate-fade-in-up">
                        <div className="space-y-6">
                           <div className="flex items-center gap-3 text-amber-600 font-bold">
                              <AlertTriangle size={32} /> <h3 className="text-2xl font-heading">Signaler un incident ?</h3>
                           </div>
                           <div className="bg-amber-50 p-10 rounded-[2.5rem] border border-amber-100 space-y-8">
                              <p className="text-amber-800 font-medium">Un problème ? Merci de nous en informer ci-dessous.</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {INCIDENT_CATEGORIES.map(cat => (
                                  <button key={cat.id} onClick={() => setIncidentReport(prev => ({ ...prev, category: cat.title, subCategory: '' }))} className={`p-5 rounded-2xl border-2 text-left transition-all ${incidentReport.category === cat.title ? 'border-amber-500 bg-white shadow-xl' : 'border-amber-100 bg-white/50'}`}>
                                    <span className="font-black text-[10px] text-amber-600 opacity-50 block mb-1">{cat.id}</span>
                                    <span className="font-bold text-xs">{cat.title}</span>
                                  </button>
                                ))}
                              </div>
                              {incidentReport.category && (
                                <div className="space-y-4 animate-fade-in">
                                  <label className="block text-[10px] font-black text-amber-700 uppercase tracking-widest">Détails de l'incident</label>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    {(INCIDENT_CATEGORIES.find(c => c.title === incidentReport.category)?.items || []).map(item => (
                                      <button key={item} onClick={() => setIncidentReport(prev => ({ ...prev, subCategory: item }))} className={`p-3 rounded-xl border text-left text-[10px] font-bold ${incidentReport.subCategory === item ? 'bg-amber-600 text-white' : 'bg-white text-amber-800'}`}>{item}</button>
                                    ))}
                                  </div>
                                  {incidentReport.subCategory && (
                                    <div className="space-y-4 pt-4">
                                      <textarea rows={4} className="w-full bg-white border border-amber-200 p-5 rounded-2xl outline-none" placeholder="Description..." value={incidentReport.description} onChange={e => setIncidentReport({...incidentReport, description: e.target.value})} />
                                      <button onClick={() => setIncidentReport({...incidentReport, photo: 'https://picsum.photos/800/600?random=incident'})} className="w-full py-10 border-2 border-dashed border-amber-300 rounded-2xl flex flex-col items-center gap-2 text-amber-600 font-bold bg-white/50">
                                        <Camera size={40} /> <span>Photo de l'incident</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                           </div>
                        </div>

                        <div className="space-y-10 pt-10 border-t border-gray-100">
                          <div className="flex items-center gap-3 text-haven-navy font-bold">
                            <Star size={32} className="fill-haven-navy" /> <h3 className="text-2xl font-heading">Votre avis</h3>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <ReviewSection title="Le logement" value={reviews.listing} onChange={(val: any) => setReviews({...reviews, listing: val})} />
                            <ReviewSection title="Les colocataires" value={reviews.roommates} onChange={(val: any) => setReviews({...reviews, roommates: val})} />
                            <ReviewSection title="Expérience HAVEN" value={reviews.haven} onChange={(val: any) => setReviews({...reviews, haven: val})} />
                          </div>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                ) : (
                  <div className="p-20 text-center space-y-6">
                    <ClipboardList size={80} className="mx-auto text-gray-200" />
                    <h3 className="font-bold text-2xl">Interface d'entrée</h3>
                    <Button variant="primary" className="h-14 px-12" onClick={handleSubmit}>Valider l'entrée</Button>
                  </div>
                )}
              </div>
            </React.Fragment>
          )}
        </div>

        {type === 'OUT' && (isActuallyLastDayOrLater || isForcedOverride) && (
          <div className="p-10 bg-white border-t border-gray-100 flex gap-4">
            {step > 1 && <Button variant="outline" className="flex-1 h-16 rounded-2xl text-lg font-bold" onClick={() => setStep(1)}>Retour</Button>}
            {step === 1 && (
              <Button variant="primary" className="flex-1 h-16 rounded-2xl text-lg font-bold" disabled={!canProceedToReviews} onClick={() => setStep(3)}>
                Passer aux avis
              </Button>
            )}
            {step === 3 && (
              <Button variant="primary" className="flex-1 h-16 rounded-2xl text-lg font-bold" disabled={isSubmitting} onClick={handleSubmit}>
                {isSubmitting ? <><Loader2 className="animate-spin mr-2" /> Transmission...</> : "Finaliser mon départ"}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const checklistLabels: Record<string, string> = {
  'bed_stripped': 'Lit défait / linge retiré',
  'mattress_clean': 'Matelas & protège matelas propre',
  'floor_clean_priv': 'Sol aspiré et nettoyé',
  'dust_done': 'Poussière faite',
  'desk_cleaned': 'Bureau nettoyé',
  'bedside_tables': 'Tables de chevet nettoyées',
  'storage_empty': 'Rangements vidés et propres',
  'closet_empty': 'Placard vidé et propre',
  'mirror_clean_priv': 'Miroir propre',
  'window_closed_priv': 'Fenêtre refermée',
  'radiator_clear': 'Radiateur dégagé et éteint',
  'no_trash_priv': 'Aucune poubelle laissée',
  'no_personal_items_priv': 'Aucun objet personnel oublié',
  'priv_sink': 'Lavabo nettoyé', 'priv_taps': 'Robinetterie essuyée', 'priv_shower': 'Douche/Baignoire correcte',
  'priv_shower_wall': 'Parois de douche', 'priv_wc': 'WC nettoyés', 'priv_mirror': 'Miroir nettoyé',
  'priv_floor': 'Sol nettoyé', 'priv_trash': 'Poubelle vidée', 'priv_no_products': 'Aucun produit laissé',
  'dishes_done': 'Vaisselle propre et rangée', 'sink_clean': 'Évier nettoyé', 'counter_clean': 'Plan de travail',
  'plates_clean': 'Plaques de cuisson', 'microwave_clean': 'Micro-ondes', 'oven_clean': 'Four nettoyé',
  'fridge_empty': 'Frigo vidé', 'freezer_empty': 'Congélo vidé', 'table_chairs': 'Table & chaises',
  'floor_clean_kitchen': 'Sol cuisine', 'trash_empty_kitchen': 'Poubelles vidées',
  'sofa_order': 'Canapé rangé', 'furniture_clean': 'Meubles salon', 'floor_clean_living': 'Sol salon',
  'objects_reset': 'Objets à leur place', 'no_trash_living': 'Zéro déchet',
  'comm_sink': 'Lavabo', 'comm_taps': 'Robinets', 'comm_shower': 'Douche', 'comm_mirror': 'Miroir',
  'comm_floor': 'Sol', 'comm_trash': 'Poubelle', 'comm_no_products': 'Pas de produits perso',
  'wc_bowl': 'Cuvette', 'wc_seat': 'Abattant', 'wc_floor': 'Sol', 'wc_trash': 'Poubelle vidée',
  'corridor_floor': 'Sol entrée/couloir propre',
  'all_personal_items': 'Affaires perso récupérées', 'furniture_reset': 'Meubles à leur place',
  'no_new_damage': 'Aucun dégât nouveau non signalé', 'keys_returned': 'Clés / badges restitués',
  'lights_off': 'Lumières éteintes', 'windows_closed': 'Fenêtres fermées',
  'taps_closed': 'Robinets fermés', 'door_locked': 'Porte verrouillée',
  'clean_check': 'Ménage effectué', 'tidy_check': 'Logement rangé', 'personal_check': 'Affaires perso retirées', 'photo_check': 'Photos fidèles transmises'
};

const CheckItem = ({ checked, label, onToggle }: { checked: boolean, label: string, onToggle: () => void }) => (
  <div onClick={onToggle} className={`flex items-center gap-4 p-5 rounded-2xl border-2 cursor-pointer transition-all ${checked ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-100 text-gray-500 hover:bg-gray-50'}`}>
    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${checked ? 'bg-green-500 border-green-500' : 'border-gray-200'}`}>
      {checked && <Check size={14} className="text-white" strokeWidth={4} />}
    </div>
    <span className="font-bold text-xs">{label}</span>
  </div>
);

const PhotoGrid = ({ category, photos, onAdd, onRemove, label, mini }: any) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    {photos.map((p: string, i: number) => (
      <div key={i} className={`rounded-2xl overflow-hidden border border-gray-200 relative group ${mini ? 'aspect-[4/3]' : 'aspect-[3/4]'}`}>
        <img src={p} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
        <button onClick={() => onRemove(i)} className="absolute top-2 right-2 bg-white/90 p-2 rounded-full text-red-500 shadow-md transform hover:scale-110 transition-all"><X size={14} /></button>
      </div>
    ))}
    <button onClick={onAdd} className={`rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:border-haven-navy hover:text-haven-navy transition-all bg-white hover:bg-haven-navy/5 ${mini ? 'aspect-[4/3]' : 'aspect-square'}`}>
      <Camera size={32} />
      <span className="text-[10px] font-black uppercase mt-2">{label}</span>
    </button>
  </div>
);

const ReviewSection = ({ title, value, onChange }: any) => (
  <div className="bg-white rounded-[2rem] p-8 border border-gray-100 space-y-6 shadow-sm hover:shadow-md transition-shadow">
    <label className="block text-sm font-bold text-haven-navy uppercase tracking-widest">{title}</label>
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map(star => (
        <button key={star} onClick={() => onChange({...value, rating: star})} className="transform hover:scale-110 transition-transform">
          <Star size={28} className={value.rating >= star ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'} />
        </button>
      ))}
    </div>
    <textarea rows={3} placeholder="Un commentaire pour nous aider ?" className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-xs outline-none focus:border-haven-navy transition-colors" value={value.comment} onChange={(e) => onChange({...value, comment: e.target.value})} />
  </div>
);
