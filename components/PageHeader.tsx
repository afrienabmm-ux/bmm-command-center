import type { ReactNode } from "react";

export default function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="min-h-16 border-b border-neutral-200 flex items-center justify-between px-8 py-3 shrink-0 gap-4 flex-wrap">
      <div>
        <h1 className="text-base font-semibold text-neutral-900">{title}</h1>
        {subtitle && <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
