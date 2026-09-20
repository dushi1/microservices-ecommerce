import type { ReactNode } from "react";
import { Button } from "./Button";

function cx(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({ icon, title, message, action, className = "" }: EmptyStateProps) {
  return (
    <div
      className={cx("card flex flex-col items-center justify-center py-16 text-center", className)}
    >
      {icon && <div className="mb-4 text-5xl opacity-60">{icon}</div>}
      <h3 className="text-lg font-semibold text-slate-700">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-6"><Button onClick={action.onClick}>{action.label}</Button></div>}
    </div>
  );
}
