import React from 'react';

export default function DefaultLogo({ className = "w-full h-full" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect width="512" height="512" rx="130" fill="#129EEA" />
      <path d="M100 190 L256 110 L412 190 L256 260 Z" fill="white" />
      <path d="M135 210 L135 320 C135 320 256 380 377 320 L377 210 L256 270 Z" fill="white" />
      {/* Background cutout to simulate straps */}
      <path d="M185 240 L185 320 C185 320 256 360 327 320 L327 240 L256 280 Z" fill="#129EEA" />
      <circle cx="256" cy="340" r="100" fill="#E67E22" />
      <circle cx="256" cy="340" r="80" fill="#F39C12" />
    </svg>
  );
}
