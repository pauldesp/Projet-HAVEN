
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
import { AdminGovernancePage } from './pages/AdminGovernancePage';
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
import { ProtectedRoute } from './components/ProtectedRoute';
import { UserRole } from './types';

import { Toaster, toast } from 'sonner';
import { classifyError, reportError } from './services/errorHandling';

const GOOGLE_MAPS_KEY = (typeof process !== 'undefined' && process.env?.GOOGLE_MAPS_PLATFORM_KEY) || '';
const hasValidMapsKey = Boolean(GOOGLE_MAPS_KEY) && GOOGLE_MAPS_KEY !== 'YOUR_API_KEY';

const MapsProvider: React.FC<{ children: ReactNode }> = ({ children }) =>
  hasValidMapsKey
    ? <APIProvider apiKey={GOOGLE_MAPS_KEY} version="beta">{children}</APIProvider>
    : <>{children}</>;

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

  useEffect(() => {
    const showUnexpectedError = (error: unknown, context: string) => {
      const userError = reportError(error, context);
      toast.error(userError.title, {
        description: `${userError.message} Erreur ${userError.code}.`,
      });
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      showUnexpectedError(event.reason, 'Erreur asynchrone non gérée');
    };
    const onWindowError = (event: ErrorEvent) => {
      event.preventDefault();
      showUnexpectedError(event.error ?? event.message, 'Erreur navigateur non gérée');
    };

    window.addEventListener('unhandledrejection', onUnhandledRejection);
    window.addEventListener('error', onWindowError);
    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener('error', onWindowError);
    };
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
          <Route path="/dashboard" element={<ProtectedRoute><TenantDashboard /></ProtectedRoute>} />
          <Route path="/owner/dashboard" element={<ProtectedRoute roles={[UserRole.OWNER, UserRole.ADMIN]}><OwnerDashboard /></ProtectedRoute>} />
          <Route path="/owner/publish" element={<ProtectedRoute roles={[UserRole.OWNER, UserRole.ADMIN]}><PublishListing /></ProtectedRoute>} />
          <Route path="/owner/edit/:id" element={<ProtectedRoute roles={[UserRole.OWNER, UserRole.ADMIN]}><EditListing /></ProtectedRoute>} />
          <Route path="/admin/dashboard" element={<ProtectedRoute roles={[UserRole.ADMIN]}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/governance" element={<ProtectedRoute roles={[UserRole.ADMIN]}><AdminGovernancePage /></ProtectedRoute>} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/messages/:bookingId" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
          <Route path="/inbox" element={<ProtectedRoute><InboxPage /></ProtectedRoute>} />
          <Route path="/legal/:docId" element={<LegalPage />} />
          <Route path="/inventory/in/:bookingId" element={<ProtectedRoute><EntryInventory /></ProtectedRoute>} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/partners" element={<ForPartners />} />
          <Route path="/become-owner" element={<BecomeOwner />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/help" element={<HelpCenter />} />
          <Route path="/trust-and-safety" element={<TrustAndSafetyPage />} />
          <Route path="/cookies" element={<CookiePolicyPage />} />
          <Route path="/debug/tests" element={<ProtectedRoute roles={[UserRole.ADMIN]}><TestDashboard /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {!isAdminLogin && <Footer />}
    </div>
  );
};

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorCode: string;
  errorMessage: string;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorCode: '500', errorMessage: 'Une difficulté imprévue est survenue.' };
  }

  static getDerivedStateFromError(error: unknown) {
    const userError = classifyError(error);
    return { hasError: true, errorCode: userError.code, errorMessage: userError.message };
  }

  componentDidCatch(error: unknown) {
    reportError(error, 'Erreur d’affichage');
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 text-center font-sans">
          <h1 className="text-haven-red text-2xl font-bold mb-3">Un problème temporaire est survenu</h1>
          <p className="mx-auto max-w-md text-haven-stone">{this.state.errorMessage}</p>
          <p className="mt-3 text-sm font-semibold text-haven-stone">Erreur {this.state.errorCode}</p>
          <div className="mt-6 flex justify-center gap-3">
            <button 
              onClick={() => window.location.hash = '#/'}
              className="px-6 py-2 border border-haven-navy text-haven-navy rounded-xl"
            >
              Accueil
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-haven-navy text-white rounded-xl"
            >
              Réessayer
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <LanguageProvider>
          <ListingProvider>
            <BookingProvider>
              <MapsProvider>
                <HashRouter>
                  <AppContent />
                </HashRouter>
              </MapsProvider>
            </BookingProvider>
          </ListingProvider>
        </LanguageProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
