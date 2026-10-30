import { NavLink, useLocation } from 'react-router-dom';
import { Search, LayoutDashboard, MessageSquare, UserRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { UserRole } from '../types';

export function MobileNavigation() {
  const { currentUser } = useAuth();
  const { tr } = useLanguage();
  const { pathname } = useLocation();
  // These flows provide their own bottom actions and need all available height.
  if (/^\/(payment\/|messages\/|owner\/publish|admin\/login)/.test(pathname)) return null;
  const dashboard = currentUser?.role === UserRole.ADMIN ? '/admin/dashboard' : currentUser?.role === UserRole.OWNER ? '/owner/dashboard' : '/dashboard';
  const items = [
    { to: '/search', label: tr('Rechercher'), icon: Search, active: pathname === '/' || pathname.startsWith('/listing/') },
    { to: currentUser ? dashboard : '/login', label: tr('Mon espace'), icon: LayoutDashboard },
    { to: currentUser ? '/inbox' : '/login?redirect=/inbox', label: tr('Messages'), icon: MessageSquare },
    { to: currentUser ? '/account' : '/login?redirect=/account', label: tr('Mon compte'), icon: UserRound },
  ];
  return <div className="md:hidden">
    <div className="haven-mobile-nav-spacer" aria-hidden="true" />
    <nav aria-label={tr('Navigation principale')} className="haven-mobile-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-gray-200 bg-white/95 px-2 pt-2 backdrop-blur-md">
      {items.map(({ to, label, icon: Icon, active }) => <NavLink key={label} to={to} className={({ isActive }) => `flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-center text-[10px] font-bold ${(isActive && pathname !== '/login') || active ? 'bg-haven-red/5 text-haven-red' : 'text-gray-500'}`}>
        <Icon size={21} aria-hidden="true" /><span>{label}</span>
      </NavLink>)}
    </nav>
  </div>;
}
