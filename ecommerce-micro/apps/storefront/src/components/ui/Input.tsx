import type { InputHTMLAttributes, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
}

export function Input({ label, error, hint, id, icon, className = "", ...rest }: InputProps) {
  const inputId = id || rest.name;
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && <span className="absolute inset-y-0 left-0 flex h-full items-center pl-3 text-slate-400">{icon}</span>}
        <input
          id={inputId}
          className={`input-base pl-10 ${error ? "focus:border-red-400 focus:ring-red-400/30" : ""} ${className}`}
          aria-invalid={!!error}
          {...rest}
        />
      </div>
      {error ? (
        <p className="flex items-center gap-1 text-xs text-rose-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
