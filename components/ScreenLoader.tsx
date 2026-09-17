import React from 'react';
import { Logo } from './Logo';

interface ScreenLoaderProps {
  label?: string;
  compact?: boolean;
}

export const ScreenLoader: React.FC<ScreenLoaderProps> = ({
  label = 'HAVEN prépare votre espace',
  compact = false,
}) => (
  <div
    className={`flex items-center justify-center px-6 ${compact ? 'min-h-56' : 'min-h-[60dvh]'}`}
    role="status"
    aria-label="Chargement"
  >
    <div className="flex flex-col items-center text-center">
      <div className="relative flex h-24 w-48 items-center justify-center">
        <span className="absolute h-20 w-20 rounded-full bg-haven-red/8 animate-ping [animation-duration:1.8s]" />
        <Logo className="h-12 relative z-10 animate-pulse" />
      </div>
      <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-haven-stone/70">{label}</p>
    </div>
  </div>
);
