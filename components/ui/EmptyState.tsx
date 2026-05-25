import type { ReactNode } from "react";
import { Button } from "./Button";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  children?: ReactNode;
}

export function EmptyState({ icon = "📭", title, description, action, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
      <span className="text-5xl">{icon}</span>
      <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">{title}</h3>
      {description && <p className="text-sm text-zinc-500 max-w-xs">{description}</p>}
      {action && (
        <Button variant="primary" size="md" onClick={action.onClick} className="mt-2">
          {action.label}
        </Button>
      )}
      {children}
    </div>
  );
}
