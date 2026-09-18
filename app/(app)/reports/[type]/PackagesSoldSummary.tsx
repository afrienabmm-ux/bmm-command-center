type MechanicPackageCount = { mechanicName: string; mechanicCode: string; count: number };

// Same idea as MechanicRevenueSummary — a small table alongside the full
// sale-by-sale list, built entirely from the same rows already fetched
// for the report rather than a separate query.
export default function PackagesSoldSummary({ mechanics }: { mechanics: MechanicPackageCount[] }) {
  return (
    <div>
      <p className="text-sm font-medium text-neutral-800 mb-3">Packages Sold by Mechanic</p>
      <div className="bg-white border border-neutral-200 rounded-xl overflow-x-auto max-w-2xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">
              <th className="px-4 py-2.5">Mechanic</th>
              <th className="px-4 py-2.5">Code</th>
              <th className="px-4 py-2.5 text-right">Sold</th>
            </tr>
          </thead>
          <tbody>
            {mechanics.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-center text-neutral-500">
                  No data yet.
                </td>
              </tr>
            ) : (
              mechanics.map((m) => (
                <tr key={m.mechanicCode} className="border-t border-neutral-100">
                  <td className="px-4 py-2.5 whitespace-nowrap text-neutral-700">{m.mechanicName}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-neutral-700">{m.mechanicCode}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap text-neutral-900 font-medium">{m.count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
