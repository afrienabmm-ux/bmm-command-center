import "server-only";
import { gzipSync } from "zlib";
import { supabaseAdmin } from "./supabase-server";
import { fetchAllRows } from "./fetch-all";

// Nightly copy of every table, kept in a private storage bucket. The
// database plan has no "rewind to yesterday", so this is what lets a bad
// edit or a mass delete (like 6-7 Oct, when deleting mechanics blanked 684
// jobs) be put back from the night before.
export const BACKUP_BUCKET = "db-backups";
const KEEP_DAYS = 30;
// One-time login codes — short-lived and worthless after a few minutes.
const SKIP_TABLES = new Set(["cc_email_otps"]);

// Read the table list from the database itself, so a table added later is
// backed up without anyone remembering to add it here.
async function listTables(): Promise<string[]> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`Couldn't list tables (${res.status})`);
  const spec = (await res.json()) as { definitions?: Record<string, unknown> };
  return Object.keys(spec.definitions ?? {})
    .filter((t) => !SKIP_TABLES.has(t))
    .sort();
}

async function ensureBucket(): Promise<void> {
  const { data } = await supabaseAdmin.storage.getBucket(BACKUP_BUCKET);
  if (data) return;
  const { error } = await supabaseAdmin.storage.createBucket(BACKUP_BUCKET, { public: false });
  if (error && !/already exists/i.test(error.message)) throw new Error(`Couldn't create backup bucket: ${error.message}`);
}

export type BackupResult = { file: string; tables: Record<string, number>; bytes: number; deletedOld: string[] };

export async function runDatabaseBackup(dateKey: string): Promise<BackupResult> {
  const tables = await listTables();
  const dump: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const { data, error } = await fetchAllRows((a, b) => supabaseAdmin.from(table).select("*").order("id").range(a, b));
    if (error) throw new Error(`${table}: ${error.message}`);
    dump[table] = data ?? [];
    counts[table] = dump[table].length;
  }

  const body = gzipSync(JSON.stringify({ takenAt: new Date().toISOString(), tables: dump }));
  await ensureBucket();
  const file = `${dateKey}.json.gz`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BACKUP_BUCKET)
    .upload(file, body, { contentType: "application/gzip", upsert: true });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  // Keep the last month only.
  const cutoff = new Date(`${dateKey}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - KEEP_DAYS);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  const { data: files } = await supabaseAdmin.storage.from(BACKUP_BUCKET).list("", { limit: 1000 });
  const old = (files ?? []).map((f) => f.name).filter((n) => /^\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n) && n.slice(0, 10) < cutoffKey);
  if (old.length) await supabaseAdmin.storage.from(BACKUP_BUCKET).remove(old);

  return { file, tables: counts, bytes: body.length, deletedOld: old };
}
