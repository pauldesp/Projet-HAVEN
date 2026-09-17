import React from 'react';
import { CalendarDays, Compass, MessageCircle, Search, UserRound, House } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const MobileBottomNav: React.FC = () => {
  const { currentUser } = useAuth();
  const location = useLocation();

  if (location.pathname.startsWith('/listing/') || location.pathname.startsWith('/messages/')) {
    return null;
  }

  const items = [
    { label: 'Explorer', to: '/', icon: Compass },
    { label: 'Rechercher', to: '/search', icon: Search },
    ...(currentUser ? [{ label: 'Messages', to: '/inbox', icon: MessageCircle }] : []),
    currentUser?.role === 'OWNER'
      ? { label: 'Mes logements', to: '/owner/dashboard', icon: House }
      : { label: 'Séjours', to: currentUser ? '/dashboard' : '/login', icon: CalendarDays },
    { label: 'Profil', to: currentUser ? `/profile/${currentUser.id}` : '/login', icon: UserRound },
  ];

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  return (
    <nav
      aria-label="Navigation principale"
      className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/80 bg-white/95 px-2 backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto flex h-16 max-w-md items-center justify-around">
        {items.map(({ label, to, icon: Icon }) => {
          const active = isActive(to);
          return (
            <Link
              key={label}
              to={to}
              className={`flex min-w-14 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-[10px] font-bold transition-colors ${
                active ? 'text-haven-red' : 'text-slate-400 active:text-haven-navy'
              }`}
            >
              <Icon size={21} strokeWidth={active ? 2.5 : 2} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
