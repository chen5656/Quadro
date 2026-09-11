interface TrophyIconProps {
  className?: string;
  size?: number;
}

/**
 * A rich, 3D-styled metallic gold trophy icon with highlights and depth gradients.
 */
export function TrophyIcon({ className = '', size = 28 }: TrophyIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 drop-shadow-[0_2px_8px_rgba(234,179,8,0.45)] ${className}`}
      aria-hidden="true"
    >
      <defs>
        {/* Cup body metallic gradient */}
        <linearGradient id="trophy-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF275" />
          <stop offset="25%" stopColor="#FACC15" />
          <stop offset="65%" stopColor="#CA8A04" />
          <stop offset="100%" stopColor="#854D0E" />
        </linearGradient>

        {/* Cup inner depth */}
        <linearGradient id="trophy-cup-rim" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#713F12" />
          <stop offset="100%" stopColor="#A16207" />
        </linearGradient>

        {/* Handles gradient */}
        <linearGradient id="trophy-handle" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#EAB308" />
          <stop offset="50%" stopColor="#FEF08A" />
          <stop offset="100%" stopColor="#A16207" />
        </linearGradient>

        {/* Base dark pedestal gradient */}
        <linearGradient id="trophy-pedestal" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3F3F46" />
          <stop offset="50%" stopColor="#27272A" />
          <stop offset="100%" stopColor="#18181B" />
        </linearGradient>

        {/* Stem gold */}
        <linearGradient id="trophy-stem" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#CA8A04" />
          <stop offset="50%" stopColor="#FEF08A" />
          <stop offset="100%" stopColor="#854D0E" />
        </linearGradient>
      </defs>

      {/* Left Handle */}
      <path
        d="M9 7 C4 7, 3 13, 8 16 C9.5 16.8, 11 16.5, 11 16.5"
        stroke="url(#trophy-handle)"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Right Handle */}
      <path
        d="M23 7 C28 7, 29 13, 24 16 C22.5 16.8, 21 16.5, 21 16.5"
        stroke="url(#trophy-handle)"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Main Cup Body */}
      <path
        d="M8.5 6 C8.5 6, 8 16, 16 16 C24 16, 23.5 6, 23.5 6 Z"
        fill="url(#trophy-gold)"
      />

      {/* Cup Rim Oval */}
      <ellipse cx="16" cy="6" rx="7.5" ry="2.2" fill="url(#trophy-cup-rim)" />
      <ellipse cx="16" cy="6" rx="7.5" ry="2.2" stroke="#FEF08A" strokeWidth="0.8" fill="none" opacity="0.8" />

      {/* 3D Highlight specular arc on cup body */}
      <path
        d="M11 8 C10.5 11, 12 14, 15 15"
        stroke="#FFFFFF"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.6"
      />

      {/* Stem / Neck */}
      <path
        d="M14 16 L18 16 L17.5 21 L14.5 21 Z"
        fill="url(#trophy-stem)"
      />

      {/* Stem Knocker / Ring */}
      <ellipse cx="16" cy="20.5" rx="3" ry="1" fill="#FEF08A" opacity="0.9" />

      {/* Pedestal Base */}
      <path
        d="M11.5 22 L20.5 22 L22.5 27 L9.5 27 Z"
        fill="url(#trophy-pedestal)"
      />
      {/* Gold Plate on Pedestal */}
      <rect x="12" y="23.5" width="8" height="2.2" rx="0.5" fill="url(#trophy-gold)" />

      {/* Star emboss on cup */}
      <path
        d="M16 9.2 L16.8 10.8 L18.5 11 L17.2 12.2 L17.6 13.9 L16 13 L14.4 13.9 L14.8 12.2 L13.5 11 L15.2 10.8 Z"
        fill="#FEF08A"
        opacity="0.85"
      />
    </svg>
  );
}
