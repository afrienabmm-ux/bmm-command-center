// Hands a jobsheet photo/PDF picked from the Jobsheet list's "Add Job" button
// over to the Add Job form, which scans it as soon as it opens. Same browser
// tab, held in memory only — nothing is uploaded until the form saves.
let pending: File | null = null;

export function setPendingJobsheet(file: File): void {
  pending = file;
}

export function takePendingJobsheet(): File | null {
  const file = pending;
  pending = null;
  return file;
}
