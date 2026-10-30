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
    <div className="min-h-16 flex items-center justify-between px-4 md:px-8 pt-5 pb-1 md:pt-7 shrink-0 gap-4 flex-wrap">
      <div className="flex items-stretch gap-3">
        <span aria-hidden="true" className="w-1.5 rounded-full bg-gradient-to-b from-red-500 to-orange-400" />
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-neutral-900">{title}</h1>
          {subtitle && <p className="text-xs md:text-sm text-neutral-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
