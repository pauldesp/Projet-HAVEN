
import React from 'react';

interface LogoProps {
  className?: string;
  white?: boolean; // Pour le mode sombre (ex: login page admin)
}

export const Logo: React.FC<LogoProps> = ({ className = "h-10", white = false }) => {
  return (
    <img 
      src="/logo.png" 
      alt="HAVEN" 
      className={`block w-auto ${className} ${white ? 'brightness-0 invert' : ''}`}
      draggable={false}
    />
  );
};
