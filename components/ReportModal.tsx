import { useSheet } from './useSheet';
import { pickFile } from '../services/filePicker';

import React, { useState, useEffect, useRef } from 'react';
import { X, AlertTriangle, CheckCircle2, Loader2, Camera } from 'lucide-react';
import { Button } from './Button';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { HAVEN_REPORT_REASONS, LISTING_REPORT_REASONS, havenReportReason, stayIssueDestination, createIssueId, type ReportReasonOption } from '../services/stayIssueRouting';
import { prepareVerificationDocument } from '../services/verificationDocument';
import { INCIDENT_CATEGORIES } from '../src/constants';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string;
  targetType: 'LISTING' | 'USER' | 'MESSAGE' | 'TECHNICAL' | 'OTHER';
  listingId?: string; // Optional, for incidents
  bookingId?: string; // Optional, for incidents
  ownerId?: string; // Optional, for incidents
}

function StepSummary({ label, value, onChange }: { label: string; value: string; onChange: () => void }) {
  return <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/40 px-4 py-3">
    <p className="min-w-0 text-sm"><span className="text-gray-500">{label} : </span><span className="font-bold text-haven-navy">{value}</span></p>
    <button type="button" onClick={onChange} className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-amber-700 underline underline-offset-2">Modifier</button>
  </div>;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  targetId,
  targetType,
  listingId,
  bookingId,
  ownerId
}) => {
  const { currentUser } = useAuth();
  const [requestId, setRequestId] = useState(createIssueId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Centered dialog: no drag, but it leaves with a short fade instead of vanishing.
  const sheet = useSheet(onClose, { sheetBelow: 1 });
  const [isSuccess, setIsSuccess] = useState(false);

  // State for Report
  const [reason, setReason] = useState<string>('');
  const [description, setDescription] = useState('');

  // State for Incident (if technical/property)
  const [isIncident, setIsIncident] = useState(targetType === 'TECHNICAL');
  // Each answer reveals the next step right below it: bring it into view (the form scrolls inside the dialog on phones).
  const nextStepRef = useRef<HTMLDivElement>(null);
  const revealNextStep = () => window.setTimeout(() => nextStepRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');

  const [incidentReport, setIncidentReport] = useState<{ category: string, subCategory: string, description: string, photo: string }>({
    category: '',
    subCategory: '',
    description: '',
    photo: ''
  });

  useEffect(() => {
    if (!isOpen) return;
    setRequestId(createIssueId());
    setIsIncident(targetType === 'TECHNICAL');
    setIsSuccess(false); setReason(''); setDescription(''); setPriority('MEDIUM');
    setIncidentReport({ category: '', subCategory: '', description: '', photo: '' });
  }, [isOpen, targetId, targetType, bookingId]);
  const isListingReport = targetType === 'LISTING' && !bookingId;
  const reportReasons: readonly ReportReasonOption[] = isListingReport ? LISTING_REPORT_REASONS : HAVEN_REPORT_REASONS;
  const destination = isIncident ? stayIssueDestination(incidentReport.category, incidentReport.subCategory) : 'HAVEN';
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [isOpen]);
  if (!isOpen) return null;

  const handleSubmitReport = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUser || isSubmitting) return;

    if (isIncident) {
      if (!incidentReport.category || !incidentReport.subCategory || !incidentReport.description.trim()) {
        toast.error("Veuillez remplir tous les champs de l'incident.");
        return;
      }
    } else {
      if (!reason || !description.trim()) {
        toast.error("Veuillez remplir tous les champs obligatoires.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (isIncident) {
        if (!listingId || !bookingId || !ownerId) throw new Error('Le séjour associé à cet incident est introuvable.');
        await apiService.stayIssues.create({
          id: requestId, listingId, bookingId, ownerId, reporterId: currentUser.id,
          category: incidentReport.category, subCategory: incidentReport.subCategory,
          description: incidentReport.description, photo: incidentReport.photo,
          priority, createdAt: new Date().toISOString()
        });
        toast.success(destination === 'OWNER' ? 'Incident transmis au propriétaire.' : 'Signalement transmis à Haven.');
      } else {
        // Create a standard Report
        const report = {
          id: requestId,
          reporterId: currentUser.id,
          targetId,
          targetType,
          ...havenReportReason(reason, reportReasons),
          description: description.trim(),
          status: 'NEW' as const,
          ...(bookingId && listingId && ownerId ? { bookingId, listingId, ownerId } : {}),
          timestamp: new Date().toISOString()
        };
        await apiService.reports.create(report);
        toast.success("Signalement envoyé à l'équipe de modération.");
      }
      setIsSuccess(true);
    } catch (error) {
      console.error("Error creating report:", error);
      toast.error(error instanceof Error ? error.message : "Impossible de transmettre votre demande.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddPhoto = () => {
    void pickFile('image/*').then(async file => {
      if (!file) return;
      try {
        const photo = await prepareVerificationDocument(file);
        setIncidentReport(previous => ({ ...previous, photo }));
      } catch (error) { toast.error(error instanceof Error ? error.message : 'Impossible de charger la photo.'); }
    });
  };

  if (isSuccess) {
    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-haven-navy/40 backdrop-blur-sm">
        <div className="bg-white rounded-[1.75rem] sm:rounded-[2rem] shadow-premium max-w-lg w-full p-5 sm:p-10 text-center animate-fade-in-up">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-haven-navy mb-4">Transmission réussie</h2>
          <p className="text-gray-600 mb-8">
            {destination === 'OWNER'
              ? "Votre incident a été transmis au propriétaire du logement pour prise en charge. Haven peut en consulter le suivi."
              : "Merci de nous aider à maintenir HAVEN sûr. Notre équipe de modération va examiner votre demande."}
          </p>
          <Button fullWidth className="h-14 rounded-2xl" onClick={onClose}>Fermer</Button>
        </div>
      </div>
    );
  }

  return (
    <div ref={sheet.backdropRef} className="haven-backdrop fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-6 bg-haven-navy/40 backdrop-blur-sm overflow-y-auto">
      <div ref={sheet.panelRef} className="haven-sheet haven-dialog-panel bg-white rounded-[1.75rem] sm:rounded-[2rem] shadow-premium max-w-4xl w-full relative flex flex-col max-h-[95dvh]">

        {/* Header */}
        <div className="shrink-0 p-4 sm:p-8 border-b border-gray-100 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center ${isIncident ? 'bg-amber-100 text-amber-600' : 'bg-haven-red/10 text-haven-red'}`}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-haven-navy leading-tight">
                {isIncident ? "Signaler un incident" : isListingReport ? "Signaler cette annonce" : "Demander l’intervention de Haven"}
              </h2>
              <p className="text-xs text-gray-500 font-medium">{destination === 'OWNER' ? 'Le propriétaire prend en charge les problèmes du logement.' : isListingReport ? 'Haven vérifiera ce que vous avez constaté sur l’annonce ou le logement.' : 'Haven examine les situations nécessitant son intervention.'}</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fermer"
            onClick={sheet.requestClose}
            className="shrink-0 p-3 text-gray-400 hover:text-haven-navy hover:bg-gray-100 rounded-full transition-all"
          >
            <X size={24} />
          </button>
        </div>

        <div className="haven-dialog-scroll flex-1 overflow-y-auto p-4 sm:p-8 space-y-8">
          {bookingId && listingId && ownerId && <div className="grid gap-3 sm:grid-cols-2">
            <Button variant={isIncident ? 'primary' : 'outline'} disabled={isSubmitting} onClick={() => setIsIncident(true)}>Incident au propriétaire</Button>
            <Button variant={!isIncident ? 'primary' : 'outline'} disabled={isSubmitting} onClick={() => setIsIncident(false)}>Signalement à Haven</Button>
          </div>}
          {isIncident ? (
            <div className="space-y-4 animate-fade-in">
              {/* Step 1: theme. Once chosen, the list folds into one line that can be reopened. */}
              {!incidentReport.category ? <>
                <p className="text-sm font-bold text-haven-navy">1. Quel est le thème du problème ?</p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {INCIDENT_CATEGORIES.map(cat => (
                    <button key={cat.id} type="button" onClick={() => { setIncidentReport(prev => ({ ...prev, category: cat.title, subCategory: '' })); revealNextStep(); }}
                      className="flex min-h-14 items-center gap-3 rounded-2xl border-2 border-gray-50 bg-gray-50 p-4 text-left transition-all hover:border-amber-200">
                      <span className="text-[11px] font-bold text-amber-600">{cat.id}</span>
                      <span className="text-sm font-bold text-haven-navy">{cat.title}</span>
                    </button>
                  ))}
                </div>
              </> : <StepSummary label="Thème" value={incidentReport.category} onChange={() => setIncidentReport(prev => ({ ...prev, category: '', subCategory: '' }))} />}

              {/* Step 2: precise problem within the theme. */}
              {incidentReport.category && (!incidentReport.subCategory ? <div ref={nextStepRef} className="space-y-3 animate-fade-in-up">
                <p className="text-sm font-bold text-haven-navy">2. Quel est le problème exactement ?</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(INCIDENT_CATEGORIES.find(c => c.title === incidentReport.category)?.items || []).map(item => (
                    <button key={item} type="button" onClick={() => { setIncidentReport(prev => ({ ...prev, subCategory: item })); revealNextStep(); }}
                      className="min-h-12 rounded-xl border border-amber-100 bg-white p-3 text-left text-sm font-semibold text-amber-900 transition-all hover:border-amber-300 hover:bg-amber-50/40">
                      {item}
                    </button>
                  ))}
                </div>
              </div> : <StepSummary label="Problème" value={incidentReport.subCategory} onChange={() => setIncidentReport(prev => ({ ...prev, subCategory: '' }))} />)}

              {/* Step 3: details, adapted to who will handle it. */}
              {incidentReport.subCategory && <div ref={nextStepRef} className="space-y-5 animate-fade-in-up">
                <p className="rounded-xl bg-blue-50 p-4 text-sm text-haven-navy">{destination === 'OWNER' ? 'Ce problème est transmis au propriétaire, qui le prend en charge. Haven peut intervenir s’il n’est pas résolu.' : 'Cette situation nécessite l’intervention de Haven : elle est transmise directement à l’équipe.'}</p>
                <div className="space-y-2">
                  <label htmlFor="incident-description" className="block text-sm font-bold text-haven-navy">3. Décrivez ce que vous constatez</label>
                  <textarea id="incident-description" rows={4} maxLength={4999}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm outline-none transition-colors focus:border-amber-500"
                    placeholder="Où, depuis quand, ce qui ne fonctionne pas ou n’est pas conforme…"
                    value={incidentReport.description}
                    onChange={e => setIncidentReport({ ...incidentReport, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-haven-navy">Urgence</p>
                    <div className="flex gap-2">
                      {(['LOW', 'MEDIUM', 'HIGH'] as const).map(p => (
                        <button key={p} type="button" aria-pressed={priority === p} onClick={() => setPriority(p)}
                          className={`min-h-11 flex-1 rounded-xl border text-xs font-bold transition-all ${priority === p ? (p === 'HIGH' ? 'border-red-600 bg-red-600 text-white' : 'border-haven-navy bg-haven-navy text-white') : 'border-gray-200 text-gray-500'}`}>
                          {p === 'LOW' ? 'Peut attendre' : p === 'MEDIUM' ? 'Gênant' : 'Urgent'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-haven-navy">Photo (conseillé)</p>
                    {incidentReport.photo ? (
                      <div className="relative aspect-video overflow-hidden rounded-2xl border border-gray-200">
                        <img src={incidentReport.photo} className="h-full w-full object-cover" alt="Photo jointe" />
                        <button type="button" aria-label="Retirer la photo" onClick={() => setIncidentReport({ ...incidentReport, photo: '' })} className="absolute right-2 top-2 rounded-full bg-white/90 p-2 text-haven-red shadow-sm"><X size={14} /></button>
                      </div>
                    ) : (
                      <button type="button" onClick={handleAddPhoto}
                        className="flex min-h-24 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 font-bold text-gray-500 transition-all hover:border-amber-300 hover:bg-amber-50/30 hover:text-amber-600">
                        <Camera size={22} />
                        <span className="text-xs">Prendre ou choisir une photo</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>}
            </div>
          ) : (
            <form onSubmit={handleSubmitReport} className="space-y-8 animate-fade-in">
              <div>
                <label className="block text-sm font-bold text-haven-navy mb-4">Raison du signalement</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {reportReasons.map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setReason(opt.id)}
                      className={`px-5 py-4 rounded-xl border-2 text-sm font-bold transition-all text-left flex items-center justify-between ${reason === opt.id ? 'border-haven-navy bg-haven-navy/5 text-haven-navy' : 'border-gray-50 bg-gray-50 text-gray-600 hover:border-gray-200'}`}
                    >
                      {opt.label}
                      {reason === opt.id && <CheckCircle2 size={18} />}
                    </button>
                  ))}
                </div>
                {isListingReport && <p className="mt-3 text-xs text-gray-500">Un problème pendant un séjour réservé ? Signalez-le depuis la réservation concernée, dans votre espace.</p>}
              </div>

              <div>
                <label className="block text-sm font-bold text-haven-navy mb-3">Complément d'information</label>
                <textarea
                  required
                  rows={6} maxLength={4999}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={isListingReport ? 'Décrivez ce que vous avez constaté sur l’annonce ou le logement...' : 'Expliquez-nous le problème...'}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:border-haven-navy transition-all resize-none text-sm outline-none"
                />
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="haven-dialog-footer shrink-0 p-4 sm:p-8 border-t border-gray-100 bg-gray-50/50 flex gap-4">
          <Button variant="ghost" fullWidth onClick={onClose} type="button" className="h-14 font-bold rounded-2xl">Annuler</Button>
          <Button
            fullWidth
            disabled={isSubmitting || (isIncident ? (!incidentReport.subCategory || !incidentReport.description.trim()) : !reason)}
            onClick={() => handleSubmitReport()}
            className="h-14 font-bold rounded-2xl shadow-xl shadow-haven-navy/10"
          >
            {isSubmitting ? <Loader2 size={24} className="animate-spin" /> : (destination === 'OWNER' ? "Transmettre au propriétaire" : isListingReport ? "Envoyer" : "Envoyer à Haven")}
          </Button>
        </div>
      </div>
    </div>
  );
};
