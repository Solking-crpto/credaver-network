import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'cyan' | 'violet' | 'green' | 'amber' | 'rose' | 'muted';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'cyan',
  className = '',
  ...props
}) => {
  const variantClasses = {
    cyan: 'bg-credav-cyan/15 text-credav-cyan border-credav-cyan/30',
    violet: 'bg-credav-violet/20 text-purple-300 border-credav-violet/40',
    green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    rose: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    muted: 'bg-slate-800 text-slate-400 border-slate-700',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};
