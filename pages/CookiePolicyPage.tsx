import React, { useState } from 'react';
import { BarChart3, Cookie, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { audienceOptedOut, setAudienceOptOut } from '../services/analyticsClient';

/** What Haven stores on the visitor's device, stated plainly; and the opt-out of audience measurement. */
const STORAGE = [
  { name: 'Session de connexion', where: 'Stockage du navigateur (IndexedDB), par Firebase Authentication (Google)', why: 'Vous garder connecté d’une page à l’autre.', duration: 'Jusqu’à la déconnexion' },
  { name: 'Langue choisie', where: 'Stockage local (haven-language)', why: 'Afficher le site dans votre langue.', duration: 'Jusqu’à ce que vous la changiez' },
  { name: 'Repères de visite', where: 'Stockage de session (haven-visit, haven-step-…)', why: 'Ne pas compter deux fois la même visite dans la mesure d’audience. Aucun identifiant.', duration: 'Effacés à la fermeture de l’onglet' },
  { name: 'Choix sur la mesure d’audience', where: 'Stockage local (haven-audience-optout)', why: 'Retenir votre refus d’être compté.', duration: 'Jusqu’à ce que vous changiez d’avis' },
  { name: 'Paiement', where: 'Cookies déposés par Stripe, uniquement sur sa page de paiement', why: 'Sécuriser le paiement et prévenir la fraude.', duration: 'Voir la politique de Stripe' },
];

export const CookiePolicyPage: React.FC = () => {
  const [optedOut, setOptedOut] = useState(audienceOptedOut);
  const toggle = () => {
    const next = !optedOut;
    setAudienceOptOut(next);
    setOptedOut(next);
    toast.success(next ? 'Vos visites ne seront plus comptées.' : 'Vos visites seront de nouveau comptées, de façon anonyme.');
  };

  return (
    <div className="bg-haven-cream min-h-screen py-8 sm:py-16 px-4 sm:px-6 lg:px-8 mt-4 sm:mt-12 animate-fade-in">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8 sm:mb-12">
          <span className="px-4 py-1.5 bg-haven-navy/5 text-haven-ink rounded-full text-xs font-bold">Vie privée</span>
          <h1 className="text-[1.75rem] sm:text-4xl font-heading font-normal text-haven-ink mt-4 mb-4">Cookies et stockage sur votre appareil</h1>
          <p className="text-sm text-gray-500 max-w-xl mx-auto">Haven n’utilise aucun cookie publicitaire ni outil de suivi d’un site à l’autre. Voici tout ce qui est enregistré sur votre appareil, et pourquoi.</p>
        </div>

        <div className="bg-white rounded-[1.75rem] sm:rounded-[2rem] p-5 sm:p-10 border border-gray-100 shadow-premium mb-6 space-y-6">
          <div className="flex gap-4 items-start">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0"><Cookie size={20} aria-hidden="true" /></div>
            <div>
              <h2 className="font-heading font-normal text-lg text-haven-ink">Uniquement le nécessaire</h2>
              <p className="mt-1 text-sm text-gray-600 leading-relaxed">Ces éléments servent au fonctionnement du site ou à une mesure d’audience anonyme. Ils ne demandent pas votre accord préalable, c’est pourquoi aucun bandeau ne s’affiche.</p>
            </div>
          </div>
          <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
            {STORAGE.map(item => <li key={item.name} className="p-4 text-sm">
              <p className="font-semibold text-haven-ink">{item.name}</p>
              <p className="mt-0.5 text-gray-600">{item.why}</p>
              <p className="mt-1 text-xs text-gray-400">{item.where} · {item.duration}</p>
            </li>)}
          </ul>
        </div>

        <div className="bg-white rounded-[1.75rem] sm:rounded-[2rem] p-5 sm:p-10 border border-gray-100 shadow-premium mb-6 space-y-4">
          <div className="flex gap-4 items-start">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0"><BarChart3 size={20} aria-hidden="true" /></div>
            <div>
              <h2 className="font-heading font-normal text-lg text-haven-ink">Mesure d’audience</h2>
              <p className="mt-1 text-sm text-gray-600 leading-relaxed">Haven compte ses visites avec son propre outil, sans cookie et sans rien transmettre à un tiers : type de page consultée, site d’origine (par exemple Google), type d’appareil et ville recherchée. Aucun identifiant ni adresse IP n’est conservé ; seuls des totaux par jour sont gardés, 25 mois au plus. Si votre navigateur demande à ne pas être suivi (« Do Not Track » ou « Global Privacy Control »), vous n’êtes pas compté.</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-2xl bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-haven-ink"><strong>{optedOut ? 'Vos visites ne sont pas comptées.' : 'Vos visites sont comptées de façon anonyme.'}</strong><span className="block text-xs text-gray-500">Ce choix est enregistré sur cet appareil et ce navigateur.</span></p>
            <button type="button" onClick={toggle} aria-pressed={optedOut} className="min-h-11 shrink-0 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-haven-ink">
              {optedOut ? 'Accepter d’être compté' : 'Ne plus être compté'}
            </button>
          </div>
        </div>

        <div className="bg-haven-navy rounded-[1.75rem] sm:rounded-[2rem] p-5 sm:p-8 text-white flex flex-col sm:flex-row gap-6 items-center shadow-premium">
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center shrink-0"><ShieldCheck size={22} aria-hidden="true" /></div>
          <div>
            <h2 className="font-heading font-normal text-lg mb-1">Vos données personnelles</h2>
            <p className="text-sm text-gray-300 leading-relaxed">Les informations de votre compte, vos justificatifs et vos réservations sont décrits dans notre politique de confidentialité, avec vos droits et la manière de les exercer. Vous pouvez aussi télécharger ou supprimer vos données depuis « Mon compte ».</p>
          </div>
        </div>
      </div>
    </div>
  );
};
