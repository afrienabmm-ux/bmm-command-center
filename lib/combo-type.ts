// Services Combos come in two types, reported separately. Rock Oil combos
// are the "Package A-D" set built on Rock Oil's Guardian range; every other
// combo is a Yamalube "Pakej". Decided from the combo's own name and spec, so
// a new combo lands in the right type as long as it's named the same way.
export type ComboType = "Yamalube" | "Rock Oil";
export const COMBO_TYPES: ComboType[] = ["Yamalube", "Rock Oil"];

export function comboType(pkg: { name?: string | null; spec?: string | null } | null | undefined): ComboType {
  const text = `${pkg?.name ?? ""} ${pkg?.spec ?? ""}`;
  return /rock\s*oil|guardian|^\s*package\s+[a-z]\b/i.test(text) ? "Rock Oil" : "Yamalube";
}
