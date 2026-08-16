import React, { useState } from 'react';
import { Shield, Cookie, CheckCircle2, Lock, ArrowLeft, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export const CookiePolicyPage: React.FC = () => {
  const [preferences, setPreferences] = useState({
    essential: true, // cannot be disabled
    functional: true,
    analytics: false
  });

  const handleSave = () => {
    // Save to localStorage or mock service
    localStorage.setItem('cookie_preferences', JSON.stringify(preferences));
    toast.success("Vos préférences de cookies ont été enregistrées avec succès !");
  };

  return (
    <div className="bg-haven-cream min-h-screen py-16 px-4 sm:px-6 lg:px-8 mt-12 animate-fade-in">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="px-4 py-1.5 bg-haven-navy/5 text-haven-navy rounded-full text-xs font-black uppercase tracking-widest">
            Vie Privée
          </span>
          <h1 className="text-4xl font-heading font-black text-haven-navy mt-4 mb-4">
            Politique d'utilisation des Cookies
          </h1>
          <p className="text-sm text-gray-500 max-w-xl mx-auto font-medium">
            Découvrez en toute transparence comment nous protégeons vos données privées et comment nous exploitons les technologies de stockage local sur HAVEN.
          </p>
        </div>

        {/* Content Box */}
        <div className="bg-white rounded-[2.5rem] p-8 sm:p-12 border border-gray-100 shadow-premium mb-12 space-y-8">
          <div className="flex gap-4 items-start pb-6 border-b border-gray-50">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <Cookie size={20} />
            </div>
            <div className="space-y-2">
              <h3 className="font-heading font-bold text-lg text-haven-navy">Qu'est-ce qu'un Cookie ?</h3>
              <p className="text-xs text-gray-500 leading-relaxed font-semibold">
                Un cookie est un petit fichier texte stocké sur votre terminal mobile ou d'ordinateur. Sur HAVEN, nous privilégions le stockage local sécurisé (localStorage/IndexedDB) afin de garantir la persistance de vos réservations, de votre session d'authentification et de vos échanges dans la messagerie sans ralentir la plateforme.
              </p>
            </div>
          </div>

          {/* Preference Toggles */}
          <div className="space-y-6 pt-2">
            <h4 className="text-sm font-black text-haven-navy uppercase tracking-wider mb-4">Gérer mes préférences de cookies</h4>
            
            {/* 1. Essential */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gray-50 rounded-2xl">
              <div className="max-w-md">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-haven-navy">Option 1: Cookies Essentiels (Obligatoires)</span>
                  <span className="bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded">Système</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1 font-semibold leading-relaxed">
                  Nécessaires au fonctionnement fluide et autonome du site. Ils permettent de mémoriser votre compte authentifié, la langue sélectionnée (Français, Anglais, Espagnol) et le statut de vos baux locatifs Stripe.
                </p>
              </div>
              <div>
                <button
                  disabled
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold leading-none cursor-not-allowed"
                >
                  Activé
                </button>
              </div>
            </div>

            {/* 2. Functional */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gray-50 rounded-2xl">
              <div className="max-w-md">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-haven-navy">Option 2: Cookies de Fonctionnalité</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1 font-semibold leading-relaxed">
                  Servent à mémoriser vos options de filtrage de recherche (localisation des colocations, fourchette de loyers) et de réactiver votre dernière session de chat sans reconnexion lourde.
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => setPreferences(p => ({ ...p, functional: !p.functional }))}
                  className={`px-4 py-2 rounded-lg text-xs font-bold leading-none transition-all ${
                    preferences.functional
                      ? 'bg-haven-navy text-white hover:bg-slate-900'
                      : 'bg-white border border-gray-200 text-gray-400'
                  }`}
                >
                  {preferences.functional ? "Activé" : "Désactivé"}
                </button>
              </div>
            </div>

            {/* 3. Analytics */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gray-50 rounded-2xl">
              <div className="max-w-md">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-haven-navy">Option 3: Cookies d'Analyse d'Audience</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1 font-semibold leading-relaxed">
                  Permettent de comprendre comment nos visiteurs interagissent et naviguent sur la plateforme d'annonces. Nous exploitons des statistiques agrégées et totalement anonymes pour repenser la fluidité ergonomique.
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => setPreferences(p => ({ ...p, analytics: !p.analytics }))}
                  className={`px-4 py-2 rounded-lg text-xs font-bold leading-none transition-all ${
                    preferences.analytics
                      ? 'bg-haven-navy text-white hover:bg-slate-900'
                      : 'bg-white border border-gray-200 text-gray-400'
                  }`}
                >
                  {preferences.analytics ? "Activé" : "Désactivé"}
                </button>
              </div>
            </div>

          </div>

          <div className="pt-6 border-t border-gray-50 flex justify-end">
            <button
              onClick={handleSave}
              className="px-6 py-3.5 bg-haven-red hover:bg-red-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md"
            >
              Enregistrer mes préférences
            </button>
          </div>
        </div>

        {/* Security pledge */}
        <div className="bg-haven-navy rounded-[2.5rem] p-8 text-white flex flex-col sm:flex-row gap-6 items-center shadow-premium">
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center shrink-0">
            <Lock size={22} className="text-haven-red" />
          </div>
          <div>
            <h4 className="font-heading font-bold text-lg mb-1">Garantie Souveraine RGPD</h4>
            <p className="text-[11px] text-gray-300 leading-relaxed font-semibold">
              HAVEN se conforme strictement à la réglementation générale sur la protection des données (RGPD). Vos documents d'identité sont cryptés et ne servent qu'à la validation contractuelle de vos colocations d'excellence. Ils ne sont jamais revendus à des tiers.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
