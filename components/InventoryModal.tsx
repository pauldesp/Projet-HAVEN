import React, { useEffect, useMemo, useState } from 'react';
import { 
  AlertTriangle,
  Camera,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Home,
  Info,
  KeyRound,
  Loader2,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { Button } from './Button';
import { AppDocument, Booking, Listing, Room } from '../types';
import { apiService } from '../services/api';
import { userFacingErrorMessage } from '../services/errorHandling';
import { formatScheduledMoment, getInventoryTiming } from '../services/inventoryTiming';
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

type CheckoutChecklistKey =
  | 'private_clean'
  | 'private_empty'
  | 'kitchen_clean'
  | 'common_clean'
  | 'bathroom_clean'
  | 'no_new_damage'
  | 'keys_deposited';

type CheckinArea = 'ROOM' | 'COMMONS';

type CheckinAssessment = {
  clean: boolean | null;
  tidy: boolean | null;
  conditionOk: boolean | null;
  comment: string;
  photos: string[];
};

const checkoutChecklistLabels: Record<CheckoutChecklistKey, string> = {
  private_clean: 'Ma chambre est propre et rangée',
  private_empty: 'J’ai retiré toutes mes affaires personnelles',
  kitchen_clean: 'La cuisine est propre, la vaisselle rangée et mes aliments retirés',
  common_clean: 'Les espaces communs sont propres et remis en ordre',
  bathroom_clean: 'La salle de bain et les sanitaires sont propres',
  no_new_damage: 'Je n’ai constaté aucune nouvelle dégradation non signalée',
  keys_deposited: 'Les clés ont été déposées à l’emplacement prévu',
};

const createPhotoPlaceholder = (category: string, index: number) =>
  `https://picsum.photos/seed/haven-${category}-${Date.now()}-${index}/900/700`;

export const InventoryModal: React.FC<InventoryModalProps> = ({
  isOpen,
  onClose,
  type,
  booking,
  listing,
  room,
  onComplete,
}) => {
  const { currentUser } = useAuth();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isForcedOverride, setIsForcedOverride] = useState(false);
  const [earlyDepartureReason, setEarlyDepartureReason] = useState('');

  const [checkoutChecklist, setCheckoutChecklist] = useState<Record<CheckoutChecklistKey, boolean>>({
    private_clean: false,
    private_empty: false,
    kitchen_clean: false,
    common_clean: false,
    bathroom_clean: false,
    no_new_damage: false,
    keys_deposited: false,
  });

  const [checkoutPhotos, setCheckoutPhotos] = useState<Record<'ROOM' | 'KITCHEN' | 'COMMONS' | 'KEYS' | 'DAMAGE', string[]>>({
    ROOM: [],
    KITCHEN: [],
    COMMONS: [],
    KEYS: [],
    DAMAGE: [],
  });
  const [hasDamage, setHasDamage] = useState(false);
  const [damageDescription, setDamageDescription] = useState('');

  const [checkinAssessments, setCheckinAssessments] = useState<Record<CheckinArea, CheckinAssessment>>({
    ROOM: { clean: null, tidy: null, conditionOk: null, comment: '', photos: [] },
    COMMONS: { clean: null, tidy: null, conditionOk: null, comment: '', photos: [] },
  });

  const [reviews, setReviews] = useState({
    listing: { rating: 5, comment: '' },
    roommates: { rating: 5, comment: '' },
    haven: { rating: 5, comment: '' },
  });

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setError(null);
    setIsForcedOverride(false);
    setEarlyDepartureReason('');
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, type, booking.id]);

  const inventoryTiming = useMemo(
    () => getInventoryTiming(booking, listing, type),
    [booking, listing, type],
  );

  if (!isOpen) return null;

  const toggleCheckoutItem = (key: CheckoutChecklistKey) => {
    setCheckoutChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const addCheckoutPhoto = (category: keyof typeof checkoutPhotos) => {
    setCheckoutPhotos(prev => ({
      ...prev,
      [category]: [...prev[category], createPhotoPlaceholder(category, prev[category].length)],
    }));
  };

  const removeCheckoutPhoto = (category: keyof typeof checkoutPhotos, index: number) => {
    setCheckoutPhotos(prev => ({
      ...prev,
      [category]: prev[category].filter((_, i) => i !== index),
    }));
  };

  const setCheckinChoice = (
    area: CheckinArea,
    field: 'clean' | 'tidy' | 'conditionOk',
    value: boolean,
  ) => {
    setCheckinAssessments(prev => ({
      ...prev,
      [area]: { ...prev[area], [field]: value },
    }));
  };

  const addCheckinPhoto = (area: CheckinArea) => {
    setCheckinAssessments(prev => ({
      ...prev,
      [area]: {
        ...prev[area],
        photos: [...prev[area].photos, createPhotoPlaceholder(`checkin-${area}`, prev[area].photos.length)],
      },
    }));
  };

  const removeCheckinPhoto = (area: CheckinArea, index: number) => {
    setCheckinAssessments(prev => ({
      ...prev,
      [area]: {
        ...prev[area],
        photos: prev[area].photos.filter((_, i) => i !== index),
      },
    }));
  };

  const checkinAreaComplete = (area: CheckinArea) => {
    const assessment = checkinAssessments[area];
    return assessment.clean !== null && assessment.tidy !== null && assessment.conditionOk !== null;
  };

  const checkinHasIssue = (area: CheckinArea) => {
    const assessment = checkinAssessments[area];
    return assessment.clean === false || assessment.tidy === false || assessment.conditionOk === false;
  };

  const checkinIssueComplete = (area: CheckinArea) => {
    if (!checkinHasIssue(area)) return true;
    const assessment = checkinAssessments[area];
    return assessment.comment.trim().length >= 5 && assessment.photos.length >= 1;
  };

  const checkoutStepOneComplete =
    checkoutChecklist.private_clean &&
    checkoutChecklist.private_empty &&
    checkoutPhotos.ROOM.length >= 2;

  const checkoutStepTwoComplete =
    checkoutChecklist.kitchen_clean &&
    checkoutChecklist.common_clean &&
    checkoutChecklist.bathroom_clean &&
    checkoutPhotos.KITCHEN.length >= 1 &&
    checkoutPhotos.COMMONS.length >= 1;

  const checkoutStepThreeComplete =
    checkoutChecklist.keys_deposited &&
    checkoutPhotos.KEYS.length >= 1 &&
    (hasDamage
      ? damageDescription.trim().length >= 5 && checkoutPhotos.DAMAGE.length >= 1
      : checkoutChecklist.no_new_damage);

  const createDocument = async (docType: 'INVENTORY_IN' | 'INVENTORY_OUT') => {
    if (!currentUser) throw new Error('Utilisateur non connecté');
    const label = docType === 'INVENTORY_IN' ? "État des lieux d'entrée" : 'État des lieux de sortie';
    const docId = `doc_${docType === 'INVENTORY_IN' ? 'in' : 'out'}_${booking.id}_${Date.now()}`;
    const inventoryDoc: AppDocument = {
      id: docId,
      userId: currentUser.id,
      bookingId: booking.id,
      title: `${label} - ${listing?.title || 'Logement'}`,
      type: docType,
      url: `https://example.com/reports/${docId}.pdf`,
      createdAt: new Date().toISOString(),
      listingTitle: listing?.title,
    };
    await apiService.documents.create(inventoryDoc);
    return docId;
  };

  const handleSubmit = async () => {
    if (!currentUser) return;
    setIsSubmitting(true);
    setError(null);

    try {
      if (!inventoryTiming.isAvailable && !(type === 'OUT' && isForcedOverride)) {
        throw new Error(`L’état des lieux est disponible à partir du ${formatScheduledMoment(inventoryTiming.scheduledAt)}.`);
      }
      if (type === 'OUT' && inventoryTiming.isEarlyDeparture && earlyDepartureReason.trim().length < 10) {
        throw new Error('Indiquez le motif de votre départ anticipé.');
      }
      if (type === 'IN') {
        if (!checkinAreaComplete('ROOM') || !checkinAreaComplete('COMMONS')) {
          throw new Error('Merci de valider la chambre et les espaces communs.');
        }
        if (!checkinIssueComplete('ROOM') || !checkinIssueComplete('COMMONS')) {
          throw new Error('En cas de non-conformité, ajoutez un commentaire et au moins une photo.');
        }

        const documentId = await createDocument('INVENTORY_IN');
        const nonConformities = (['ROOM', 'COMMONS'] as CheckinArea[])
          .filter(checkinHasIssue)
          .map(area => ({
            area,
            ...checkinAssessments[area],
          }));

        onComplete({
          type: 'IN',
          condition: nonConformities.length === 0 ? 'EXCELLENT' : 'ISSUE_REPORTED',
          checkinAssessments,
          nonConformities,
          documentId,
        });
      } else {
        if (!checkoutStepOneComplete || !checkoutStepTwoComplete || !checkoutStepThreeComplete) {
          throw new Error('Merci de terminer les validations et les photos obligatoires avant de confirmer votre départ.');
        }

        const documentId = await createDocument('INVENTORY_OUT');
        const flatPhotos = Object.values(checkoutPhotos).flat();
        const checklist = {
          ...checkoutChecklist,
          damage_reported: hasDamage,
        };
        const incidentReport = hasDamage
          ? {
              category: 'État du logement',
              subCategory: 'Dégradation signalée au départ',
              description: damageDescription,
              photo: checkoutPhotos.DAMAGE[0] || '',
            }
          : { category: '', subCategory: '', description: '', photo: '' };

        onComplete({
          type: 'OUT',
          condition: 'EXCELLENT',
          checklist,
          photos: checkoutPhotos,
          allPhotos: flatPhotos,
          incidentReport,
          reviews,
          documentId,
          isEarlyDeparture: inventoryTiming.isEarlyDeparture,
          earlyDepartureReason: inventoryTiming.isEarlyDeparture ? earlyDepartureReason.trim() : undefined,
          scheduledDepartureAt: inventoryTiming.scheduledAt.toISOString(),
        });
      }

      setStep(1);
      onClose();
    } catch (e: unknown) {
      console.error('Error creating inventory report', e);
      setError(userFacingErrorMessage(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  const maxSteps = type === 'IN' ? 2 : 4;

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center md:p-4">
      <div className="absolute inset-0 bg-haven-navy/45 backdrop-blur-md" onClick={onClose} />

      <div className="relative bg-white rounded-t-[2rem] md:rounded-[2.5rem] w-full max-w-4xl max-h-[94dvh] md:max-h-[92vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="px-5 py-5 md:px-8 md:py-6 border-b border-gray-100 flex items-center justify-between bg-white">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-haven-red mb-1">
              {type === 'IN' ? 'Arrivée autonome' : 'Départ autonome'}
            </p>
            <h2 className="font-heading font-bold text-xl md:text-2xl text-haven-navy">
              {type === 'IN' ? "Contrôle d'entrée" : 'Restitution du logement'}
            </h2>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              {listing?.title || 'Logement'}{room?.name ? ` • ${room.name}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-gray-100 rounded-full text-gray-500" aria-label="Fermer">
            <X size={22} />
          </button>
        </div>

        <div className="h-1.5 bg-gray-100">
          <div
            className="h-full bg-haven-red transition-all duration-300"
            style={{ width: `${Math.min(100, (step / maxSteps) * 100)}%` }}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-5 md:p-8">
          {type === 'IN' && !inventoryTiming.isAvailable ? (
            <div className="min-h-[420px] flex flex-col items-center justify-center text-center max-w-xl mx-auto space-y-6">
              <div className="w-20 h-20 rounded-full bg-haven-navy/5 text-haven-navy flex items-center justify-center">
                <KeyRound size={36} />
              </div>
              <div>
                <h3 className="text-2xl font-heading font-bold text-haven-navy">Arrivée bientôt disponible</h3>
                <p className="text-gray-600 mt-3 leading-relaxed">
                  Votre état des lieux d’entrée sera disponible à partir du {formatScheduledMoment(inventoryTiming.scheduledAt)}.
                </p>
              </div>
            </div>
          ) : type === 'OUT' && !inventoryTiming.isAvailable && !isForcedOverride ? (
            <div className="min-h-[420px] flex flex-col items-center justify-center text-center max-w-xl mx-auto space-y-6">
              <div className="w-20 h-20 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                <AlertTriangle size={36} />
              </div>
              <div>
                <h3 className="text-2xl font-heading font-bold text-haven-navy">Départ anticipé</h3>
                <p className="text-gray-600 mt-3 leading-relaxed">
                  Le parcours de départ est normalement accessible à partir du {formatScheduledMoment(inventoryTiming.scheduledAt)}.
                  Si vous quittez définitivement le logement avant cette échéance, indiquez votre motif pour poursuivre.
                </p>
              </div>
              <div className="w-full max-w-md space-y-3 text-left">
                <label className="block text-sm font-bold text-haven-navy" htmlFor="early-departure-reason">Motif du départ anticipé</label>
                <textarea
                  id="early-departure-reason"
                  value={earlyDepartureReason}
                  onChange={event => setEarlyDepartureReason(event.target.value)}
                  placeholder="Expliquez brièvement pourquoi vous devez quitter le logement plus tôt."
                  rows={4}
                  className="w-full rounded-2xl border border-gray-200 p-4 text-sm outline-none focus:ring-2 focus:ring-haven-navy/20"
                />
                <Button
                  fullWidth
                  disabled={earlyDepartureReason.trim().length < 10}
                  onClick={() => setIsForcedOverride(true)}
                >
                  Continuer avec un départ anticipé
                </Button>
              </div>
            </div>
          ) : type === 'IN' ? (
            <>
              {step === 1 && (
                <div className="space-y-8">
                  <div className="bg-haven-cream rounded-3xl p-5 md:p-6 border border-gray-100">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="text-haven-red mt-0.5" size={22} />
                      <div>
                        <h3 className="font-bold text-haven-navy">Vous êtes le contrôle qualité final</h3>
                        <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                          À votre arrivée, confirmez simplement que votre chambre et les espaces communs sont propres, rangés et en bon état. En cas de problème, une photo et un commentaire suffisent.
                        </p>
                      </div>
                    </div>
                  </div>

                  <CheckinCard
                    title="Ma chambre"
                    subtitle="Contrôlez la propreté, le rangement et l’état général."
                    assessment={checkinAssessments.ROOM}
                    onChoice={(field, value) => setCheckinChoice('ROOM', field, value)}
                    onComment={comment => setCheckinAssessments(prev => ({ ...prev, ROOM: { ...prev.ROOM, comment } }))}
                    onAddPhoto={() => addCheckinPhoto('ROOM')}
                    onRemovePhoto={index => removeCheckinPhoto('ROOM', index)}
                  />

                  <CheckinCard
                    title="Espaces communs"
                    subtitle="Cuisine, séjour, salle d’eau et circulations."
                    assessment={checkinAssessments.COMMONS}
                    onChoice={(field, value) => setCheckinChoice('COMMONS', field, value)}
                    onComment={comment => setCheckinAssessments(prev => ({ ...prev, COMMONS: { ...prev.COMMONS, comment } }))}
                    onAddPhoto={() => addCheckinPhoto('COMMONS')}
                    onRemovePhoto={index => removeCheckinPhoto('COMMONS', index)}
                  />
                </div>
              )}

              {step === 2 && (
                <div className="max-w-2xl mx-auto text-center py-6 md:py-10 space-y-6">
                  <div className="w-20 h-20 mx-auto rounded-full bg-green-50 text-green-600 flex items-center justify-center">
                    <CheckCircle size={38} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-heading font-bold text-haven-navy">Confirmez votre arrivée</h3>
                    <p className="text-gray-600 mt-3 leading-relaxed">
                      {checkinHasIssue('ROOM') || checkinHasIssue('COMMONS')
                        ? 'Vous avez signalé une non-conformité. Vos photos et commentaires seront conservés avec l’état des lieux horodaté.'
                        : 'Tout est conforme. Votre validation sera conservée comme contrôle d’entrée horodaté.'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-left">
                    <SummaryStatus label="Chambre" ok={!checkinHasIssue('ROOM')} />
                    <SummaryStatus label="Espaces communs" ok={!checkinHasIssue('COMMONS')} />
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {step === 1 && (
                <div className="space-y-7">
                  <IntroBlock
                    icon={<Sparkles size={24} />}
                    title="1. Ma chambre"
                    text="Laissez votre espace privatif propre, rangé, vide de vos affaires et prêt pour le prochain locataire."
                  />
                  <ChecklistItem checked={checkoutChecklist.private_clean} label={checkoutChecklistLabels.private_clean} onClick={() => toggleCheckoutItem('private_clean')} />
                  <ChecklistItem checked={checkoutChecklist.private_empty} label={checkoutChecklistLabels.private_empty} onClick={() => toggleCheckoutItem('private_empty')} />
                  <PhotoSection
                    label="Photos de votre chambre"
                    helper="2 photos minimum"
                    photos={checkoutPhotos.ROOM}
                    onAdd={() => addCheckoutPhoto('ROOM')}
                    onRemove={i => removeCheckoutPhoto('ROOM', i)}
                  />
                </div>
              )}

              {step === 2 && (
                <div className="space-y-7">
                  <IntroBlock
                    icon={<Home size={24} />}
                    title="2. Espaces communs"
                    text="Remettez les espaces partagés au niveau que vous aimeriez trouver en arrivant."
                  />
                  <ChecklistItem checked={checkoutChecklist.kitchen_clean} label={checkoutChecklistLabels.kitchen_clean} onClick={() => toggleCheckoutItem('kitchen_clean')} />
                  <ChecklistItem checked={checkoutChecklist.common_clean} label={checkoutChecklistLabels.common_clean} onClick={() => toggleCheckoutItem('common_clean')} />
                  <ChecklistItem checked={checkoutChecklist.bathroom_clean} label={checkoutChecklistLabels.bathroom_clean} onClick={() => toggleCheckoutItem('bathroom_clean')} />
                  <div className="grid md:grid-cols-2 gap-5">
                    <PhotoSection label="Cuisine" helper="1 photo minimum" photos={checkoutPhotos.KITCHEN} onAdd={() => addCheckoutPhoto('KITCHEN')} onRemove={i => removeCheckoutPhoto('KITCHEN', i)} compact />
                    <PhotoSection label="Espaces communs" helper="1 photo minimum" photos={checkoutPhotos.COMMONS} onAdd={() => addCheckoutPhoto('COMMONS')} onRemove={i => removeCheckoutPhoto('COMMONS', i)} compact />
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-7">
                  <IntroBlock
                    icon={<KeyRound size={24} />}
                    title="3. Clés et état du logement"
                    text="Terminez votre départ de façon autonome et signalez immédiatement toute dégradation nouvelle."
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setHasDamage(false);
                        setCheckoutChecklist(prev => ({ ...prev, no_new_damage: true }));
                      }}
                      className={`p-4 rounded-2xl border text-left transition-all ${!hasDamage && checkoutChecklist.no_new_damage ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                    >
                      <CheckCircle className="text-green-600 mb-2" size={22} />
                      <div className="font-bold text-haven-navy">Aucune nouvelle dégradation</div>
                      <div className="text-xs text-gray-500 mt-1">Le logement est dans l’état attendu.</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHasDamage(true);
                        setCheckoutChecklist(prev => ({ ...prev, no_new_damage: false }));
                      }}
                      className={`p-4 rounded-2xl border text-left transition-all ${hasDamage ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                    >
                      <AlertTriangle className="text-amber-600 mb-2" size={22} />
                      <div className="font-bold text-haven-navy">Je signale une dégradation</div>
                      <div className="text-xs text-gray-500 mt-1">Ajoutez une description et une preuve photo.</div>
                    </button>
                  </div>

                  {hasDamage && (
                    <div className="p-5 rounded-2xl bg-amber-50 border border-amber-100 space-y-4">
                      <textarea
                        value={damageDescription}
                        onChange={e => setDamageDescription(e.target.value)}
                        placeholder="Décrivez précisément la dégradation..."
                        rows={3}
                        className="w-full rounded-xl border border-amber-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                      />
                      <PhotoSection label="Photo de la dégradation" helper="1 photo minimum" photos={checkoutPhotos.DAMAGE} onAdd={() => addCheckoutPhoto('DAMAGE')} onRemove={i => removeCheckoutPhoto('DAMAGE', i)} compact />
                    </div>
                  )}

                  <ChecklistItem checked={checkoutChecklist.keys_deposited} label={checkoutChecklistLabels.keys_deposited} onClick={() => toggleCheckoutItem('keys_deposited')} />
                  <PhotoSection label="Preuve de dépôt des clés" helper="1 photo minimum" photos={checkoutPhotos.KEYS} onAdd={() => addCheckoutPhoto('KEYS')} onRemove={i => removeCheckoutPhoto('KEYS', i)} compact />
                </div>
              )}

              {step === 4 && (
                <div className="space-y-8">
                  <div className="text-center max-w-2xl mx-auto">
                    <div className="w-20 h-20 mx-auto rounded-full bg-haven-red/10 text-haven-red flex items-center justify-center mb-5">
                      <Check size={38} />
                    </div>
                    <h3 className="text-2xl font-heading font-bold text-haven-navy">Dernière étape</h3>
                    <p className="text-gray-600 mt-3">
                      Votre checklist et vos preuves photos seront horodatées. Vous pourrez retrouver votre état des lieux dans vos documents.
                    </p>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <RatingCard title="Le logement" value={reviews.listing.rating} onChange={rating => setReviews(prev => ({ ...prev, listing: { ...prev.listing, rating } }))} />
                    <RatingCard title="La colocation" value={reviews.roommates.rating} onChange={rating => setReviews(prev => ({ ...prev, roommates: { ...prev.roommates, rating } }))} />
                    <RatingCard title="HAVEN" value={reviews.haven.rating} onChange={rating => setReviews(prev => ({ ...prev, haven: { ...prev.haven, rating } }))} />
                  </div>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="mt-6 p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {!((type === 'IN' && !inventoryTiming.isAvailable) || (type === 'OUT' && !inventoryTiming.isAvailable && !isForcedOverride)) && (
          <div className="border-t border-gray-100 bg-white p-4 md:px-8 md:py-5 flex items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => (step === 1 ? onClose() : setStep(prev => Math.max(1, prev - 1)))}
              className="flex items-center gap-2"
            >
              <ChevronLeft size={18} /> {step === 1 ? 'Fermer' : 'Retour'}
            </Button>

            {step < maxSteps ? (
              <Button
                onClick={() => {
                  setError(null);
                  if (type === 'IN' && step === 1) {
                    if (!checkinAreaComplete('ROOM') || !checkinAreaComplete('COMMONS')) {
                      setError('Validez les trois critères pour la chambre et les espaces communs.');
                      return;
                    }
                    if (!checkinIssueComplete('ROOM') || !checkinIssueComplete('COMMONS')) {
                      setError('En cas de non-conformité, ajoutez un commentaire et au moins une photo.');
                      return;
                    }
                  }
                  if (type === 'OUT' && step === 1 && !checkoutStepOneComplete) {
                    setError('Validez les deux points et ajoutez au moins 2 photos de la chambre.');
                    return;
                  }
                  if (type === 'OUT' && step === 2 && !checkoutStepTwoComplete) {
                    setError('Validez les espaces communs et ajoutez les photos demandées.');
                    return;
                  }
                  if (type === 'OUT' && step === 3 && !checkoutStepThreeComplete) {
                    setError(hasDamage ? 'Ajoutez une description et une photo de la dégradation, puis la preuve de dépôt des clés.' : 'Confirmez l’absence de dégradation et ajoutez la preuve de dépôt des clés.');
                    return;
                  }
                  setStep(prev => prev + 1);
                }}
                className="flex items-center gap-2"
              >
                Continuer <ChevronRight size={18} />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isSubmitting} className="flex items-center gap-2">
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                {type === 'IN' ? 'Valider mon arrivée' : 'Valider mon départ'}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const IntroBlock: React.FC<{ icon: React.ReactNode; title: string; text: string }> = ({ icon, title, text }) => (
  <div className="rounded-3xl bg-haven-cream border border-gray-100 p-5 md:p-6 flex items-start gap-4">
    <div className="w-11 h-11 rounded-2xl bg-white text-haven-red flex items-center justify-center shadow-sm shrink-0">{icon}</div>
    <div>
      <h3 className="font-heading font-bold text-xl text-haven-navy">{title}</h3>
      <p className="text-sm text-gray-600 mt-1 leading-relaxed">{text}</p>
    </div>
  </div>
);

const ChecklistItem: React.FC<{ checked: boolean; label: string; onClick: () => void }> = ({ checked, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all ${checked ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 hover:border-gray-300'}`}
  >
    <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${checked ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300 text-transparent'}`}>
      <Check size={15} />
    </span>
    <span className="font-medium text-sm text-haven-navy">{label}</span>
  </button>
);

const PhotoSection: React.FC<{
  label: string;
  helper: string;
  photos: string[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  compact?: boolean;
}> = ({ label, helper, photos, onAdd, onRemove, compact }) => (
  <div className={`rounded-2xl border border-gray-100 bg-gray-50 ${compact ? 'p-4' : 'p-5'}`}>
    <div className="flex items-center justify-between mb-3">
      <div>
        <div className="font-bold text-sm text-haven-navy">{label}</div>
        <div className="text-[11px] text-gray-500">{helper}</div>
      </div>
      <button type="button" onClick={onAdd} className="inline-flex items-center gap-2 rounded-xl bg-white border border-gray-200 px-3 py-2 text-xs font-bold text-haven-navy hover:border-haven-red transition-colors">
        <Camera size={16} /> Ajouter
      </button>
    </div>
    {photos.length > 0 && (
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {photos.map((photo, index) => (
          <div key={`${photo}-${index}`} className="relative aspect-square rounded-xl overflow-hidden bg-gray-200">
            <img src={photo} alt="Preuve" className="w-full h-full object-cover" />
            <button type="button" onClick={() => onRemove(index)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center">
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
);

const CheckinCard: React.FC<{
  title: string;
  subtitle: string;
  assessment: CheckinAssessment;
  onChoice: (field: 'clean' | 'tidy' | 'conditionOk', value: boolean) => void;
  onComment: (comment: string) => void;
  onAddPhoto: () => void;
  onRemovePhoto: (index: number) => void;
}> = ({ title, subtitle, assessment, onChoice, onComment, onAddPhoto, onRemovePhoto }) => {
  const hasIssue = assessment.clean === false || assessment.tidy === false || assessment.conditionOk === false;
  return (
    <div className="rounded-3xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="p-5 md:p-6 border-b border-gray-100">
        <h3 className="font-heading font-bold text-xl text-haven-navy">{title}</h3>
        <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
      </div>
      <div className="p-5 md:p-6 space-y-4">
        <BinaryQuestion label="Propre" value={assessment.clean} onChange={value => onChoice('clean', value)} />
        <BinaryQuestion label="Rangé" value={assessment.tidy} onChange={value => onChoice('tidy', value)} />
        <BinaryQuestion label="Bon état général" value={assessment.conditionOk} onChange={value => onChoice('conditionOk', value)} />

        {hasIssue && (
          <div className="mt-5 rounded-2xl bg-amber-50 border border-amber-100 p-4 space-y-4">
            <div className="flex items-start gap-2 text-amber-800">
              <Info size={18} className="mt-0.5 shrink-0" />
              <p className="text-xs leading-relaxed">Décrivez ce qui n’est pas conforme et ajoutez au moins une photo. Cette preuve sera horodatée.</p>
            </div>
            <textarea
              value={assessment.comment}
              onChange={e => onComment(e.target.value)}
              placeholder="Ex. cuisine sale à mon arrivée, traces sur le plan de travail..."
              rows={3}
              className="w-full rounded-xl border border-amber-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-amber-200"
            />
            <PhotoSection label="Photos de la non-conformité" helper="1 photo minimum" photos={assessment.photos} onAdd={onAddPhoto} onRemove={onRemovePhoto} compact />
          </div>
        )}
      </div>
    </div>
  );
};

const BinaryQuestion: React.FC<{ label: string; value: boolean | null; onChange: (value: boolean) => void }> = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between gap-4 py-2">
    <span className="font-medium text-sm text-haven-navy">{label}</span>
    <div className="flex gap-2">
      <button type="button" onClick={() => onChange(true)} className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all ${value === true ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-500'}`}>Oui</button>
      <button type="button" onClick={() => onChange(false)} className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all ${value === false ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-gray-200 text-gray-500'}`}>Non</button>
    </div>
  </div>
);

const SummaryStatus: React.FC<{ label: string; ok: boolean }> = ({ label, ok }) => (
  <div className={`rounded-2xl border p-4 ${ok ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'}`}>
    <div className={`text-xs font-black uppercase tracking-wider ${ok ? 'text-green-700' : 'text-amber-700'}`}>{ok ? 'Conforme' : 'Signalement'}</div>
    <div className="font-bold text-haven-navy mt-1">{label}</div>
  </div>
);

const RatingCard: React.FC<{ title: string; value: number; onChange: (value: number) => void }> = ({ title, value, onChange }) => (
  <div className="rounded-2xl border border-gray-100 p-5 text-center">
    <div className="font-bold text-haven-navy mb-3">{title}</div>
    <div className="flex justify-center gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button key={star} type="button" onClick={() => onChange(star)} className="p-0.5" aria-label={`${star} étoiles`}>
          <Star size={22} className={star <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-300'} />
        </button>
      ))}
    </div>
  </div>
);
