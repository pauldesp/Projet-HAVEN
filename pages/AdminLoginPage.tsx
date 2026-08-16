
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { ShieldCheck, Lock, Mail, ArrowRight, Building, AlertCircle, Loader2 } from 'lucide-react';
import { Logo } from '../components/Logo';

export const AdminLoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { login, resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const success = await login(email, password);
      if (success) {
        navigate('/admin/dashboard');
      } else {
        setError("Identifiants incorrects ou accès non autorisé.");
      }
    } catch (err: any) {
      console.error("Admin Login Error:", err);
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
        setError(errorMessage || "Une erreur est survenue lors de l'authentification.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'envoi de l'email de réinitialisation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-4 font-body">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-10">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#1E293B_1px,transparent_1px)] [background-size:24px_24px]"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-4 bg-white/5 rounded-[2rem] border border-white/10 mb-6 shadow-2xl">
            <Logo className="h-12 w-auto" white />
          </div>
          <div className="flex items-center justify-center gap-2 text-haven-red mb-2">
            <ShieldCheck size={20} />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Accès Sécurisé Salariés</span>
          </div>
          <h1 className="text-3xl font-heading font-bold text-white">Portail Administration</h1>
          <p className="text-gray-400 mt-2 text-sm">
            {showReset ? "Réinitialisation du mot de passe" : "Connectez-vous à votre espace de gestion HAVEN."}
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white/5 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/10 shadow-2xl">
          {resetSent ? (
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center text-green-500 mx-auto">
                <ShieldCheck size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white">Email envoyé</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Un lien de réinitialisation a été envoyé à <strong>{email}</strong>. Vérifiez votre boîte de réception.
                </p>
              </div>
              <Button 
                onClick={() => {
                  setShowReset(false);
                  setResetSent(false);
                }}
                fullWidth
                className="bg-white/10 hover:bg-white/20 text-white"
              >
                Retour à la connexion
              </Button>
            </div>
          ) : showReset ? (
            <form onSubmit={handleResetPassword} className="space-y-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl flex items-start gap-3 animate-shake">
                  <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                  <p className="text-xs font-medium">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email Professionnel</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-haven-red transition-colors">
                    <Mail size={18} />
                  </div>
                  <input 
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nom.prenom@haven.fr"
                    className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:border-haven-red focus:bg-white/10 transition-all placeholder:text-gray-600"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <Button 
                  type="submit"
                  fullWidth
                  disabled={isSubmitting}
                  className="bg-haven-red hover:bg-red-700 text-white py-4 rounded-2xl"
                >
                  {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : "Envoyer le lien"}
                </Button>
                <button 
                  type="button"
                  onClick={() => setShowReset(false)}
                  className="w-full text-center text-xs font-bold text-gray-500 hover:text-white transition-colors"
                >
                  Retour à la connexion
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl flex items-start gap-3 animate-shake">
                  <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                  <p className="text-xs font-medium">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email Professionnel</label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-haven-red transition-colors">
                      <Mail size={18} />
                    </div>
                    <input 
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nom.prenom@haven.fr"
                      className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:border-haven-red focus:bg-white/10 transition-all placeholder:text-gray-600"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Mot de passe</label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-haven-red transition-colors">
                      <Lock size={18} />
                    </div>
                    <input 
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:border-haven-red focus:bg-white/10 transition-all placeholder:text-gray-600"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowReset(true)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-500 hover:text-haven-red uppercase tracking-wider transition-colors"
                    >
                      Oublié ?
                    </button>
                  </div>
                </div>
              </div>

              <Button 
                type="submit"
                fullWidth
                disabled={isSubmitting}
                className="bg-haven-red hover:bg-red-700 text-white py-4 rounded-2xl shadow-xl shadow-haven-red/20 group"
              >
                {isSubmitting ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    S'identifier <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </span>
                )}
              </Button>
            </form>
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-10 text-center space-y-4">
          <div className="flex items-center justify-center gap-6 text-gray-500">
            <div className="flex items-center gap-2">
              <Building size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">HAVEN HQ</span>
            </div>
            <div className="w-1 h-1 bg-gray-700 rounded-full"></div>
            <span className="text-[10px] font-bold uppercase tracking-wider">v2.4.0-admin</span>
          </div>
          <p className="text-[10px] text-gray-600 max-w-[280px] mx-auto leading-relaxed">
            L'accès non autorisé à ce système est strictement interdit et peut faire l'objet de poursuites.
          </p>
        </div>
      </div>
    </div>
  );
};
