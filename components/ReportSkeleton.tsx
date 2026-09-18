// Shown immediately on navigating to any report, before its (sometimes
// slow — a full jobsheet-history scan, several months of data) query
// resolves. Without this, removing Link prefetch (see Sidebar.tsx) traded
// "every report secretly loads in the background on every page view" for
// "a report page shows nothing at all until its own query finishes" —
// this is what actually fixes the second half of that trade: the click
// still waits the same real time, but it no longer *feels* broken while it does.
export default function ReportSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="min-h-16 border-b border-neutral-200 flex items-center px-8 py-3 shrink-0">
        <div className="h-4 w-40 bg-neutral-200 rounded animate-pulse" />
      </div>
      <div className="flex-1 overflow-y-auto p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-64 bg-neutral-100 rounded-lg animate-pulse" />
          <div className="h-9 w-32 bg-neutral-100 rounded-lg animate-pulse" />
          <div className="h-9 w-32 bg-neutral-100 rounded-lg animate-pulse ml-auto" />
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
          <div className="h-9 bg-neutral-50 border-b border-neutral-200" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-11 border-b border-neutral-100 last:border-0 flex items-center px-5">
              <div className="h-3 w-full max-w-md bg-neutral-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
