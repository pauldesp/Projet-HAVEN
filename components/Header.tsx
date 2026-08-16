
import React, { useState, useRef, useEffect } from 'react';
import { UserRole } from '../types';
import { Button } from './Button';
import { Globe, LayoutDashboard, ChevronDown, UserRound, Home, LogIn, LogOut, User as UserIcon, Settings, Shield, MessageSquare } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from './Logo';
import { useLanguage } from '../contexts/LanguageContext';
import { Language } from '../services/translations';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';

export const Header: React.FC = () => {
  const { currentUser, logout, updateUserRole } = useAuth();
  const navigate = useNavigate();
  const isOwnerMode = currentUser?.role === UserRole.OWNER;
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const { language, setLanguage, t } = useLanguage();
  
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const langRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentUser) {
      setUnreadCount(0);
      return;
    }

    const unsubscribe = apiService.messages.listenToConversations(currentUser.id, (convs) => {
      const total = convs.reduce((acc, curr) => acc + curr.unreadCount, 0);
      setUnreadCount(total);
    });

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setIsLangOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLangChange = (lang: Language) => {
    setLanguage(lang);
    setIsLangOpen(false);
  };

  const handleRoleSwitch = () => {
    if (!currentUser) return;
    const newRole = currentUser.role === UserRole.TENANT ? UserRole.OWNER : UserRole.TENANT;
    updateUserRole(newRole);
    
    if (newRole === UserRole.OWNER) {
      navigate('/owner/dashboard');
    } else {
      navigate('/dashboard');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsUserMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-haven-cream/80 backdrop-blur-md border-b border-haven-gray/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <Logo className="h-10 w-auto" />
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <div className="relative" ref={langRef}>
              <Button 
                variant="ghost" 
                size="sm" 
                className="flex items-center gap-2 uppercase text-haven-navy/70 hover:text-haven-navy text-sm font-semibold tracking-wide"
                onClick={() => setIsLangOpen(!isLangOpen)}
              >
                <Globe size={18} /> {language} <ChevronDown size={14} />
              </Button>

              {isLangOpen && (
                <div className="absolute top-full right-0 mt-2 w-32 bg-white rounded-xl shadow-xl border border-gray-100 py-2 animate-fade-in-up">
                   <button onClick={() => handleLangChange('fr')} className={`w-full text-left px-4 py-2 hover:bg-gray-50 text-sm ${language === 'fr' ? 'font-bold text-haven-navy' : 'text-gray-600'}`}>Français</button>
                   <button onClick={() => handleLangChange('en')} className={`w-full text-left px-4 py-2 hover:bg-gray-50 text-sm ${language === 'en' ? 'font-bold text-haven-navy' : 'text-gray-600'}`}>English</button>
                </div>
              )}
            </div>
            
            {currentUser && (
              <div className="flex items-center gap-6 pl-6 border-l border-haven-gray">
                 {!isAdmin && (
                   <button 
                    onClick={handleRoleSwitch}
                    className={`flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-full transition-all ${
                      isOwnerMode 
                      ? 'text-haven-red bg-haven-red/5 hover:bg-haven-red/10' 
                      : 'text-haven-navy/70 hover:text-haven-navy hover:bg-gray-200'
                    }`}
                  >
                    {isOwnerMode ? (
                      <><UserRound size={16}/> Locataire</>
                    ) : (
                      <><Home size={16}/> Mode Propriétaire</>
                    )}
                  </button>
                 )}

                 {isAdmin && (
                   <Link 
                    to="/admin/dashboard"
                    className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-full transition-all text-haven-red bg-haven-red/5 hover:bg-haven-red/10"
                   >
                     <Shield size={16}/> Back-Office Admin
                   </Link>
                 )}

                <div className="relative flex items-center gap-4" ref={userMenuRef}>
                  <button 
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="relative flex items-center gap-2 p-1 pl-3 pr-1 bg-white border border-gray-100 rounded-full hover:shadow-md transition-all active:scale-95 group"
                  >
                    <span className="text-xs font-bold text-haven-navy hidden lg:block">{currentUser.firstName}</span>
                    <div className="relative">
                      <img 
                        src={currentUser.avatarUrl} 
                        alt={currentUser.firstName} 
                        className="w-9 h-9 rounded-full object-cover border-2 border-white"
                        referrerPolicy="no-referrer"
                      />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-haven-red border-2 border-white rounded-full shadow-sm animate-pulse" />
                      )}
                    </div>
                  </button>

                  {isUserMenuOpen && (
                    <div className="absolute top-full right-0 mt-3 w-64 bg-white rounded-[2rem] shadow-premium border border-gray-50 py-4 px-2 animate-fade-in-up z-50">
                      <div className="px-4 py-3 mb-2 border-b border-gray-50">
                        <p className="text-sm font-bold text-haven-navy">{currentUser.firstName} {currentUser.lastName}</p>
                        <p className="text-[11px] text-gray-400">{currentUser.email}</p>
                      </div>
                      
                      <div className="space-y-1">
                        {isAdmin ? (
                          <Link 
                            to="/admin/dashboard"
                            onClick={() => setIsUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-haven-navy rounded-xl transition-colors"
                          >
                            <Shield size={18} /> Administration
                          </Link>
                        ) : (
                          <Link 
                            to={isOwnerMode ? "/owner/dashboard" : "/dashboard"}
                            onClick={() => setIsUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-haven-navy rounded-xl transition-colors"
                          >
                            <LayoutDashboard size={18} /> Tableau de bord
                          </Link>
                        )}
                        
                        <Link 
                          to="/inbox"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-haven-navy rounded-xl transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <MessageSquare size={18} /> 
                            <span>Messages</span>
                          </div>
                          {unreadCount > 0 && (
                            <span className="px-2 py-0.5 bg-haven-red text-white text-[10px] font-black rounded-full">
                              {unreadCount}
                            </span>
                          )}
                        </Link>

                        <Link 
                          to={`/profile/${currentUser.id}`}
                          onClick={() => setIsUserMenuOpen(false)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-haven-navy rounded-xl transition-colors"
                        >
                          <UserIcon size={18} /> Mon Profil
                        </Link>
                        <Link 
                          to="/settings"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-haven-navy rounded-xl transition-colors"
                        >
                          <Settings size={18} /> Paramètres
                        </Link>
                      </div>

                      <div className="mt-2 pt-2 border-t border-gray-50">
                        <button 
                          onClick={handleLogout}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-haven-red hover:bg-red-50 rounded-xl transition-colors"
                        >
                          <LogOut size={18} /> {t('nav.logout')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!currentUser && (
              <div className="flex items-center gap-4">
                 <Link to="/login">
                   <Button variant="primary" size="md" className="px-10 font-bold gap-2">
                     <LogIn size={18} /> {t('nav.login')}
                   </Button>
                 </Link>
              </div>
            )}
          </nav>

          <button className="md:hidden text-haven-navy p-2">
            <Globe size={24} />
          </button>
        </div>
      </div>
    </header>
  );
};
