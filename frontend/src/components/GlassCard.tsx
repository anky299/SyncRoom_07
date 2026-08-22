import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

export function GlassCard({ children, className = '', glow = false }: GlassCardProps) {
  return (
    <div
      className={`
        relative overflow-hidden
        blue-glass-card rounded-2xl
        transition-all duration-300
        ${glow ? 'border-[#00B4D8]/60 shadow-[0_0_30px_rgba(0,180,216,0.25)]' : ''}
        ${className}
      `}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
}
