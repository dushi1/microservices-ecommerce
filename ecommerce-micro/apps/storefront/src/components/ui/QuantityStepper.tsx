interface QuantityStepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function QuantityStepper({ value, min = 0, max, onChange, disabled }: QuantityStepperProps) {
  const atMin = value <= min;
  const atMax = max !== undefined && value >= max;

  return (
    <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white shadow-xs">
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-l-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
        onClick={() => !atMin && onChange(value - 1)}
        disabled={disabled || atMin}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className="flex h-9 w-12 items-center justify-center border-x border-slate-200 text-sm font-medium tabular-nums">
        {value}
      </span>
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-r-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
        onClick={() => !atMax && onChange(value + 1)}
        disabled={disabled || atMax}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
