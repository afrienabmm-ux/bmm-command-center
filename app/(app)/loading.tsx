// Shown instantly on navigation while the page's data loads, so moving
// between pages feels immediate instead of freezing on the old screen.
export default function Loading() {
  return (
    <div className="flex flex-col h-full">
      <div className="min-h-16 border-b border-neutral-200 flex items-center px-8 py-3 shrink-0">
        <div className="space-y-2">
          <div className="h-4 w-40 bg-neutral-200 rounded animate-pulse" />
          <div className="h-3 w-56 bg-neutral-100 rounded animate-pulse" />
        </div>
      </div>
      <div className="p-8 space-y-4">
        <div className="h-24 bg-neutral-100 rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-24 bg-neutral-100 rounded-xl animate-pulse" />
          <div className="h-24 bg-neutral-100 rounded-xl animate-pulse" />
          <div className="h-24 bg-neutral-100 rounded-xl animate-pulse" />
          <div className="h-24 bg-neutral-100 rounded-xl animate-pulse" />
        </div>
        <div className="h-64 bg-neutral-100 rounded-xl animate-pulse" />
      </div>
    </div>
  );
}
