"use client";

import { useMemo, useState, useTransition } from "react";
import { UserCheck, ShieldOff, RefreshCcw, Trash2, KeyRound, UserPlus, Search, ArrowUpDown } from "lucide-react";
import {
  approveUserAction,
  createUserAction,
  updateMemberAction,
  revokeUserAction,
  reactivateUserAction,
  deleteUserAction,
  resetPasswordAction,
  type TeamMember,
} from "@/lib/user-actions";
import type { Role } from "@/lib/current-user";
import { BRANCHES, type BranchSelection } from "@/lib/branch";
import { formatDate } from "@/lib/format";

const ROLES: Role[] = ["Branch PIC", "Management"];

export default function TeamClient({ members, currentUserId }: { members: TeamMember[]; currentUserId: string }) {
  const pending = members.filter((m) => m.status === "pending");
  const others = members.filter((m) => m.status !== "pending");
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const visibleOthers = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? others.filter((m) => (m.name ?? "").toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
      : others;
    return [...filtered].sort((a, b) =>
      sortDir === "desc" ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt)
    );
  }, [others, query, sortDir]);

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex justify-end">
        <button
          onClick={() => setAddUserOpen(true)}
          className="flex items-center gap-1.5 bg-red-500 hover:bg-red-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <UserPlus size={15} /> Add User
        </button>
      </div>

      {addUserOpen && <AddUserModal onClose={() => setAddUserOpen(false)} />}

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
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <p className="text-sm font-medium text-neutral-800">Team members ({visibleOthers.length})</p>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or email…"
                className="bg-white border border-neutral-200 rounded-lg pl-8 pr-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 w-56"
              />
            </div>
            <button
              onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
              className="flex items-center gap-1.5 bg-white border border-neutral-200 hover:border-red-300 text-neutral-700 text-sm font-medium px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
              title="Sort by date joined"
            >
              <ArrowUpDown size={14} /> {sortDir === "desc" ? "Newest" : "Oldest"}
            </button>
          </div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Name / Email</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Access Level</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap text-center">Branch</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap text-center">Status</th>
                  <th className="font-medium px-5 py-3 whitespace-nowrap">Joined</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {visibleOthers.map((m) => (
                  <MemberRow key={m.id} member={m} isSelf={m.id === currentUserId} />
                ))}
                {visibleOthers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-neutral-500 text-sm">
                      {others.length === 0 ? "No approved team members yet." : "No members match your search."}
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
  const [role, setRole] = useState<Role>("Branch PIC");
  const [title, setTitle] = useState("");
  const [branch, setBranch] = useState<BranchSelection>(member.homeBranch === "all" ? "kapar" : member.homeBranch);
  const [isPending, startTransition] = useTransition();

  function approve() {
    startTransition(() => approveUserAction(member.id, role, branch, title.trim() || null));
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
        value={role}
        onChange={(e) => setRole(e.target.value as Role)}
        className="bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional, e.g. HR)"
        className="bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 w-36"
      />
      <select
        value={branch}
        onChange={(e) => setBranch(e.target.value as BranchSelection)}
        className="bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
      >
        {BRANCHES.map((b) => (
          <option key={b.value} value={b.value}>
            {b.label}
          </option>
        ))}
        <option value="all">All Branches</option>
      </select>
      <button
        onClick={approve}
        disabled={isPending}
        className="flex items-center justify-center gap-1.5 bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
      >
        <UserCheck size={15} /> Approve
      </button>
    </div>
  );
}

function MemberRow({ member, isSelf }: { member: TeamMember; isSelf: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [role, setRole] = useState<Role>(member.role ?? "Branch PIC");
  const [title, setTitle] = useState(member.positionTitle ?? "");

  function saveRole(nextRole: Role) {
    setRole(nextRole);
    startTransition(() => updateMemberAction(member.id, nextRole, member.homeBranch, title.trim() || null));
  }

  function saveTitle() {
    startTransition(() => updateMemberAction(member.id, role, member.homeBranch, title.trim() || null));
  }

  function updateBranch(branch: BranchSelection) {
    startTransition(() => updateMemberAction(member.id, role, branch, title.trim() || null));
  }

  return (
    <>
      <tr className="border-b border-neutral-100 last:border-0">
        <td className="px-5 py-3.5 text-neutral-800 font-medium whitespace-nowrap">
          {member.name || member.email} {isSelf && <span className="text-neutral-500 font-normal">(you)</span>}
        </td>
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            <select
              value={role}
              disabled={isSelf || isPending || member.status === "revoked"}
              onChange={(e) => saveRole(e.target.value as Role)}
              className="bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 disabled:opacity-50"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              placeholder="Title (optional)"
              disabled={isPending || member.status === "revoked"}
              className="bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 disabled:opacity-50 w-56"
            />
          </div>
        </td>
        <td className="px-5 py-3.5 text-center">
          <select
            value={member.homeBranch}
            disabled={isPending || member.status === "revoked"}
            onChange={(e) => updateBranch(e.target.value as BranchSelection)}
            className="bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50 disabled:opacity-50"
          >
            {BRANCHES.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
            <option value="all">All Branches</option>
          </select>
        </td>
        <td className="px-5 py-3.5 text-center">
          <span
            className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
              member.status === "approved"
                ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                : "bg-red-500/10 text-red-700 border-red-500/20"
            }`}
          >
            {member.status === "approved" ? "Active" : "Deactivated"}
          </span>
        </td>
        <td className="px-5 py-3.5 text-neutral-500 whitespace-nowrap">{formatDate(member.createdAt)}</td>
        <td className="px-5 py-3.5">
          <div className="flex items-center justify-end gap-1">
            {!isSelf && member.status === "approved" && (
              <button
                onClick={() => setShowResetPassword(true)}
                disabled={isPending}
                title="Reset Password"
                aria-label="Reset Password"
                className="text-neutral-400 hover:text-red-700 disabled:opacity-50 transition-colors p-1.5"
              >
                <KeyRound size={15} />
              </button>
            )}
            {!isSelf && member.status === "approved" && (
              <button
                onClick={() => startTransition(() => revokeUserAction(member.id))}
                disabled={isPending}
                title="Deactivate"
                aria-label="Deactivate"
                className="text-neutral-400 hover:text-red-700 disabled:opacity-50 transition-colors p-1.5"
              >
                <ShieldOff size={15} />
              </button>
            )}
            {!isSelf && member.status === "revoked" && (
              <button
                onClick={() => startTransition(() => reactivateUserAction(member.id))}
                disabled={isPending}
                title="Activate"
                aria-label="Activate"
                className="text-neutral-400 hover:text-emerald-700 disabled:opacity-50 transition-colors p-1.5"
              >
                <RefreshCcw size={15} />
              </button>
            )}
            {!isSelf && (
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={isPending}
                title="Delete"
                aria-label="Delete"
                className="text-neutral-400 hover:text-red-700 disabled:opacity-50 transition-colors p-1.5"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </td>
      </tr>
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
                className="bg-red-500 hover:bg-red-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
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
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
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
                className="bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
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

function AddUserModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("Branch PIC");
  const [title, setTitle] = useState("");
  const [branch, setBranch] = useState<BranchSelection>("kapar");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canSave = email.trim() !== "" && password.length >= 8 && name.trim() !== "";

  function handleSave() {
    if (!canSave) return;
    startTransition(async () => {
      const result = await createUserAction(email, password, name, role, branch, title.trim() || null);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-sm p-6">
        <h2 className="text-sm font-semibold text-neutral-900 mb-1">Add User</h2>
        <p className="text-xs text-neutral-500 mb-4">Creates a login that&apos;s already active — no approval needed, they can sign in right away.</p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Password</label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Access Level</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Title (optional)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. HR"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Branch</label>
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value as BranchSelection)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-red-500/50"
            >
              {BRANCHES.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
              <option value="all">All Branches</option>
            </select>
          </div>
        </div>
        {error && <p className="text-sm text-red-700 mt-3">{error}</p>}
        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="text-sm font-medium text-neutral-600 hover:text-neutral-800 px-4 py-2 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || isPending}
            className="bg-red-500 hover:bg-red-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {isPending ? "Creating…" : "Create User"}
          </button>
        </div>
      </div>
    </div>
  );
}
