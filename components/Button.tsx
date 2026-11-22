
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  children,
  className = '',
  ...props
}) => {
  // Press feedback (scale on :active) comes from styles/responsive.css, in 120 ms: never a 300 ms lag after the tap.
  const baseStyles = "inline-flex min-h-11 min-w-0 items-center justify-center gap-2 font-bold rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-haven-red disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-haven-navy text-white hover:bg-haven-navy-deep shadow-sm",
    secondary: "bg-haven-red text-white hover:bg-haven-red-deep shadow-sm",
    outline: "border border-gray-200 text-haven-navy hover:bg-gray-50",
    ghost: "text-haven-navy hover:bg-gray-50"
  };

  const sizes = {
    sm: "text-xs px-4 py-2",
    md: "text-sm px-6 py-3",
    lg: "text-base px-8 py-4"
  };

  const width = fullWidth ? "w-full" : "";

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${width} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
