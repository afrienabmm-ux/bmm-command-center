import { COMBO_TYPES } from "@/lib/combo-type";
import type { ComboTypeTotal, MechanicComboCount } from "./combo-summary";

const TH = "px-4 py-2.5";
const TD = "px-4 py-2.5 whitespace-nowrap";

// Small tables alongside the full sale-by-sale list, computed from the rows
// the table is currently showing — so they follow its Type / Branch / date
// filters instead of always describing every sale ever made.
export default function PackagesSoldSummary({ types, mechanics }: { types: ComboTypeTotal[]; mechanics: MechanicComboCount[] }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-neutral-800 mb-3">Sold by Combo Type</p>
        <div className="bg-white border border-neutral-200 rounded-xl overflow-x-auto max-w-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">
                <th className={TH}>Type</th>
                <th className={`${TH} text-right`}>Sold</th>
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.type} className="border-t border-neutral-100">
                  <td className={`${TD} text-neutral-700`}>{t.type}</td>
                  <td className={`${TD} text-right text-neutral-900 font-medium`}>{t.sold}</td>
                </tr>
              ))}
              <tr className="border-t border-neutral-200 bg-neutral-50">
                <td className={`${TD} font-semibold text-neutral-800`}>Total</td>
                <td className={`${TD} text-right font-semibold text-neutral-900`}>{types.reduce((n, t) => n + t.sold, 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-neutral-800 mb-3">Sold by Mechanic</p>
        <div className="bg-white border border-neutral-200 rounded-xl overflow-x-auto max-w-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">
                <th className={TH}>Mechanic</th>
                {COMBO_TYPES.map((t) => (
                  <th key={t} className={`${TH} text-right`}>{t}</th>
                ))}
                <th className={`${TH} text-right`}>Total</th>
              </tr>
            </thead>
            <tbody>
              {mechanics.length === 0 ? (
                <tr>
                  <td colSpan={COMBO_TYPES.length + 2} className="px-4 py-4 text-center text-neutral-500">
                    No data yet.
                  </td>
                </tr>
              ) : (
                mechanics.map((m) => (
                  <tr key={m.mechanicCode} className="border-t border-neutral-100">
                    <td className={`${TD} text-neutral-700`}>
                      {m.mechanicName} <span className="text-neutral-400">({m.mechanicCode})</span>
                    </td>
                    {COMBO_TYPES.map((t) => (
                      <td key={t} className={`${TD} text-right text-neutral-700`}>{m.byType[t]}</td>
                    ))}
                    <td className={`${TD} text-right text-neutral-900 font-semibold`}>{m.total}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
