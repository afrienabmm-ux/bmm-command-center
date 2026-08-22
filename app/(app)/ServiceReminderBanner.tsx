"use client";

import Link from "next/link";
import { CalendarClock, MessageCircle } from "lucide-react";
import type { ServiceReminder } from "@/lib/repairs-actions";

// wa.me needs the country code instead of the leading "0" a local Malaysian
// number is normally written with ("0123456789" -> "60123456789") — no
// WhatsApp Business API or paid service involved, just the plain
// click-to-chat link format.
function toWhatsAppNumber(rawPhone: string): string | null {
  const digits = rawPhone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("60")) return digits;
  if (digits.startsWith("0")) return `60${digits.slice(1)}`;
  return digits;
}

function buildReminderLink(reminder: ServiceReminder): string | null {
  const number = toWhatsAppNumber(reminder.customerPhone);
  if (!number) return null;
  const message = `Hi ${reminder.customerName || "there"}, this is Berjaya Mega Motors — your bike${
    reminder.plateNo ? ` (${reminder.plateNo})` : ""
  } is due for its next service. Would you like to book an appointment?`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export default function ServiceReminderBanner({ reminders }: { reminders: ServiceReminder[] }) {
  if (reminders.length === 0) return null;

  return (
    <div className="bg-sky-50 border border-sky-200 rounded-xl p-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
          <CalendarClock size={17} className="text-sky-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-sky-700">
            {reminders.length} customer{reminders.length === 1 ? "" : "s"} due for their next service — remind them
          </p>
          <div className="mt-2 space-y-1.5">
            {reminders.slice(0, 6).map((r) => {
              const link = buildReminderLink(r);
              return (
                <div key={r.id} className="flex items-center justify-between gap-2 text-xs text-sky-700">
                  <span className="min-w-0 truncate">
                    {r.customerName || r.plateNo}
                    {" — "}
                    {r.daysUntil >= 0 ? `due in ${r.daysUntil}d` : `${-r.daysUntil}d overdue`}
                  </span>
                  {link ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 flex items-center gap-1 bg-white border border-sky-200 hover:border-sky-300 text-sky-700 font-medium px-2 py-1 rounded-full transition-colors"
                    >
                      <MessageCircle size={11} /> Send Reminder
                    </a>
                  ) : (
                    <span className="shrink-0 text-sky-400">No phone on file</span>
                  )}
                </div>
              );
            })}
            {reminders.length > 6 && (
              <p className="text-[11px] text-sky-500">+{reminders.length - 6} more</p>
            )}
          </div>
          <Link href="/repairs/walk-in" className="inline-block text-xs font-medium text-sky-700 hover:text-sky-800 mt-2 underline">
            View all in Jobsheet
          </Link>
        </div>
      </div>
    </div>
  );
}
