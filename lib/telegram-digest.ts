// The daily After-Sales summary posted to Telegram. Reads with the admin
// client (no signed-in user — it runs from a scheduled job) and only reads:
// it never changes any record.
//
// Each branch has its own Telegram group (TELEGRAM_CHAT_ID_KAPAR,
// TELEGRAM_CHAT_ID_SETIA_ALAM, TELEGRAM_CHAT_ID_PUNCAK_ALAM) that only sees its
// own branch. TELEGRAM_CHAT_ID is the management group and gets all branches.
import { supabaseAdmin } from "./supabase-server";
import { BRANCHES, type Branch } from "./branch";
import { classifyYamahaModel } from "./yamaha-model";
import { getGenbluPlatePoints, getGenbluTxLite, jobGenbluPoints } from "./genblu-plates";
import { todayInMalaysia } from "./malaysia-time";

function addDays(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}

type JobRow = {
  branch: string;
  job_no: string;
  customer_name: string | null;
  plate_no: string | null;
  model: string | null;
  revenue_amount: number | string;
  completed_date: string | null;
};

/** Text for one message, per branch, plus the combined text for management. */
export type BranchMessages = { combined: string | null; byBranch: Partial<Record<Branch, string>> };

export async function buildAfterSalesDigest(dateOverride?: string): Promise<BranchMessages> {
  const today = todayInMalaysia();
  const day = dateOverride ?? addDays(today, -1); // the day being reported (yesterday by default)
  const monthStart = `${day.slice(0, 7)}-01`;

  const [{ data, error }, plates, txs] = await Promise.all([
    supabaseAdmin
      .from("cc_repair_jobs")
      .select("branch, job_no, customer_name, plate_no, model, revenue_amount, completed_date")
      .eq("status", "Completed")
      .gte("completed_date", monthStart)
      .lte("completed_date", day)
      .limit(5000),
    getGenbluPlatePoints(),
    getGenbluTxLite(),
  ]);
  if (error) throw new Error(error.message);
  const jobs = (data ?? []) as JobRow[];

  const byBranch: Partial<Record<Branch, string>> = {};
  const blocks: string[] = [];
  let allDay = 0;
  for (const { value, label } of BRANCHES) {
    const mine = jobs.filter((j) => j.branch === value);
    const yamahaJobs = mine.filter((j) => classifyYamahaModel(j.model ?? "") === "yamaha");
    const withGb = (j: JobRow) =>
      jobGenbluPoints(plates, txs, { customerName: j.customer_name ?? "", plateNo: j.plate_no ?? "", cost: Number(j.revenue_amount), date: j.completed_date }) !== null;

    const dayJobs = mine.filter((j) => j.completed_date === day);
    const dayYamaha = yamahaJobs.filter((j) => j.completed_date === day);
    const dayNoGb = dayYamaha.filter((j) => !withGb(j));
    const monthYamaha = yamahaJobs.length;
    const monthGb = yamahaJobs.filter(withGb).length;
    const pct = monthYamaha > 0 ? Math.round((monthGb / monthYamaha) * 100) : 0;
    allDay += dayJobs.length;

    const lines: string[] = [];
    lines.push(`• Jobs completed: ${dayJobs.length} (Yamaha ${dayYamaha.length})`);
    lines.push(`• GenBlu on Yamaha this month: ${monthGb}/${monthYamaha} (${pct}%)`);
    if (dayNoGb.length > 0) {
      lines.push(`• No GenBlu yesterday (${dayNoGb.length}):`);
      for (const j of dayNoGb) lines.push(`   - ${j.customer_name ?? "?"} · ${j.plate_no ?? "-"}`);
    } else if (dayYamaha.length > 0) {
      lines.push("• Every Yamaha job yesterday has GenBlu ✅");
    }
    byBranch[value] = `📊 ${label} summary — ${day}\n\n${lines.join("\n")}`;
    blocks.push(`${label}\n${lines.join("\n")}`);
  }
  let combined = `📊 After-Sales summary — ${day}\n\n${blocks.join("\n\n")}`;
  if (allDay === 0) combined += "\n\nNo completed jobs were recorded for this day.";
  return { combined, byBranch };
}

// Telegram rejects any single message over 4096 characters — it doesn't
// truncate it for you, the send just fails. A list with every name can run
// well past that, so a long message is split into several, breaking only at
// line breaks so a name is never cut in half. Nothing relies on a person
// tapping "Show more".
const TELEGRAM_LIMIT = 3800;

export function splitForTelegram(text: string): string[] {
  if (text.length <= TELEGRAM_LIMIT) return [text];
  const lines = text.split("\n");
  const parts: string[] = [];
  let current = "";
  for (const line of lines) {
    if (current && current.length + line.length + 1 > TELEGRAM_LIMIT) {
      parts.push(current);
      current = line;
    } else {
      current = current ? `${current}\n${line}` : line;
    }
  }
  if (current) parts.push(current);
  return parts.length > 1 ? parts.map((p, i) => `${p}\n\n(part ${i + 1}/${parts.length})`) : parts;
}

async function sendOne(token: string, chatId: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) return { ok: false, error: `Telegram said ${res.status}: ${(await res.text()).slice(0, 200)}` };
  return { ok: true };
}

/** Sends the full text, split into several messages if it's too long for one. */
export async function sendTelegram(text: string, chatIdOverride?: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = chatIdOverride ?? process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { ok: false, error: "TELEGRAM_BOT_TOKEN or the chat id is not set" };
  for (const part of splitForTelegram(text)) {
    const r = await sendOne(token, chatId, part);
    if (!r.ok) return r;
  }
  return { ok: true };
}

/** The Telegram group for one branch, or undefined when it hasn't been set up yet. */
export function branchChatId(branch: Branch): string | undefined {
  return process.env[`TELEGRAM_CHAT_ID_${branch.toUpperCase()}`] || undefined;
}

/**
 * Sends each branch its own message to its own group, and the combined message
 * to the management group. A branch with no group set is skipped (reported),
 * never sent to someone else's group.
 */
export async function sendToGroups(m: BranchMessages): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  if (m.combined) {
    const r = await sendTelegram(m.combined);
    result.management = r.ok ? "sent" : r.error ?? "failed";
  }
  for (const { value } of BRANCHES) {
    const text = m.byBranch[value];
    if (!text) continue;
    const chat = branchChatId(value);
    if (!chat) {
      result[value] = "no group set";
      continue;
    }
    const r = await sendTelegram(text, chat);
    result[value] = r.ok ? "sent" : r.error ?? "failed";
  }
  return result;
}
