import type { SVGProps } from 'react';

type WardrobeIconProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

export const WardrobeIcon = ({ size = 20, ...props }: WardrobeIconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <rect x="4" y="2.5" width="16" height="19" rx="1.5" />
    <path d="M12 2.5v19M9.5 12h.01M14.5 12h.01M6 21.5v1M18 21.5v1" />
  </svg>
);
