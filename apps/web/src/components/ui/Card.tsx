import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  glow = false,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`glass-panel rounded-xl p-5 border border-credav-border/70 ${
        glow ? 'shadow-glow border-credav-cyan/40' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
