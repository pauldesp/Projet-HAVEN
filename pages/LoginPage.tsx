
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';
import { 
  Check, 
  ShieldCheck, 
  ArrowLeft, 
  Mail, 
  Lock, 
  Loader2, 
  AlertCircle, 
  User as UserIcon, 
  Phone, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  ArrowRight, 
  Shield,
  FileText,
  Info,
  Apple
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { UserRole, User, LegalDocument } from '../types';
import { apiService } from '../services/api';
import ReactMarkdown from 'react-markdown';

type AuthStep = 'IDENTIFIER' | 'LOGIN' | 'VERIFY' | 'PROFILE' | 'LEGAL' | 'FORGOT_PASSWORD' | 'FORGOT_PASSWORD_SUCCESS';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, loginWithGoogle, logout, currentUser, checkUserExists, resetPassword } = useAuth();

  const queryParams = new URLSearchParams(location.search);
  const redirectPath = queryParams.get('redirect');
  const initialRole = queryParams.get('role') as UserRole || UserRole.TENANT;

  // Multi-step state
  const [step, setStep] = useState<AuthStep>('IDENTIFIER');
  const [identifier, setIdentifier] = useState(''); // Email or Phone
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [otherContact, setOtherContact] = useState(''); // Phone if identifier is email, vice versa
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  
  // Legal modal state
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDocument | null>(null);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [legalScrolled, setLegalScrolled] = useState(false);
  const modalScrollRef = useRef<HTMLDivElement>(null);

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (currentUser) {
      if (redirectPath) {
        navigate(redirectPath);
      } else {
        const path = currentUser.role === UserRole.ADMIN ? '/admin/dashboard' : 
                     currentUser.role === UserRole.OWNER ? '/owner/dashboard' : '/dashboard';
        navigate(path);
      }
    }
  }, [currentUser, navigate, redirectPath]);

  const handleIdentifierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const result = await checkUserExists(identifier);
      if (result.exists) {
        setStep('LOGIN');
      } else {
        // If it's an email, send a real verification code via Resend
        if (identifier.includes('@')) {
          const code = Math.floor(1000 + Math.random() * 9000).toString();
          setGeneratedCode(code);
          
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const response = await fetch('/api/send-verification', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: identifier, code }),
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
              const data = await response.json();
              throw new Error(data.error || "Erreur lors de l'envoi de l'email.");
            }
            
            setStep('VERIFY');
          } catch (err: any) {
            setError(err.message || "Impossible d'envoyer l'email de vérification.");
          }
        } else {
          // For phone numbers, we still simulate for now
          setGeneratedCode('1234');
          setStep('VERIFY');
        }
      }
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      let loginEmail = identifier;
      // If identifier is a phone number, resolve the associated email first
      if (!identifier.includes('@')) {
        const result = await checkUserExists(identifier);
        if (result.exists && result.email) {
          loginEmail = result.email;
        } else {
          setError('Aucun compte associé à ce numéro.');
          setIsLoading(false);
          return;
        }
      }
      const success = await login(loginEmail, password);
      if (!success) {
        setError('Mot de passe incorrect.');
      }
    } catch (err: any) {
      console.error("Login catch", err);
      const errorCode = err.code || (err.error && err.error.code);
      const errorMessage = err.message || "";
      
      if (errorCode === 'auth/invalid-credential' || 
          errorCode === 'auth/user-not-found' || 
          errorCode === 'auth/wrong-password' ||
          errorMessage.includes('invalid-credential') ||
          errorMessage.includes('user-not-found')) {
        setError('Email ou mot de passe incorrect.');
      } else if (errorCode === 'auth/too-many-requests' || errorMessage.includes('too-many-requests')) {
        setError('Trop de tentatives de connexion. Veuillez réessayer plus tard.');
      } else {
        setError(errorMessage || "Erreur de connexion.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode === generatedCode) {
      setStep('PROFILE');
    } else {
      setError(`Code invalide. ${identifier.includes('@') ? 'Vérifiez vos emails.' : 'Utilisez 1234 pour le test.'}`);
    }
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('LEGAL');
  };

  const openLegalModal = async () => {
    setIsLoading(true);
    try {
      const docs = await apiService.settings.getAllLegalDocuments();
      const terms = docs.find(d => d.id === 'terms') || {
        id: 'terms',
        title: 'Conditions Générales d\'Utilisation',
        content: '# Conditions Générales\n\nBienvenue sur HAVEN...',
        lastUpdated: new Date().toISOString()
      };
      setLegalDoc(terms);
      setIsLegalModalOpen(true);
      setLegalScrolled(false);
    } catch (err) {
      console.error("Error loading legal docs", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 50) {
      setLegalScrolled(true);
    }
  };

  const handleFinalRegister = async () => {
    setError('');
    setIsLoading(true);
    try {
      const isEmail = identifier.includes('@');
      const newUser: User = {
        id: '',
        firstName,
        lastName,
        email: isEmail ? identifier : otherContact,
        phone: isEmail ? otherContact : identifier,
        birthDate,
        marketingOptIn,
        legalAccepted: true,
        role: initialRole,
        avatarUrl: `https://ui-avatars.com/api/?name=${firstName}+${lastName}&background=1E293B&color=fff`,
        isVerified: true,
        status: 'APPROVED'
      };
      // Use the password set in the PROFILE step
      const success = await register(newUser, password); 
      if (!success) {
        setError('Erreur lors de la création du compte.');
      }
    } catch (err: any) {
      console.error("Register catch", err);
      const errorCode = err.code || (err.error && err.error.code);
      const errorMessage = err.message || "";

      if (errorCode === 'auth/email-already-in-use' || errorMessage.includes('email-already-in-use')) {
        setError("Un compte existe déjà avec cette adresse e-mail. Veuillez vous connecter à l'aide de votre mot de passe.");
        setStep('LOGIN');
      } else if (errorCode === 'auth/weak-password' || errorMessage.includes('weak-password')) {
        setError('Le mot de passe est trop faible. Veuillez utiliser au moins 6 caractères.');
      } else {
        setError(errorMessage || "Erreur d'inscription.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setIsLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setError(err.message || "Erreur Google Login.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !identifier.includes('@')) {
      setError('Veuillez saisir votre adresse e-mail dans le champ identifiant.');
      setStep('IDENTIFIER');
      return;
    }
    
    setError('');
    setIsLoading(true);
    try {
      await resetPassword(identifier);
      setStep('FORGOT_PASSWORD_SUCCESS');
    } catch (err: any) {
      console.error("Forgot password error", err);
      setError(err.message || "Erreur lors de l'envoi de l'email de réinitialisation.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'IDENTIFIER':
        return (
          <form onSubmit={handleIdentifierSubmit} className="space-y-4">
            <div className="space-y-0">
              <div className="relative">
                <input 
                  type="text" 
                  required 
                  value={identifier} 
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Numéro de téléphone ou adresse e-mail"
                  className="w-full px-4 py-4 bg-white rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all text-base placeholder:text-gray-500"
                />
              </div>
            </div>
            
            <Button 
              type="submit" 
              fullWidth 
              size="lg" 
              disabled={isLoading}
              className="bg-haven-red hover:bg-haven-red/90 text-white font-bold py-3.5 rounded-xl border-none shadow-none"
            >
              {isLoading ? <Loader2 className="animate-spin" /> : "Continuer"}
            </Button>
          </form>
        );

      case 'LOGIN':
        return (
          <form onSubmit={handleLoginSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-haven-stone uppercase tracking-widest ml-1">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                <input 
                  type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none focus:border-haven-navy transition-all"
                />
                <button 
                  type="button" 
                  onClick={() => setStep('FORGOT_PASSWORD')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-haven-stone hover:text-haven-navy"
                >
                  Oublié ?
                </button>
              </div>
            </div>
            <Button type="submit" fullWidth size="lg" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" /> : "Se connecter"}
            </Button>
            <button type="button" onClick={() => setStep('IDENTIFIER')} className="w-full text-center text-sm font-bold text-haven-stone hover:text-haven-navy">
              Utiliser un autre compte
            </button>
          </form>
        );

      case 'VERIFY':
        return (
          <form onSubmit={handleVerifySubmit} className="space-y-6">
            <div className="text-center space-y-2">
              <p className="text-sm text-haven-stone">Nous avons envoyé un code à <strong>{identifier}</strong></p>
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-haven-stone uppercase tracking-widest ml-1">Code de validation</label>
              <input 
                type="text" required value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="1234"
                className="w-full px-4 py-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none focus:border-haven-navy text-center text-2xl tracking-[1em] font-bold"
                maxLength={4}
              />
            </div>
            <Button type="submit" fullWidth size="lg">Valider le code</Button>
            <button type="button" onClick={() => setStep('IDENTIFIER')} className="w-full text-center text-sm font-bold text-haven-stone hover:text-haven-navy">
              Modifier les coordonnées
            </button>
          </form>
        );

      case 'PROFILE':
        return (
          <form onSubmit={handleProfileSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-haven-stone uppercase tracking-widest ml-1">Prénom</label>
                <input 
                  type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 outline-none focus:border-haven-navy text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-haven-stone uppercase tracking-widest ml-1">Nom</label>
                <input 
                  type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 outline-none focus:border-haven-navy text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-haven-stone uppercase tracking-widest ml-1">Date de naissance</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                <input 
                  type="date" required value={birthDate} onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 rounded-xl border border-gray-100 outline-none focus:border-haven-navy text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-haven-stone uppercase tracking-widest ml-1">
                {identifier.includes('@') ? 'Numéro de téléphone' : 'Adresse Email'}
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300">
                  {identifier.includes('@') ? <Phone size={18} /> : <Mail size={18} />}
                </div>
                <input 
                  type={identifier.includes('@') ? 'tel' : 'email'} 
                  required value={otherContact} onChange={(e) => setOtherContact(e.target.value)}
                  placeholder={identifier.includes('@') ? '+33 6...' : 'email@example.com'}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 rounded-xl border border-gray-100 outline-none focus:border-haven-navy text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-haven-stone uppercase tracking-widest ml-1">Définir un mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                <input 
                  type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 rounded-xl border border-gray-100 outline-none focus:border-haven-navy text-sm"
                />
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <input 
                type="checkbox" id="marketing" checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-gray-300 text-haven-red focus:ring-haven-red"
              />
              <label htmlFor="marketing" className="text-xs text-haven-stone leading-relaxed">
                J'accepte de recevoir des communications marketing, des offres personnalisées et des actualités de la part de HAVEN.
              </label>
            </div>
            <Button type="submit" fullWidth size="lg">Continuer</Button>
          </form>
        );

      case 'LEGAL':
        return (
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-haven-red/10 rounded-[2rem] flex items-center justify-center text-haven-red mx-auto">
                <Shield size={40} />
              </div>
              <h3 className="text-2xl font-heading font-bold text-haven-navy">Dernière étape</h3>
              <p className="text-haven-stone">Veuillez lire et accepter nos conditions générales pour finaliser votre inscription.</p>
            </div>

            <div className={`p-6 rounded-[2rem] border transition-all ${legalAccepted ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100 shadow-premium'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <FileText className="text-haven-red" size={24} />
                  <span className="font-bold text-haven-navy">Conditions Générales</span>
                </div>
                {legalAccepted && <CheckCircle className="text-green-600" size={24} />}
              </div>
              <Button 
                fullWidth 
                variant={legalAccepted ? "outline" : "primary"} 
                onClick={openLegalModal}
                className="rounded-xl"
              >
                {legalAccepted ? "Relire le document" : "Lire et valider"}
              </Button>
            </div>

            <Button 
              fullWidth 
              size="lg" 
              disabled={!legalAccepted || isLoading}
              onClick={handleFinalRegister}
              className="py-4 shadow-xl shadow-haven-red/20"
            >
              {isLoading ? <Loader2 className="animate-spin" /> : "Créer mon compte"}
            </Button>
          </div>
        );

      case 'FORGOT_PASSWORD':
        return (
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-haven-navy mx-auto">
                <Lock size={32} />
              </div>
              <h3 className="text-xl font-heading font-bold text-haven-navy">Mot de passe oublié ?</h3>
              <p className="text-haven-stone text-sm">Saisissez votre e-mail ci-dessous pour recevoir un lien de réinitialisation.</p>
            </div>

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-haven-stone uppercase tracking-widest ml-1">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input 
                    type="email" 
                    required 
                    value={identifier} 
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="votre@email.com"
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none focus:border-haven-navy transition-all"
                  />
                </div>
              </div>
              <Button type="submit" fullWidth size="lg" disabled={isLoading}>
                {isLoading ? <Loader2 className="animate-spin" /> : "Envoyer le lien"}
              </Button>
              <button 
                type="button" 
                onClick={() => setStep('LOGIN')} 
                className="w-full text-center text-sm font-bold text-haven-stone hover:text-haven-navy"
              >
                Retour à la connexion
              </button>
            </form>
          </div>
        );

      case 'FORGOT_PASSWORD_SUCCESS':
        return (
          <div className="space-y-8 py-4">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-green-50 rounded-[2rem] flex items-center justify-center text-green-600 mx-auto">
                <CheckCircle size={40} />
              </div>
              <h3 className="text-2xl font-heading font-bold text-haven-navy">Email envoyé !</h3>
              <p className="text-haven-stone">Un lien de réinitialisation de mot de passe a été envoyé à <strong>{identifier}</strong>. Veuillez vérifier votre boîte de réception.</p>
            </div>
            <Button 
              fullWidth 
              size="lg" 
              onClick={() => setStep('LOGIN')}
              className="py-4"
            >
              Retour à la connexion
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white">
      {/* Left side: Branding */}
      <div className="w-full md:w-1/2 relative overflow-hidden flex flex-col justify-center items-center text-white p-12 bg-haven-navy">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80" 
            className="w-full h-full object-cover opacity-30" 
            alt="Coliving Life"
          />
          <div className="absolute inset-0 bg-haven-navy/40 mix-blend-multiply"></div>
        </div>
        
        <div className="relative z-10 max-w-md">
          <div className="mb-12">
             <Logo className="h-12 w-auto" white={true} />
          </div>
          
          <h1 className="font-heading font-bold text-4xl md:text-5xl mb-6 leading-tight">
            Vivez, partagez,<br/> profitez.
          </h1>
          <p className="text-blue-100 text-lg mb-12 leading-relaxed opacity-90">
            Rejoignez la première plateforme de colocation courte durée premium. Des réservations simples, une communauté de confiance.
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4 bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
              <div className="w-10 h-10 rounded-full bg-haven-red flex items-center justify-center text-white"><Check size={20}/></div>
              <span className="font-medium">Réservation 100% digitale</span>
            </div>
            <div className="flex items-center gap-4 bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
              <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white"><ShieldCheck size={20}/></div>
              <span className="font-medium">Sécurité et confiance garanties</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side: Auth Flow */}
      <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-8 bg-haven-cream relative overflow-y-auto">
        <button 
          onClick={() => navigate('/')} 
          className="absolute top-8 left-8 flex items-center gap-2 text-haven-stone hover:text-haven-navy font-bold transition-colors"
        >
          <ArrowLeft size={20} /> Retour au site
        </button>

        <div className="w-full max-w-md animate-fade-in-up py-12">
          <div className="bg-white rounded-3xl shadow-premium border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-center relative">
              <button 
                onClick={() => navigate('/')} 
                className="absolute left-6 text-gray-500 hover:text-black transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <h2 className="text-base font-bold text-haven-navy">
                Connexion ou inscription
              </h2>
            </div>

            <div className="p-6">
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-700 text-sm animate-shake">
                  <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Role Mismatch Warning */}
              {currentUser && initialRole === UserRole.OWNER && currentUser.role === UserRole.TENANT && (
                <div className="mb-8 p-6 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-4 animate-fade-in">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                    <AlertCircle className="text-amber-600" size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-900 mb-1">Compte locataire détecté</p>
                    <p className="text-xs text-amber-800 leading-relaxed mb-3">
                      Vous êtes actuellement connecté avec un compte locataire. Pour publier une annonce, vous devez vous déconnecter et utiliser un compte propriétaire.
                    </p>
                    <button 
                      onClick={() => logout()}
                      className="text-xs font-black text-amber-900 uppercase tracking-widest hover:opacity-70 transition-opacity"
                    >
                      Se déconnecter
                    </button>
                  </div>
                </div>
              )}

              {renderStep()}

              {step === 'IDENTIFIER' && (
                <>
                  <div className="relative py-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center text-[12px]">
                      <span className="bg-white px-4 text-gray-500">ou</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={isLoading}
                      className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-900 rounded-xl font-bold text-haven-navy hover:bg-gray-50 transition-all active:scale-[0.98]"
                    >
                      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                      <span className="flex-grow text-center text-sm">Continuer avec Google</span>
                      <div className="w-5" />
                    </button>

                    <button
                      type="button"
                      disabled={isLoading}
                      className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-900 rounded-xl font-bold text-haven-navy hover:bg-gray-50 transition-all active:scale-[0.98]"
                    >
                      <Apple size={20} />
                      <span className="flex-grow text-center text-sm">Continuer avec Apple</span>
                      <div className="w-5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Legal Modal */}
      {isLegalModalOpen && legalDoc && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-8">
          <div className="absolute inset-0 bg-haven-navy/80 backdrop-blur-md animate-fade-in" onClick={() => setIsLegalModalOpen(false)} />
          <div className="relative bg-white w-full max-w-5xl h-full md:h-[90vh] md:rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-haven-red/10 rounded-2xl flex items-center justify-center text-haven-red">
                  <Shield size={24} />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-xl text-haven-navy leading-none mb-1">{legalDoc.title}</h3>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Document officiel HAVEN</p>
                </div>
              </div>
              <button onClick={() => setIsLegalModalOpen(false)} className="w-12 h-12 rounded-2xl hover:bg-gray-100 flex items-center justify-center text-haven-stone transition-all hover:rotate-90">
                <XCircle size={28} />
              </button>
            </div>

            <div ref={modalScrollRef} onScroll={handleScroll} className="flex-grow overflow-y-auto p-8 md:p-16 bg-white scroll-smooth">
              <div className="max-w-3xl mx-auto">
                <div className="prose prose-slate max-w-none 
                  prose-headings:font-heading prose-headings:text-haven-navy prose-headings:font-bold
                  prose-p:text-haven-stone prose-p:text-lg prose-p:leading-relaxed prose-p:mb-6
                  prose-li:text-haven-stone prose-li:text-lg prose-li:mb-2
                  prose-strong:text-haven-navy prose-strong:font-bold
                ">
                  <ReactMarkdown>{legalDoc.content}</ReactMarkdown>
                </div>
              </div>
            </div>

            <div className="px-8 py-8 border-t border-gray-100 bg-gray-50/50 backdrop-blur-sm flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex flex-col gap-1">
                {!legalScrolled ? (
                  <div className="flex items-center gap-3 text-haven-red font-bold text-sm animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-haven-red/10 flex items-center justify-center">
                      <ArrowRight size={16} className="rotate-90" />
                    </div>
                    Veuillez faire défiler jusqu'en bas pour activer la validation
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-green-600 font-bold text-sm">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle size={16} />
                    </div>
                    Lecture terminée, vous pouvez maintenant accepter
                  </div>
                )}
              </div>
              
              <div className="flex gap-4 w-full md:w-auto">
                <Button variant="ghost" onClick={() => setIsLegalModalOpen(false)} className="px-8 py-4 font-bold">
                  Fermer
                </Button>
                <Button 
                  disabled={!legalScrolled}
                  onClick={() => {
                    setLegalAccepted(true);
                    setIsLegalModalOpen(false);
                  }}
                  className="px-12 py-4 font-bold min-w-[240px] shadow-xl shadow-haven-red/20"
                >
                  J'accepte et je valide
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
      `}</style>
    </div>
  );
};
