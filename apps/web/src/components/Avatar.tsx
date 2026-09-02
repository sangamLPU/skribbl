"use client";

import { AvatarConfig } from "@/store/useUserStore";

interface AvatarProps {
  config: AvatarConfig;
  size?: number;
}

export function Avatar({ config, size = 100 }: AvatarProps) {
  // A simple procedural SVG avatar for MVP original assets.
  
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Body */}
      <circle cx="50" cy="50" r="45" fill={config.bodyColor} />
      
      {/* Eyes based on config.eyes */}
      {config.eyes === 0 && (
        <>
          <circle cx="35" cy="40" r="5" fill="black" />
          <circle cx="65" cy="40" r="5" fill="black" />
        </>
      )}
      {config.eyes === 1 && (
        <>
          <line x1="30" y1="40" x2="40" y2="40" stroke="black" strokeWidth="3" />
          <line x1="60" y1="40" x2="70" y2="40" stroke="black" strokeWidth="3" />
        </>
      )}
      
      {/* Mouth based on config.mouth */}
      {config.mouth === 0 && (
        <path d="M 35 65 Q 50 80 65 65" stroke="black" strokeWidth="3" fill="transparent" />
      )}
      {config.mouth === 1 && (
        <line x1="40" y1="65" x2="60" y2="65" stroke="black" strokeWidth="3" />
      )}
    </svg>
  );
}
