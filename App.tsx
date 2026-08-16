
import React, { Component, ReactNode, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Home } from './pages/Home';
import { ListingDetails } from './pages/ListingDetails';
import { SearchPage } from './pages/SearchPage';
import { TenantDashboard } from './pages/TenantDashboard';
import { OwnerDashboard } from './pages/OwnerDashboard';
import { PublishListing } from './pages/PublishListing';
import { EditListing } from './pages/EditListing';
import { LoginPage } from './pages/LoginPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { TestDashboard } from './pages/TestDashboard';
import { ProfilePage } from './pages/ProfilePage';
import { ContactPage } from './pages/ContactPage';
import { ChatPage } from './pages/ChatPage';
import { InboxPage } from './pages/InboxPage';
import { LegalPage } from './pages/LegalPage';
import { EntryInventory } from './pages/EntryInventory';
import { HowItWorks } from './pages/HowItWorks';
import { ForPartners } from './pages/ForPartners';
import { BecomeOwner } from './pages/BecomeOwner';
import { FaqPage } from './pages/FaqPage';
import { HelpCenter } from './pages/HelpCenter';
import { TrustAndSafetyPage } from './pages/TrustAndSafetyPage';
import { CookiePolicyPage } from './pages/CookiePolicyPage';
import { AccountStatusOverlay } from './components/AccountStatusOverlay';
import { APIProvider } from '@vis.gl/react-google-maps';
import { LanguageProvider } from './contexts/LanguageContext';
import { ListingProvider } from './contexts/ListingContext';
import { AuthProvider } from './contexts/AuthContext';
import { BookingProvider } from './contexts/BookingContext';

import { Toaster, toast } from 'sonner';

const GOOGLE_MAPS_KEY = (typeof process !== 'undefined' && process.env?.GOOGLE_MAPS_PLATFORM_KEY) || '';
const hasValidMapsKey = Boolean(GOOGLE_MAPS_KEY) && GOOGLE_MAPS_KEY !== 'YOUR_API_KEY';

const AppContent: React.FC = () => {
  const location = useLocation();
  const isAdminLogin = location.pathname === '/admin/login';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('booking') === 'success') {
      toast.success("Réservation confirmée !", {
        description: "Votre paiement a été accepté. Retrouvez vos détails dans votre espace locataire.",
        duration: 8000
      });
      // Nettoyer l'URL
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    } else if (params.get('booking') === 'cancel') {
      toast.error("Paiement annulé", {
        description: "La transaction n'a pas été finalisée. Votre réservation n'est pas confirmée."
      });
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    }
  }, [location.pathname]);

  useEffect(() => {
    const checkHealth = async (retries = 3) => {
      try {
        const res = await fetch('/api/health');
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        console.log("Server health:", data);
      } catch (err) {
        console.error("Server health check attempt failed:", err);
        if (retries > 0) {
          console.log(`Retrying health check... (${retries} left)`);
          setTimeout(() => checkHealth(retries - 1), 2000);
        } else {
          console.error("Server health check failed after retries:", err);
        }
      }
    };

    // Wait 2 seconds before first check to allow server to stabilize
    const timer = setTimeout(() => checkHealth(), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-haven-cream font-body text-haven-navy">
      <Toaster position="top-right" richColors />
      {!isAdminLogin && <Header />}
      
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/listing/:id" element={<ListingDetails />} />
          <Route path="/profile/:id" element={<ProfilePage />} />
          <Route path="/dashboard" element={<TenantDashboard />} />
          <Route path="/owner/dashboard" element={<OwnerDashboard />} />
          <Route path="/owner/publish" element={<PublishListing />} />
          <Route path="/owner/edit/:id" element={<EditListing />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/messages/:bookingId" element={<ChatPage />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/legal/:docId" element={<LegalPage />} />
          <Route path="/inventory/in/:bookingId" element={<EntryInventory />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/partners" element={<ForPartners />} />
          <Route path="/become-owner" element={<BecomeOwner />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/help" element={<HelpCenter />} />
          <Route path="/trust-and-safety" element={<TrustAndSafetyPage />} />
          <Route path="/cookies" element={<CookiePolicyPage />} />
          <Route path="/debug/tests" element={<TestDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {!isAdminLogin && <Footer />}
    </div>
  );
};

const MapsKeySplashScreen: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen bg-haven-cream p-6 font-body">
    <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center border border-haven-navy/5">
      <div className="w-16 h-16 bg-haven-navy/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <span className="text-2xl">🗺️</span>
      </div>
      <h2 className="text-2xl font-heading font-bold text-haven-navy mb-4">Clé API Google Maps requise</h2>
      <p className="text-gray-600 mb-8 leading-relaxed">
        Pour activer la recherche intelligente des villes, vous devez ajouter votre clé API Google Maps.
      </p>
      
      <div className="space-y-4 text-left bg-gray-50 p-6 rounded-2xl border border-gray-100 mb-8">
        <p className="text-sm font-bold text-haven-navy uppercase tracking-wider">Instructions :</p>
        <ol className="text-sm text-gray-600 space-y-3 list-decimal list-inside">
          <li>Obtenez une clé API sur la <a href="https://console.cloud.google.com/google/maps-apis/credentials" target="_blank" rel="noopener" className="text-haven-red font-bold hover:underline">Console Google Cloud</a></li>
          <li>Ouvrez les <strong>Paramètres</strong> (icône ⚙️ en haut à droite)</li>
          <li>Allez dans <strong>Secrets</strong></li>
          <li>Ajoutez <code>GOOGLE_MAPS_PLATFORM_KEY</code> avec votre clé</li>
        </ol>
      </div>
      
      <p className="text-xs text-gray-400 italic">
        L'application redémarrera automatiquement une fois la clé ajoutée.
      </p>
    </div>
  </div>
);

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 text-center font-sans">
          <h1 className="text-haven-red text-2xl font-bold mb-4">Une erreur est survenue</h1>
          <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto max-w-full text-left inline-block">
            {this.state.error?.message || String(this.state.error)}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            className="block mx-auto mt-6 px-6 py-2 bg-haven-navy text-white rounded-xl"
          >
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const App: React.FC = () => {
  if (!hasValidMapsKey) {
    return <MapsKeySplashScreen />;
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <LanguageProvider>
          <ListingProvider>
            <BookingProvider>
              <APIProvider apiKey={GOOGLE_MAPS_KEY} version="beta">
                <HashRouter>
                  <AppContent />
                </HashRouter>
              </APIProvider>
            </BookingProvider>
          </ListingProvider>
        </LanguageProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
