import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium text-credav-muted">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-3.5 py-2.5 bg-credav-card/90 border rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition-all ${
          error
            ? 'border-rose-500/80 focus:border-rose-500 focus:ring-rose-500'
            : 'border-credav-border focus:border-credav-cyan focus:ring-credav-cyan'
        } ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-rose-400">{error}</p>}
      {helperText && !error && <p className="text-xs text-slate-500">{helperText}</p>}
    </div>
  );
};
