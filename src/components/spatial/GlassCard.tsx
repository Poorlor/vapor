import React from 'react';

export interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  animKey?: number;
  tint?: 'default' | 'teal' | 'dark' | 'light' | 'emerald' | 'static';
  hoverLift?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  hoverLift = true,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`${
        hoverLift ? 'group' : ''
      } glass-card relative border rounded-[26px] ${className}`}
    >
      {/* Top specular highlight line */}
      <div
        className={`absolute inset-x-4 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-60 ${
          hoverLift ? 'group-hover:opacity-100 transition-opacity' : ''
        } pointer-events-none`}
      />
      {children}
    </div>
  );
};
