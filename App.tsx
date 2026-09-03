
import React, { Component, ReactNode, Suspense, lazy, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { LanguageProvider } from './contexts/LanguageContext';
import { ListingProvider } from './contexts/ListingContext';
import { AuthProvider } from './contexts/AuthContext';
import { BookingProvider } from './contexts/BookingContext';
import { hasGoogleMaps } from './src/config';
import { MobileBottomNav } from './components/MobileBottomNav';
import { ScreenLoader } from './components/ScreenLoader';

import { Toaster, toast } from 'sonner';

const Home = lazy(() => import('./pages/Home').then(module => ({ default: module.Home })));
const SearchPage = lazy(() => import('./pages/SearchPage').then(module => ({ default: module.SearchPage })));
const ListingDetails = lazy(() => import('./pages/ListingDetails').then(module => ({ default: module.ListingDetails })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(module => ({ default: module.ProfilePage })));
const TenantDashboard = lazy(() => import('./pages/TenantDashboard').then(module => ({ default: module.TenantDashboard })));
const OwnerDashboard = lazy(() => import('./pages/OwnerDashboard').then(module => ({ default: module.OwnerDashboard })));
const PublishListing = lazy(() => import('./pages/PublishListing').then(module => ({ default: module.PublishListing })));
const EditListing = lazy(() => import('./pages/EditListing').then(module => ({ default: module.EditListing })));
const LoginPage = lazy(() => import('./pages/LoginPage').then(module => ({ default: module.LoginPage })));
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage').then(module => ({ default: module.AdminLoginPage })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then(module => ({ default: module.AdminDashboard })));
const TestDashboard = lazy(() => import('./pages/TestDashboard').then(module => ({ default: module.TestDashboard })));
const ContactPage = lazy(() => import('./pages/ContactPage').then(module => ({ default: module.ContactPage })));
const ChatPage = lazy(() => import('./pages/ChatPage').then(module => ({ default: module.ChatPage })));
const InboxPage = lazy(() => import('./pages/InboxPage').then(module => ({ default: module.InboxPage })));
const LegalPage = lazy(() => import('./pages/LegalPage').then(module => ({ default: module.LegalPage })));
const EntryInventory = lazy(() => import('./pages/EntryInventory').then(module => ({ default: module.EntryInventory })));
const HowItWorks = lazy(() => import('./pages/HowItWorks').then(module => ({ default: module.HowItWorks })));
const ForPartners = lazy(() => import('./pages/ForPartners').then(module => ({ default: module.ForPartners })));
const BecomeOwner = lazy(() => import('./pages/BecomeOwner').then(module => ({ default: module.BecomeOwner })));
const FaqPage = lazy(() => import('./pages/FaqPage').then(module => ({ default: module.FaqPage })));
const HelpCenter = lazy(() => import('./pages/HelpCenter').then(module => ({ default: module.HelpCenter })));
const TrustAndSafetyPage = lazy(() => import('./pages/TrustAndSafetyPage').then(module => ({ default: module.TrustAndSafetyPage })));
const CookiePolicyPage = lazy(() => import('./pages/CookiePolicyPage').then(module => ({ default: module.CookiePolicyPage })));
const MapsAppProvider = lazy(() => import('./components/MapsAppProvider').then(module => ({ default: module.MapsAppProvider })));

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
      
      <main className="flex-grow pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <Suspense fallback={<ScreenLoader />}>
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
        </Suspense>
      </main>

      {!isAdminLogin && <Footer />}
      {!isAdminLogin && <MobileBottomNav />}
    </div>
  );
};

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
  const application = (
    <ErrorBoundary>
      <AuthProvider>
        <LanguageProvider>
          <ListingProvider>
            <BookingProvider>
              <HashRouter>
                <AppContent />
              </HashRouter>
            </BookingProvider>
          </ListingProvider>
        </LanguageProvider>
      </AuthProvider>
    </ErrorBoundary>
  );

  return hasGoogleMaps ? (
    <Suspense fallback={<ScreenLoader />}>
      <MapsAppProvider>{application}</MapsAppProvider>
    </Suspense>
  ) : application;
};

export default App;
