// Bare uppercase letters/digits only, so "ABC 1234" and "ABC1234" (or a
// stray extra space from OCR/typing) are treated as the same plate when
// matching a Walk-in job against a GenBlu registration.
export function normalizePlate(plate: string): string {
  return plate.trim().toUpperCase().replace(/[\s-]/g, "");
}
