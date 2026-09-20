function cx(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

interface SpinnerProps {
  label?: string;
  className?: string;
}

export function Spinner({ label = "Loading…", className = "" }: SpinnerProps) {
  return (
    <div className={cx("flex flex-col items-center justify-center gap-3 py-16 text-slate-500", className)}>
      <svg className="h-8 w-8 animate-spin text-amber-600" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      <span className="text-sm">{label}</span>
    </div>
  );
}
