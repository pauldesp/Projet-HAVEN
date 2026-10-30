import React, { Component, ReactNode, useEffect, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { MobileNavigation } from './components/MobileNavigation';
import { SearchLoading } from './components/SearchLoading';
import { RouteScrollReset } from './components/RouteScrollReset';
import { Home } from './pages/Home';

import { APIProvider } from '@vis.gl/react-google-maps';
import { LanguageProvider } from './contexts/LanguageContext';
import { ListingProvider } from './contexts/ListingContext';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { UserRole } from './types';

import { Toaster, toast } from 'sonner';
import { classifyError, reportError } from './services/errorHandling';

const AccountPage = lazy(() => import('./pages/AccountPage').then(module => ({ default: module.AccountPage })));
const PaymentPage = lazy(() => import('./pages/PaymentPage').then(module => ({ default: module.PaymentPage })));
const ListingDetails = lazy(() => import('./pages/ListingDetails').then(module => ({ default: module.ListingDetails })));
const SearchPage = lazy(() => import('./pages/SearchPage').then(module => ({ default: module.SearchPage })));
const TenantDashboard = lazy(() => import('./pages/TenantDashboard').then(module => ({ default: module.TenantDashboard })));
const OwnerDashboard = lazy(() => import('./pages/OwnerDashboard').then(module => ({ default: module.OwnerDashboard })));
const PublishListing = lazy(() => import('./pages/PublishListing').then(module => ({ default: module.PublishListing })));
const EditListing = lazy(() => import('./pages/EditListing').then(module => ({ default: module.EditListing })));
const LoginPage = lazy(() => import('./pages/LoginPage').then(module => ({ default: module.LoginPage })));
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage').then(module => ({ default: module.AdminLoginPage })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then(module => ({ default: module.AdminDashboard })));
const AdminGovernancePage = lazy(() => import('./pages/AdminGovernancePage').then(module => ({ default: module.AdminGovernancePage })));
const TestDashboard = lazy(() => import('./pages/TestDashboard').then(module => ({ default: module.TestDashboard })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(module => ({ default: module.ProfilePage })));
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

const GOOGLE_MAPS_KEY = (typeof process !== 'undefined' && process.env?.GOOGLE_MAPS_PLATFORM_KEY) || '';
const hasValidMapsKey = Boolean(GOOGLE_MAPS_KEY) && GOOGLE_MAPS_KEY !== 'YOUR_API_KEY';

const MapsProvider: React.FC<{ children: ReactNode }> = ({ children }) =>
  hasValidMapsKey
    ? <APIProvider apiKey={GOOGLE_MAPS_KEY} version="beta">{children}</APIProvider>
    : <>{children}</>;

const AppContent: React.FC = () => {
  const location = useLocation();
  const isAdminLogin = location.pathname === '/admin/login';
  const isPublishFlow = location.pathname === '/owner/publish';
  const isChatPage = location.pathname.startsWith('/messages/');
  const isPaymentPage = location.pathname.startsWith('/payment/');

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
    <div className="haven-content flex min-h-screen min-w-0 flex-col bg-haven-cream font-body text-haven-navy">
      <Toaster position="top-right" richColors />
      {!isAdminLogin && !isPaymentPage && <Header />}
      
      <main className="min-w-0 flex-grow">
        <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-8"><SearchLoading message="Chargement de votre page…" /></div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/listing/:id" element={<ListingDetails />} />
          <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
          <Route path="/profile/:id" element={<ProfilePage />} />
          <Route path="/payment/:bookingId" element={<ProtectedRoute><PaymentPage /></ProtectedRoute>} />
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
        <RouteScrollReset />
        </Suspense>
      </main>

      {!isAdminLogin && !isPaymentPage && !isChatPage && !isPublishFlow && <Footer />}
      <MobileNavigation />
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
            <MapsProvider>
              <HashRouter>
                <AppContent />
              </HashRouter>
            </MapsProvider>
          </ListingProvider>
        </LanguageProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
