
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/Button';
import { BirthDateInput } from '../components/BirthDateInput';
import { 
  ShieldCheck, 
  ArrowLeft, 
  Mail, 
  Lock, 
  Loader2, 
  AlertCircle, 
  User as UserIcon, 
  Phone, 
  CheckCircle, 
  XCircle, 
  ArrowRight, 
  Shield,
  FileText,
  Info,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { UserRole, User } from '../types';
import { userFacingErrorMessage } from '../services/errorHandling';
import { RecaptchaVerifier, signInWithPhoneNumber, sendEmailVerification, type ConfirmationResult } from 'firebase/auth';
import { auth } from '../firebase';
import { normalizeAccountIdentifier } from '../services/accountEntry';
import { clearPhoneRecaptcha, normalizePhoneForVerification, isValidPhoneForVerification, phoneVerificationErrorMessage } from '../services/phoneVerification';
import { isValidPastBirthDate } from '../services/profileVerification';
import { registrationPasswordError } from '../services/accountTerms';

type AuthStep = 'IDENTIFIER' | 'LOGIN' | 'PROFILE' | 'PHONE_VERIFY' | 'FORGOT_PASSWORD' | 'FORGOT_PASSWORD_SUCCESS';

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
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [phoneVerificationCode, setPhoneVerificationCode] = useState('');
  const [phoneConfirmation, setPhoneConfirmation] = useState<ConfirmationResult | null>(null);
  const recaptchaVerifier = useRef<RecaptchaVerifier | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [otherContact, setOtherContact] = useState(''); // Phone if identifier is email, vice versa
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  
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

  useEffect(() => () => clearPhoneRecaptcha(recaptchaVerifier), []);

  useEffect(() => {
    if (authError) setError(userFacingErrorMessage(authError));
  }, [authError]);

  const handleIdentifierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const normalized = normalizeAccountIdentifier(identifier);
      const response = await fetch('/api/auth/identify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: normalized.value }), signal: AbortSignal.timeout(10000)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Impossible de vérifier ce compte.');
      setIdentifier(normalized.value);
      setPassword('');
      setOtherContact('');
      if (!result.exists) setStep('PROFILE');
      else if (normalized.kind === 'email') setStep('LOGIN');
      else {
        setStep('PHONE_VERIFY');
        await startPhoneVerification(normalized.value);
      }
    } catch (error) {
      setError((error as { code?: string })?.code ? phoneVerificationErrorMessage(error)
        : error instanceof Error ? error.message : 'Impossible de vérifier ce compte.');
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

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const email = identifier.includes('@') ? identifier : otherContact.trim().toLowerCase();
    const phone = identifier.includes('@') ? normalizePhone(otherContact) : identifier;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Saisissez une adresse e-mail valide.');
      return;
    }
    if (!isValidPhoneForVerification(phone)) {
      setError('Saisissez un numéro de téléphone valide avec son indicatif, par exemple +33 6 12 34 56 78.');
      return;
    }
    if (!isValidPastBirthDate(birthDate)) {
      setError('Saisissez une date de naissance valide et passée.');
      return;
    }
    setError('');
    const passwordError = registrationPasswordError(password, passwordConfirmation);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    void handleFinalRegister();
  };

  const normalizePhone = normalizePhoneForVerification;

  // SMS on this page is only for signing in to an existing phone account.
  // New members verify their number later in the account-validation form.
  const startPhoneVerification = async (number = identifier) => {
    clearPhoneRecaptcha(recaptchaVerifier);
    setPhoneConfirmation(null);
    setStep('PHONE_VERIFY');
    recaptchaVerifier.current = new RecaptchaVerifier(auth, 'registration-recaptcha', { size: 'invisible' });
    const result = await signInWithPhoneNumber(auth, number, recaptchaVerifier.current);
    setPhoneConfirmation(result);
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
      clearPhoneRecaptcha(recaptchaVerifier);
    } catch (err: unknown) {
      setError(userFacingErrorMessage(err));
    } finally {
      setIsLoading(false);
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
        email: isEmail ? identifier : otherContact.trim().toLowerCase(),
        phone: isEmail ? normalizePhone(otherContact) : identifier,
        birthDate,
        marketingOptIn,
        legalAccepted: false,
        role: initialRole,
        avatarUrl: `https://ui-avatars.com/api/?name=${firstName}+${lastName}&background=1E293B&color=fff`,
        isVerified: false,
        emailVerified: false,
        phoneVerified: false,
        identityVerified: false,
        status: 'PENDING'
      };
      const success = await register(newUser, password);
      if (!success) {
        setError('Erreur lors de la création du compte.');
        return;
      }
      // An e-mail delivery failure must not turn a successfully created
      // account into a failed registration. It can be retried in validation.
      if (auth.currentUser && !auth.currentUser.emailVerified) {
        auth.languageCode = 'fr';
        void sendEmailVerification(auth.currentUser).catch(error => console.warn('Confirmation e-mail à renvoyer depuis la validation du compte', error));
      }
    } catch (err: any) {
      console.error("Register catch", err);
      const errorCode = err.code || (err.error && err.error.code);
      const errorMessage = err.message || "";

      if (errorCode === 'auth/email-already-in-use' || errorMessage.includes('email-already-in-use')) {
        setIdentifier(identifier.includes('@') ? identifier : otherContact.trim().toLowerCase());
        setError("Un compte existe déjà avec cette adresse e-mail. Veuillez vous connecter à l'aide de votre mot de passe.");
        setStep('LOGIN');
      } else if (errorCode === 'auth/weak-password' || errorMessage.includes('weak-password')) {
        setError('Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre.');
      } else {
        setError(userFacingErrorMessage(err));
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
            <button type="button" onClick={() => { setError(''); setStep('PROFILE'); }} disabled={isLoading} className="w-full text-center text-sm font-bold text-haven-red hover:text-haven-red/80 disabled:opacity-50">
              Créer un compte Haven
            </button>
            <button type="button" onClick={() => setStep('IDENTIFIER')} className="w-full text-center text-sm font-bold text-haven-stone hover:text-haven-navy">
              Utiliser un autre compte
            </button>
          </form>
        );

      case 'PROFILE':
        return (
          <form onSubmit={handleProfileSubmit} className="space-y-6">
            <div className="space-y-1">
              <h3 className="text-xl font-heading font-bold text-haven-navy">Créez votre compte Haven</h3>
              <p className="text-sm text-haven-stone">Complétez vos informations pour vous inscrire avec {identifier}.</p>
            </div>
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
              <BirthDateInput value={birthDate} onChange={setBirthDate} />
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
              <label htmlFor="registration-password" className="block text-[10px] font-black text-haven-stone uppercase tracking-widest ml-1">Définir un mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                <input 
                  id="registration-password" type="password" autoComplete="new-password" required minLength={8} pattern="(?=.*[A-Z])(?=.*[0-9]).{8,}" title="Au moins 8 caractères, une majuscule et un chiffre" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  aria-describedby="registration-password-rules"
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 rounded-xl border border-gray-100 outline-none focus:border-haven-navy text-sm"
                />
              </div>
              <p id="registration-password-rules" className="text-xs text-haven-stone">Au moins 8 caractères, une majuscule et un chiffre.</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="registration-password-confirmation" className="block text-[10px] font-black text-haven-stone uppercase tracking-widest ml-1">Confirmer le mot de passe</label>
              <input id="registration-password-confirmation" type="password" autoComplete="new-password" required minLength={8}
                value={passwordConfirmation} onChange={e => setPasswordConfirmation(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 outline-none focus:border-haven-navy text-sm" />
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
            <Button type="submit" fullWidth size="lg" disabled={isLoading}>{isLoading ? <Loader2 className="animate-spin" /> : 'Créer mon compte'}</Button>
          </form>
        );

      case 'PHONE_VERIFY':
        return (
          <form onSubmit={handlePhoneVerification} className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 mx-auto"><Phone size={30} /></div>
              <h3 className="text-xl font-heading font-bold text-haven-navy">Connexion par SMS</h3>
              <p className="text-sm text-haven-stone">Saisissez le code envoyé par SMS au <strong>{identifier.includes('@') ? normalizePhone(otherContact) : identifier}</strong>.</p>
            </div>
            <input
              type="text" inputMode="numeric" autoComplete="one-time-code" required
              value={phoneVerificationCode} onChange={(e) => setPhoneVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
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
