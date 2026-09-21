// The daily After-Sales summary posted to Telegram. Reads with the admin
// client (no signed-in user — it runs from a scheduled job) and only reads:
// it never changes any record.
import { supabaseAdmin } from "./supabase-server";
import { BRANCHES } from "./branch";
import { classifyYamahaModel } from "./yamaha-model";
import { getGenbluPlatePoints, getGenbluTxLite, jobGenbluPoints } from "./genblu-plates";
import { todayInMalaysia } from "./malaysia-time";

const MAX_LISTED = 8;

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

export async function buildAfterSalesDigest(dateOverride?: string): Promise<string> {
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

  const lines: string[] = [`📊 After-Sales summary — ${day}`, ""];
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

    lines.push(`${label}`);
    lines.push(`• Jobs completed: ${dayJobs.length} (Yamaha ${dayYamaha.length})`);
    lines.push(`• GenBlu on Yamaha this month: ${monthGb}/${monthYamaha} (${pct}%)`);
    if (dayNoGb.length > 0) {
      lines.push(`• No GenBlu yesterday (${dayNoGb.length}):`);
      for (const j of dayNoGb.slice(0, MAX_LISTED)) lines.push(`   - ${j.customer_name ?? "?"} · ${j.plate_no ?? "-"}`);
      if (dayNoGb.length > MAX_LISTED) lines.push(`   … and ${dayNoGb.length - MAX_LISTED} more`);
    } else if (dayYamaha.length > 0) {
      lines.push("• Every Yamaha job yesterday has GenBlu ✅");
    }
    lines.push("");
  }
  if (allDay === 0) lines.push("No completed jobs were recorded for this day.");
  return lines.join("\n").trim();
}

export async function sendTelegram(text: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { ok: false, error: "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set" };
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) return { ok: false, error: `Telegram said ${res.status}: ${(await res.text()).slice(0, 200)}` };
  return { ok: true };
}
