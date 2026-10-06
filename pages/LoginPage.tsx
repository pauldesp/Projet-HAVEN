
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/Button';
import { 
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
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { UserRole, User, LegalDocument } from '../types';
import { apiService } from '../services/api';
import { userFacingErrorMessage } from '../services/errorHandling';
import ReactMarkdown from 'react-markdown';
import { RecaptchaVerifier, linkWithPhoneNumber, type ConfirmationResult } from 'firebase/auth';
import { auth } from '../firebase';

type AuthStep = 'IDENTIFIER' | 'LOGIN' | 'VERIFY' | 'PROFILE' | 'LEGAL' | 'PHONE_VERIFY' | 'FORGOT_PASSWORD' | 'FORGOT_PASSWORD_SUCCESS';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, loginWithGoogle, logout, currentUser, resetPassword, authError } = useAuth();

  const queryParams = new URLSearchParams(location.search);
  const redirectPath = queryParams.get('redirect');
  const initialRole = queryParams.get('role') as UserRole || UserRole.TENANT;

  // Multi-step state
  const [step, setStep] = useState<AuthStep>('IDENTIFIER');
  const [identifier, setIdentifier] = useState(''); // Email or Phone
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [phoneVerificationCode, setPhoneVerificationCode] = useState('');
  const [phoneConfirmation, setPhoneConfirmation] = useState<ConfirmationResult | null>(null);
  const [registrationUserCreated, setRegistrationUserCreated] = useState(false);
  const [registrationEmailConfirmed, setRegistrationEmailConfirmed] = useState(false);
  const [registrationVerificationPending, setRegistrationVerificationPending] = useState(false);
  const recaptchaVerifier = useRef<RecaptchaVerifier | null>(null);
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
    if (currentUser && !registrationVerificationPending) {
      if (redirectPath) {
        navigate(redirectPath);
      } else {
        const path = currentUser.role === UserRole.ADMIN ? '/admin/dashboard' : 
                     currentUser.role === UserRole.OWNER ? '/owner/dashboard' : '/dashboard';
        navigate(path);
      }
    }
  }, [currentUser, navigate, redirectPath, registrationVerificationPending]);

  useEffect(() => () => recaptchaVerifier.current?.clear(), []);

  useEffect(() => {
    if (authError) setError(userFacingErrorMessage(authError));
  }, [authError]);

  const handleIdentifierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const normalizedIdentifier = identifier.trim().toLowerCase();
    setIdentifier(normalizedIdentifier);
    if (!normalizedIdentifier.includes('@')) {
      setError("La connexion par téléphone n'est pas encore disponible. Utilisez une adresse e-mail.");
      return;
    }
    // Never query private Firestore profiles before authentication to decide
    // whether an email is registered. Firebase Auth verifies credentials on
    // the next step and avoids turning permission-denied into a false signup.
    setStep('LOGIN');
  };

  const handleStartRegistration = async () => {
    setError('');
    setIsLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      let response: Response;
      try {
        response = await fetch('/api/send-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: identifier }),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Erreur ${response.status}`);
      setStep('VERIFY');
    } catch (err: unknown) {
      setError(userFacingErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const success = await login(identifier, password);
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
        setError(userFacingErrorMessage(err));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const response = await fetch('/api/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identifier, code: verificationCode })
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Code invalide.');
      setStep('PROFILE');
    } catch (err: unknown) {
      setError(userFacingErrorMessage(err));
    }
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.includes('@')) {
      setError('L’inscription nécessite une adresse e-mail.');
      return;
    }
    if (!/^\+?[1-9]\d{7,14}$/.test(normalizePhone(otherContact))) {
      setError('Saisissez un numéro de téléphone valide avec son indicatif, par exemple +33 6 12 34 56 78.');
      return;
    }
    setError('');
    setStep('LEGAL');
  };

  const normalizePhone = (value: string) => {
    const compact = value.trim().replace(/[\\s().-]/g, '');
    if (compact.startsWith('+')) return compact;
    if (compact.startsWith('00')) return `+${compact.slice(2)}`;
    if (compact.startsWith('0')) return `+33${compact.slice(1)}`;
    return `+${compact}`;
  };

  const startPhoneVerification = async () => {
    const signedInUser = auth.currentUser;
    if (!signedInUser) throw new Error('Connectez-vous de nouveau pour confirmer votre numéro.');
    recaptchaVerifier.current?.clear();
    setStep('PHONE_VERIFY');
    recaptchaVerifier.current = new RecaptchaVerifier(auth, 'registration-recaptcha', { size: 'invisible' });
    const result = await linkWithPhoneNumber(signedInUser, normalizePhone(otherContact), recaptchaVerifier.current);
    setPhoneConfirmation(result);
    setStep('PHONE_VERIFY');
  };

  const handlePhoneVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneConfirmation) {
      setError('Demandez un nouveau code SMS pour continuer.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      await phoneConfirmation.confirm(phoneVerificationCode.trim());
      await apiService.users.confirmPhone();
      recaptchaVerifier.current?.clear();
      setRegistrationVerificationPending(false);
    } catch (err: unknown) {
      setError(userFacingErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
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
        phone: normalizePhone(otherContact),
        birthDate,
        marketingOptIn,
        legalAccepted: true,
        role: initialRole,
        avatarUrl: `https://ui-avatars.com/api/?name=${firstName}+${lastName}&background=1E293B&color=fff`,
        isVerified: false,
        emailVerified: false,
        phoneVerified: false,
        identityVerified: false,
        status: 'PENDING'
      };
      setRegistrationVerificationPending(true);
      if (!registrationUserCreated) {
        // Use the password set in the PROFILE step. New profiles stay pending
        // until the user proves their email, phone and identity.
        const success = await register(newUser, password);
        if (!success) {
          setRegistrationVerificationPending(false);
          setError('Erreur lors de la création du compte.');
          return;
        }
        setRegistrationUserCreated(true);
      }
      if (!registrationEmailConfirmed) {
        await apiService.users.confirmEmail();
        setRegistrationEmailConfirmed(true);
      }
      await startPhoneVerification();
    } catch (err: any) {
      console.error("Register catch", err);
      const errorCode = err.code || (err.error && err.error.code);
      const errorMessage = err.message || "";

      if (errorCode === 'auth/email-already-in-use' || errorMessage.includes('email-already-in-use')) {
        setError("Un compte existe déjà avec cette adresse e-mail. Veuillez vous connecter à l'aide de votre mot de passe.");
        setRegistrationVerificationPending(false);
        setStep('LOGIN');
      } else if (errorCode === 'auth/weak-password' || errorMessage.includes('weak-password')) {
        setError('Le mot de passe est trop faible. Veuillez utiliser au moins 6 caractères.');
      } else {
        setError(userFacingErrorMessage(err));
        if (!registrationUserCreated) setRegistrationVerificationPending(false);
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
      if (err?.code === 'auth/unauthorized-domain') {
        setError('La connexion Google n’est pas encore autorisée depuis cette adresse. (Erreur 403)');
      } else if (err?.code === 'auth/operation-not-allowed') {
        setError('La connexion Google est momentanément indisponible. (Erreur 503)');
      } else {
        setError(userFacingErrorMessage(err));
      }
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
    } catch (err: unknown) {
      console.error("Forgot password error", err);
      setError(userFacingErrorMessage(err));
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
            <button type="button" onClick={() => void handleStartRegistration()} disabled={isLoading} className="w-full text-center text-sm font-bold text-haven-red hover:text-haven-red/80 disabled:opacity-50">
              Créer un compte Haven
            </button>
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

      case 'PHONE_VERIFY':
        return (
          <form onSubmit={handlePhoneVerification} className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 mx-auto"><Phone size={30} /></div>
              <h3 className="text-xl font-heading font-bold text-haven-navy">Confirmez votre téléphone</h3>
              <p className="text-sm text-haven-stone">Saisissez le code envoyé par SMS au <strong>{normalizePhone(otherContact)}</strong>.</p>
            </div>
            <input
              type="text" inputMode="numeric" autoComplete="one-time-code" required
              value={phoneVerificationCode} onChange={(e) => setPhoneVerificationCode(e.target.value.replace(/\\D/g, '').slice(0, 6))}
              placeholder="Code à 6 chiffres" maxLength={6}
              className="w-full px-4 py-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none focus:border-haven-navy text-center text-2xl tracking-[0.5em] font-bold"
            />
            <Button type="submit" fullWidth size="lg" disabled={isLoading || phoneVerificationCode.length < 6}>
              {isLoading ? <Loader2 className="animate-spin" /> : 'Confirmer mon numéro'}
            </Button>
            <button type="button" disabled={isLoading} onClick={() => { void startPhoneVerification().catch((err: unknown) => setError(userFacingErrorMessage(err))); }} className="w-full text-center text-sm font-bold text-haven-red disabled:opacity-50">
              Renvoyer un code SMS
            </button>
          </form>
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
      {/* Left side: HAVEN introduction */}
      <aside className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-16 text-white bg-haven-navy min-h-screen">
        <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-[linear-gradient(145deg,#102747_0%,#253953_55%,#583e4b_100%)]" />
          <div className="absolute -top-24 -left-20 h-80 w-80 rounded-full bg-[#d8a178]/20 blur-3xl" />
          <div className="absolute -bottom-36 right-[-5rem] h-[28rem] w-[28rem] rounded-full bg-haven-red/25 blur-3xl" />
          <div className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-[#07182e]/45 to-transparent" />
          <div className="absolute left-16 top-0 h-full w-px bg-white/[0.08]" />
        </div>

        <div className="relative z-10 max-w-xl py-10 md:py-0">
          <p className="mb-6 text-[11px] font-black tracking-[0.22em] uppercase text-white/60">
            HAVEN · colocation flexible
          </p>
          <h1 className="font-heading font-bold text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight">
            Trouvez votre place.<br />
            <span className="text-white/65">Vivez à votre rythme.</span>
          </h1>
          <p className="mt-7 max-w-md text-base sm:text-lg leading-relaxed text-blue-100/85">
            Une chambre accueillante pour quelques jours ou plusieurs semaines, avec tout ce qu’il faut pour vous sentir chez vous.
          </p>

          <div className="mt-10 rounded-3xl border border-white/15 bg-white/[0.08] p-5 sm:p-6 backdrop-blur-sm shadow-2xl shadow-black/10">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/60">Votre séjour en trois temps</p>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="border-l border-white/20 pl-3">
                <span className="text-xs font-black text-haven-red">01</span>
                <p className="mt-1 text-sm font-semibold">Choisissez</p>
                <p className="mt-1 text-xs leading-relaxed text-white/60">La chambre qui vous correspond.</p>
              </div>
              <div className="border-l border-white/20 pl-3">
                <span className="text-xs font-black text-haven-red">02</span>
                <p className="mt-1 text-sm font-semibold">Réservez</p>
                <p className="mt-1 text-xs leading-relaxed text-white/60">Des dates et un prix clairs.</p>
              </div>
              <div className="border-l border-white/20 pl-3">
                <span className="text-xs font-black text-haven-red">03</span>
                <p className="mt-1 text-sm font-semibold">Installez-vous</p>
                <p className="mt-1 text-xs leading-relaxed text-white/60">Votre séjour commence sereinement.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 mb-8 lg:mb-88 flex items-center gap-3 text-sm text-white/75">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white"><ShieldCheck size={18} /></span>
          <span>Des logements vérifiés et une réservation sécurisée.</span>
        </div>
      </aside>

      {/* Right side: Auth Flow */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8 bg-haven-cream relative overflow-y-auto">
        <button 
          onClick={() => navigate('/')} 
          className="absolute top-8 left-8 flex items-center gap-2 text-haven-stone hover:text-haven-navy font-bold transition-colors"
        >
          <ArrowLeft size={20} /> Retour au site
        </button>

        <div className="w-full max-w-md animate-fade-in-up py-12 -translate-y-10 lg:-translate-y-48">
          <div id="registration-recaptcha" aria-hidden="true" />
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
