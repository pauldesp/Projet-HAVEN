
import React, { useState } from 'react';
import { X, Send, AlertCircle, AlertTriangle, Shield, CheckCircle2, Loader2, Camera, Trash2, ChevronLeft } from 'lucide-react';
import { Button } from './Button';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  // State for Report
  const [reason, setReason] = useState<string>('');
  const [description, setDescription] = useState('');

  // State for Incident (if technical/property)
  const [isIncident, setIsIncident] = useState(targetType === 'TECHNICAL');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [photos, setPhotos] = useState<string[]>([]);
  
  const [incidentStep, setIncidentStep] = useState(1);
  const [incidentReport, setIncidentReport] = useState<{ category: string, subCategory: string, description: string, photo: string }>({ 
    category: '', 
    subCategory: '', 
    description: '', 
    photo: '' 
  });

  if (!isOpen) return null;

  const handleSubmitReport = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUser) return;

    if (isIncident) {
      if (!incidentReport.category || !incidentReport.subCategory || !incidentReport.description) {
        toast.error("Veuillez remplir tous les champs de l'incident.");
        return;
      }
    } else {
      if (!reason || !description) {
        toast.error("Veuillez remplir tous les champs obligatoires.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (isIncident && listingId && bookingId && ownerId) {
        // Create an Incident
        const incident = {
          id: crypto.randomUUID(),
          listingId,
          bookingId,
          ownerId,
          reporterId: currentUser.id,
          title: `${incidentReport.category} - ${incidentReport.subCategory}`,
          description: incidentReport.description,
          status: 'NEW' as const,
          createdAt: new Date().toISOString(),
          photos: incidentReport.photo ? [incidentReport.photo] : [],
          priority
        };
        await apiService.incidents.create(incident);
        toast.success("Incident signalé avec succès.");
      } else {
        // Create a standard Report
        const report = {
          id: crypto.randomUUID(),
          reporterId: currentUser.id,
          targetId,
          targetType,
          reason: reason as any,
          description,
          status: 'NEW' as const,
          timestamp: new Date().toISOString()
        };
        await apiService.reports.create(report);
        toast.success("Signalement envoyé à l'équipe de modération.");
      }
      setIsSuccess(true);
    } catch (error) {
      console.error("Error creating report:", error);
      toast.error("Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddPhoto = () => {
    const mockPhoto = `https://picsum.photos/800/600?random=${Date.now()}`;
    setIncidentReport({ ...incidentReport, photo: mockPhoto });
  };

  if (isSuccess) {
    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-haven-navy/40 backdrop-blur-sm">
        <div className="bg-white rounded-[2.5rem] shadow-premium max-w-lg w-full p-10 text-center animate-fade-in-up">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-haven-navy mb-4">Transmission réussie</h2>
          <p className="text-gray-600 mb-8">
            {isIncident 
              ? "Votre incident a été transmis aux équipes HAVEN. Un prestataire reviendra vers vous si nécessaire." 
              : "Merci de nous aider à maintenir HAVEN sûr. Notre équipe de modération va examiner votre demande."}
          </p>
          <Button fullWidth className="h-14 rounded-2xl" onClick={onClose}>Fermer</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-haven-navy/40 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-[2.5rem] shadow-premium max-w-4xl w-full relative animate-fade-in-up flex flex-col max-h-[95vh]">
        
        {/* Header */}
        <div className="p-8 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isIncident ? 'bg-amber-100 text-amber-600' : 'bg-haven-red/10 text-haven-red'}`}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-haven-navy leading-tight">
                {isIncident ? "Signaler un incident" : "Signaler une anomalie"}
              </h2>
              <p className="text-xs text-gray-500 font-medium">Nous intervenons dans les plus brefs délais.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-3 text-gray-400 hover:text-haven-navy hover:bg-gray-100 rounded-full transition-all"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {isIncident ? (
            <div className="space-y-8 animate-fade-in">
              {/* Incident Workflow */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {INCIDENT_CATEGORIES.map(cat => (
                  <button 
                    key={cat.id} 
                    onClick={() => setIncidentReport(prev => ({ ...prev, category: cat.title, subCategory: '' }))} 
                    className={`p-5 rounded-2xl border-2 text-left transition-all group ${incidentReport.category === cat.title ? 'border-amber-500 bg-amber-50/30' : 'border-gray-50 bg-gray-50 group-hover:border-gray-200'}`}
                  >
                    <span className="font-black text-[10px] text-amber-600 opacity-50 block mb-1 group-hover:opacity-100">{cat.id}</span>
                    <span className="font-bold text-xs text-haven-navy">{cat.title}</span>
                  </button>
                ))}
              </div>

              {incidentReport.category && (
                <div className="space-y-6 animate-fade-in-up pt-4 border-t border-gray-100">
                  <label className="block text-[10px] font-black text-amber-700 uppercase tracking-widest">Détails de l'incident</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {(INCIDENT_CATEGORIES.find(c => c.title === incidentReport.category)?.items || []).map(item => (
                      <button 
                        key={item} 
                        onClick={() => setIncidentReport(prev => ({ ...prev, subCategory: item }))} 
                        className={`p-3 rounded-xl border text-left text-[10px] font-bold transition-all ${incidentReport.subCategory === item ? 'bg-amber-600 border-amber-600 text-white' : 'bg-white border-gray-100 text-amber-800 hover:border-amber-200'}`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>

                  {incidentReport.subCategory && (
                    <div className="space-y-6 pt-4 animate-fade-in-up">
                      <div className="space-y-3">
                        <label className="block text-xs font-bold text-haven-navy">Description précise</label>
                        <textarea 
                          rows={4} 
                          className="w-full bg-gray-50 border border-gray-200 p-5 rounded-2xl outline-none focus:border-amber-500 transition-colors text-sm" 
                          placeholder="Décrivez l'incident pour aider nos prestataires..." 
                          value={incidentReport.description} 
                          onChange={e => setIncidentReport({...incidentReport, description: e.target.value})} 
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                           <label className="block text-xs font-bold text-haven-navy">Priorité</label>
                           <div className="flex gap-2">
                              {['LOW', 'MEDIUM', 'HIGH'].map((p) => (
                                <button
                                  key={p}
                                  type="button"
                                  onClick={() => setPriority(p as any)}
                                  className={`flex-1 py-3 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all ${priority === p ? (p === 'HIGH' ? 'bg-red-600 border-red-600 text-white' : 'bg-haven-navy border-haven-navy text-white') : 'border-gray-200 text-gray-400'}`}
                                >
                                  {p === 'LOW' ? 'Basse' : p === 'MEDIUM' ? 'Moyenne' : 'Urgente'}
                                </button>
                              ))}
                           </div>
                        </div>

                        <div className="space-y-3">
                          <label className="block text-xs font-bold text-haven-navy">Photo (conseillé)</label>
                          {incidentReport.photo ? (
                            <div className="relative aspect-video rounded-2xl overflow-hidden border border-gray-200">
                               <img src={incidentReport.photo} className="w-full h-full object-cover" alt="" />
                               <button onClick={() => setIncidentReport({...incidentReport, photo: ''})} className="absolute top-2 right-2 bg-white/90 p-2 rounded-full text-haven-red shadow-sm transform hover:scale-110"><X size={14}/></button>
                            </div>
                          ) : (
                            <button 
                              onClick={handleAddPhoto} 
                              className="w-full py-12 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50/30 transition-all font-bold"
                            >
                              <Camera size={24} />
                              <span className="text-[10px] uppercase tracking-widest">Prendre une photo</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmitReport} className="space-y-8 animate-fade-in">
              <div>
                <label className="block text-sm font-bold text-haven-navy mb-4">Raison du signalement</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { id: 'INACCURATE', label: 'Annonce mensongère' },
                    { id: 'FRAUD', label: 'Arnaque / Fraude' },
                    { id: 'OFFENSIVE', label: 'Contenu inapproprié' },
                    { id: 'SPAM', label: 'Spam' },
                    { id: 'TECHNICAL_ISSUE', label: 'Problème technique' },
                    { id: 'OTHER', label: 'Autre' }
                  ].map(opt => (
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
              </div>

              <div>
                <label className="block text-sm font-bold text-haven-navy mb-3">Complément d'information</label>
                <textarea
                  required
                  rows={6}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Expliquez-nous le problème..."
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:border-haven-navy transition-all resize-none text-sm outline-none"
                />
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-gray-100 bg-gray-50/50 flex gap-4">
          <Button variant="ghost" fullWidth onClick={onClose} type="button" className="h-14 font-bold rounded-2xl">Annuler</Button>
          <Button 
            fullWidth 
            disabled={isSubmitting || (isIncident ? (!incidentReport.subCategory || !incidentReport.description) : !reason)}
            onClick={() => handleSubmitReport()}
            className="h-14 font-bold rounded-2xl shadow-xl shadow-haven-navy/10"
          >
            {isSubmitting ? <Loader2 size={24} className="animate-spin" /> : (isIncident ? "Transmettre l'incident" : "Envoyer le signalement")}
          </Button>
        </div>
      </div>
    </div>
  );
};
