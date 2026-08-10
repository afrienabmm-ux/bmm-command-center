"use client";

import { useState, useTransition } from "react";
import { UserCheck, ShieldOff, Settings2, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import {
  approveUserAction,
  updateMemberAction,
  updateMemberPagesAction,
  revokeUserAction,
  type TeamMember,
} from "@/lib/user-actions";
import type { Role } from "@/lib/current-user";
import { BRANCHES, type Branch } from "@/lib/branch";
import { PAGE_DEFS, type PageKey } from "@/lib/permissions";
import { formatDate } from "@/lib/format";

const ROLES: Role[] = ["Manager", "Admin", "Mechanic PIC"];

export default function TeamClient({
  members,
  currentUserId,
}: {
  members: TeamMember[];
  currentUserId: string;
}) {
  const pending = members.filter((m) => m.status === "pending");
  const others = members.filter((m) => m.status !== "pending");

  return (
    <div className="space-y-8 max-w-4xl">
      {pending.length > 0 && (
        <div>
          <p className="text-sm font-medium text-neutral-800 mb-3">Waiting for approval ({pending.length})</p>
          <div className="space-y-3">
            {pending.map((m) => (
              <PendingRow key={m.id} member={m} />
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-sm font-medium text-neutral-800 mb-3">Team members ({others.length})</p>
        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Name / Email</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Role</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Branch</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Status</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Joined</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {others.map((m) => (
                  <MemberRow key={m.id} member={m} isSelf={m.id === currentUserId} />
                ))}
                {others.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-neutral-500 text-sm">
                      No approved team members yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function PendingRow({ member }: { member: TeamMember }) {
  const [role, setRole] = useState<Role>("Mechanic PIC");
  const [branch, setBranch] = useState<Branch>(member.homeBranch);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-neutral-800 font-medium truncate">{member.name || member.email}</p>
        <p className="text-xs text-neutral-500">
          {member.email} · Signed up {formatDate(member.createdAt)}
        </p>
      </div>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as Role)}
        className="bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <select
        value={branch}
        onChange={(e) => setBranch(e.target.value as Branch)}
        className="bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
      >
        {BRANCHES.map((b) => (
          <option key={b.value} value={b.value}>
            {b.label}
          </option>
        ))}
      </select>
      <button
        onClick={() => startTransition(() => approveUserAction(member.id, role, branch))}
        disabled={isPending}
        className="flex items-center justify-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
      >
        <UserCheck size={15} /> Approve
      </button>
    </div>
  );
}

function MemberRow({ member, isSelf }: { member: TeamMember; isSelf: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [showPermissions, setShowPermissions] = useState(false);

  function update(role: Role, branch: Branch) {
    startTransition(() => updateMemberAction(member.id, role, branch));
  }

  const isManagerRole = member.role === "Manager";

  return (
    <>
      <tr className="border-b border-neutral-100 last:border-0">
        <td className="px-5 py-3.5 text-neutral-800 font-medium whitespace-nowrap">
          {member.name || member.email} {isSelf && <span className="text-neutral-500 font-normal">(you)</span>}
        </td>
        <td className="px-5 py-3.5">
          <select
            value={member.role ?? ""}
            disabled={isSelf || isPending || member.status === "revoked"}
            onChange={(e) => update(e.target.value as Role, member.homeBranch)}
            className="bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50 disabled:opacity-50"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </td>
        <td className="px-5 py-3.5">
          <select
            value={member.homeBranch}
            disabled={isPending || member.status === "revoked"}
            onChange={(e) => update(member.role ?? "Mechanic PIC", e.target.value as Branch)}
            className="bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50 disabled:opacity-50"
          >
            {BRANCHES.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </td>
        <td className="px-5 py-3.5">
          <span
            className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
              member.status === "approved"
                ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                : "bg-red-500/10 text-red-700 border-red-500/20"
            }`}
          >
            {member.status === "approved" ? "Active" : "Revoked"}
          </span>
        </td>
        <td className="px-5 py-3.5 text-neutral-500 whitespace-nowrap">{formatDate(member.createdAt)}</td>
        <td className="px-5 py-3.5">
          <div className="flex items-center justify-end gap-3">
            {!isManagerRole && member.status === "approved" && (
              <button
                onClick={() => setShowPermissions((v) => !v)}
                className="flex items-center gap-1 text-neutral-500 hover:text-indigo-700 transition-colors text-xs font-medium"
              >
                <Settings2 size={14} /> Functions
                {showPermissions ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            )}
            {!isSelf && member.status === "approved" && (
              <button
                onClick={() => startTransition(() => revokeUserAction(member.id))}
                disabled={isPending}
                className="flex items-center gap-1.5 text-neutral-500 hover:text-red-700 disabled:opacity-50 transition-colors text-xs font-medium"
              >
                <ShieldOff size={14} /> Revoke
              </button>
            )}
          </div>
        </td>
      </tr>
      {showPermissions && !isManagerRole && (
        <tr className="border-b border-neutral-100 last:border-0 bg-neutral-50">
          <td colSpan={6} className="px-5 py-4">
            <PermissionsEditor member={member} />
          </td>
        </tr>
      )}
    </>
  );
}

function PermissionsEditor({ member }: { member: TeamMember }) {
  const [selected, setSelected] = useState<Set<PageKey>>(new Set(member.allowedPages));
  const [isPending, startTransition] = useTransition();

  function toggle(page: PageKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(page)) next.delete(page);
      else next.add(page);
      return next;
    });
  }

  function save() {
    startTransition(() => updateMemberPagesAction(member.id, Array.from(selected)));
  }

  function resetToDefault() {
    startTransition(() => updateMemberPagesAction(member.id, null));
  }

  return (
    <div>
      <p className="text-xs font-medium text-neutral-600 mb-2">
        Which functions can {member.name || member.email} see?
        {member.hasCustomPages && <span className="ml-2 text-indigo-600">(customized)</span>}
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        {PAGE_DEFS.map((p) => (
          <label
            key={p.key}
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors ${
              selected.has(p.key)
                ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-700"
                : "bg-white border-neutral-200 text-neutral-500"
            }`}
          >
            <input
              type="checkbox"
              checked={selected.has(p.key)}
              onChange={() => toggle(p.key)}
              className="accent-indigo-500"
            />
            {p.label}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={isPending}
          className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          Save
        </button>
        <button
          onClick={resetToDefault}
          disabled={isPending}
          className="flex items-center gap-1 text-neutral-500 hover:text-neutral-700 disabled:opacity-50 text-xs font-medium transition-colors"
        >
          <RotateCcw size={12} /> Reset to {member.role} default
        </button>
      </div>
    </div>
  );
}
