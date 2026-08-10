"use client";

import { useState, useTransition } from "react";
import { UserCheck, ShieldOff, Settings2, ChevronDown, ChevronUp, RotateCcw, RefreshCcw, Trash2, KeyRound } from "lucide-react";
import {
  approveUserAction,
  updateMemberAction,
  updateMemberPagesAction,
  revokeUserAction,
  reactivateUserAction,
  deleteUserAction,
  resetPasswordAction,
  type TeamMember,
} from "@/lib/user-actions";
import type { Role } from "@/lib/current-user";
import { BRANCHES, type Branch } from "@/lib/branch";
import { PAGE_DEFS, type PageKey } from "@/lib/permissions";
import { formatDate } from "@/lib/format";

const ROLES: Role[] = ["Manager", "Admin", "Mechanic PIC", "IT"];
const ROLE_OR_OTHER = [...ROLES, "Others"] as const;
type RoleChoice = (typeof ROLE_OR_OTHER)[number];

export default function TeamClient({
  members,
  currentUserId,
  viewerRole,
}: {
  members: TeamMember[];
  currentUserId: string;
  viewerRole: Role | null;
}) {
  const isIT = viewerRole === "IT";
  const pending = members.filter((m) => m.status === "pending");
  const others = members.filter((m) => m.status !== "pending");

  return (
    <div className="space-y-8 max-w-5xl">
      {!isIT && pending.length > 0 && (
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
                  <MemberRow key={m.id} member={m} isSelf={m.id === currentUserId} isIT={isIT} />
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
  const [choice, setChoice] = useState<RoleChoice>("Mechanic PIC");
  const [customTitle, setCustomTitle] = useState("");
  const [branch, setBranch] = useState<Branch>(member.homeBranch);
  const [isPending, startTransition] = useTransition();

  function approve() {
    const role: Role = choice === "Others" ? "Mechanic PIC" : choice;
    const positionTitle = choice === "Others" ? customTitle.trim() || "Others" : null;
    startTransition(() => approveUserAction(member.id, role, branch, positionTitle));
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-wrap">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-neutral-800 font-medium truncate">{member.name || member.email}</p>
        <p className="text-xs text-neutral-500">
          {member.email} · Signed up {formatDate(member.createdAt)}
        </p>
      </div>
      <select
        value={choice}
        onChange={(e) => setChoice(e.target.value as RoleChoice)}
        className="bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
      >
        {ROLE_OR_OTHER.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      {choice === "Others" && (
        <input
          type="text"
          value={customTitle}
          onChange={(e) => setCustomTitle(e.target.value)}
          placeholder="e.g. HR"
          className="bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50 w-28"
        />
      )}
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
        onClick={approve}
        disabled={isPending}
        className="flex items-center justify-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
      >
        <UserCheck size={15} /> Approve
      </button>
    </div>
  );
}

function MemberRow({ member, isSelf, isIT }: { member: TeamMember; isSelf: boolean; isIT: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [showPermissions, setShowPermissions] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [choice, setChoice] = useState<RoleChoice>(member.positionTitle ? "Others" : (member.role ?? "Mechanic PIC"));
  const [customTitle, setCustomTitle] = useState(member.positionTitle && member.positionTitle !== "Others" ? member.positionTitle : "");

  function saveRole(nextChoice: RoleChoice, title: string) {
    const role: Role = nextChoice === "Others" ? "Mechanic PIC" : nextChoice;
    const positionTitle = nextChoice === "Others" ? title.trim() || "Others" : null;
    startTransition(() => updateMemberAction(member.id, role, member.homeBranch, positionTitle));
  }

  function updateBranch(branch: Branch) {
    const role: Role = choice === "Others" ? "Mechanic PIC" : choice;
    const positionTitle = choice === "Others" ? customTitle.trim() || "Others" : null;
    startTransition(() => updateMemberAction(member.id, role, branch, positionTitle));
  }

  const isManagerRole = member.role === "Manager" && !member.positionTitle;
  const displayLabel = member.positionTitle ?? member.role;

  return (
    <>
      <tr className="border-b border-neutral-100 last:border-0">
        <td className="px-5 py-3.5 text-neutral-800 font-medium whitespace-nowrap">
          {member.name || member.email} {isSelf && <span className="text-neutral-500 font-normal">(you)</span>}
        </td>
        <td className="px-5 py-3.5">
          {isIT ? (
            <span className="text-neutral-700">{displayLabel}</span>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <select
                  value={choice}
                  disabled={isSelf || isPending || member.status === "revoked"}
                  onChange={(e) => {
                    const next = e.target.value as RoleChoice;
                    setChoice(next);
                    if (next !== "Others") saveRole(next, "");
                  }}
                  className="bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50 disabled:opacity-50"
                >
                  {ROLE_OR_OTHER.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                {choice === "Others" && (
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    onBlur={() => saveRole("Others", customTitle)}
                    placeholder="e.g. HR"
                    disabled={isSelf || isPending || member.status === "revoked"}
                    className="bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50 disabled:opacity-50 w-24"
                  />
                )}
              </div>
              {displayLabel && choice !== "Others" && member.positionTitle && (
                <p className="text-xs text-neutral-500 mt-1">shown as &quot;{member.positionTitle}&quot;</p>
              )}
            </>
          )}
        </td>
        <td className="px-5 py-3.5">
          {isIT ? (
            <span className="text-neutral-700">{BRANCHES.find((b) => b.value === member.homeBranch)?.label ?? member.homeBranch}</span>
          ) : (
            <select
              value={member.homeBranch}
              disabled={isPending || member.status === "revoked"}
              onChange={(e) => updateBranch(e.target.value as Branch)}
              className="bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50 disabled:opacity-50"
            >
              {BRANCHES.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          )}
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
            {!isSelf && member.status === "approved" && (
              <button
                onClick={() => setShowResetPassword(true)}
                disabled={isPending}
                className="flex items-center gap-1.5 text-neutral-500 hover:text-indigo-700 disabled:opacity-50 transition-colors text-xs font-medium"
              >
                <KeyRound size={14} /> Reset Password
              </button>
            )}
            {!isIT && !isManagerRole && member.status === "approved" && (
              <button
                onClick={() => setShowPermissions((v) => !v)}
                className="flex items-center gap-1 text-neutral-500 hover:text-indigo-700 transition-colors text-xs font-medium"
              >
                <Settings2 size={14} /> Functions
                {showPermissions ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            )}
            {!isIT && !isSelf && member.status === "approved" && (
              <button
                onClick={() => startTransition(() => revokeUserAction(member.id))}
                disabled={isPending}
                className="flex items-center gap-1.5 text-neutral-500 hover:text-red-700 disabled:opacity-50 transition-colors text-xs font-medium"
              >
                <ShieldOff size={14} /> Revoke
              </button>
            )}
            {!isIT && !isSelf && member.status === "revoked" && (
              <button
                onClick={() => startTransition(() => reactivateUserAction(member.id))}
                disabled={isPending}
                className="flex items-center gap-1.5 text-neutral-500 hover:text-emerald-700 disabled:opacity-50 transition-colors text-xs font-medium"
              >
                <RefreshCcw size={14} /> Reassign
              </button>
            )}
            {!isIT && !isSelf && (
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={isPending}
                className="flex items-center gap-1.5 text-neutral-500 hover:text-red-700 disabled:opacity-50 transition-colors text-xs font-medium"
              >
                <Trash2 size={14} /> Delete
              </button>
            )}
          </div>
        </td>
      </tr>
      {showPermissions && !isIT && !isManagerRole && (
        <tr className="border-b border-neutral-100 last:border-0 bg-neutral-50">
          <td colSpan={6} className="px-5 py-4">
            <PermissionsEditor member={member} />
          </td>
        </tr>
      )}
      {confirmDelete && (
        <tr>
          <td colSpan={6} className="p-0">
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
              <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-sm p-6">
                <h2 className="text-sm font-semibold text-neutral-900 mb-2">Permanently delete this account?</h2>
                <p className="text-sm text-neutral-600 mb-6">
                  <span className="text-neutral-800 font-medium">{member.name || member.email}</span> will no longer
                  be able to log in, and this can&apos;t be undone. Their email address ({member.email}) will become
                  free to sign up again from scratch.
                </p>
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-sm font-medium text-neutral-600 hover:text-neutral-800 px-4 py-2 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      startTransition(() => deleteUserAction(member.id));
                      setConfirmDelete(false);
                    }}
                    disabled={isPending}
                    className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  >
                    Delete Permanently
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
      {showResetPassword && (
        <tr>
          <td colSpan={6} className="p-0">
            <ResetPasswordModal member={member} onClose={() => setShowResetPassword(false)} />
          </td>
        </tr>
      )}
    </>
  );
}

function ResetPasswordModal({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    if (password.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    startTransition(async () => {
      const result = await resetPasswordAction(member.id, password);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      setError(null);
      setDone(true);
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-sm p-6">
        {done ? (
          <>
            <h2 className="text-sm font-semibold text-neutral-900 mb-2">Password reset</h2>
            <p className="text-sm text-neutral-600 mb-6">
              <span className="text-neutral-800 font-medium">{member.name || member.email}</span>&apos;s password has
              been changed. Share the new password with them directly so they can log in — it won&apos;t be shown
              again here.
            </p>
            <div className="flex items-center justify-end">
              <button
                onClick={onClose}
                className="bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-sm font-semibold text-neutral-900 mb-2">Reset password</h2>
            <p className="text-sm text-neutral-600 mb-4">
              Set a new password for{" "}
              <span className="text-neutral-800 font-medium">{member.name || member.email}</span>. They&apos;ll need
              to use this new password next time they log in.
            </p>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password (min. 8 characters)"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-500/50"
            />
            {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={onClose}
                className="text-sm font-medium text-neutral-600 hover:text-neutral-800 px-4 py-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isPending}
                className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {isPending ? "Saving…" : "Set New Password"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
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
