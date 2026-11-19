"use client";

import { useEffect, useMemo, useRef } from "react";
import { Camera, RefreshCw } from "lucide-react";
import { BRANCHES, type Branch } from "@/lib/branch";

// Shared parts for the phone upload page, so the jobsheet and GenBlu
// screens look and behave the same.

export const primaryButton =
  "w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-medium transition-colors bg-red-600 hover:bg-red-700 text-white disabled:bg-neutral-200 disabled:text-neutral-500 disabled:cursor-not-allowed";

// Big photo button; once a picture is picked it shows a small preview and a
// "Change" button instead.
export function PhotoPicker({
  file,
  onChange,
  label = "Take photo of screenshot",
  hint,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  label?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // A temporary on-page address for the picked photo, freed when it changes.
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {file && preview ? (
        <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Picked screenshot" className="h-16 w-12 rounded-md object-cover bg-white border border-neutral-200" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-neutral-900 truncate">{file.name}</p>
            <p className="text-xs text-neutral-500">Screenshot ready</p>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            <RefreshCw size={14} aria-hidden="true" /> Change
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 px-4 py-7 text-center hover:bg-neutral-50 transition-colors"
        >
          <span className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-base font-medium text-white">
            <Camera size={18} aria-hidden="true" /> {label}
          </span>
          {hint && <span className="text-sm text-neutral-500">{hint}</span>}
        </button>
      )}
    </div>
  );
}

// A yes/no as one on/off switch.
export function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="w-full flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-3 text-sm text-neutral-800"
    >
      {label}
      <span className={`relative w-10 h-6 rounded-full transition-colors ${on ? "bg-red-600" : "bg-neutral-200"}`}>
        <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${on ? "translate-x-4" : ""}`} />
      </span>
    </button>
  );
}

// Branch as three tap buttons; shown as plain text when the person is
// locked to their own branch.
export function BranchPicker({ value, onChange, locked }: { value: Branch; onChange: (b: Branch) => void; locked: boolean }) {
  if (locked) {
    return (
      <p className="text-sm text-neutral-600">
        Branch: <span className="text-neutral-900">{BRANCHES.find((b) => b.value === value)?.label}</span>
      </p>
    );
  }
  return (
    <div>
      <p className="text-xs font-medium text-neutral-600 mb-1.5">Branch</p>
      <div className="flex flex-wrap gap-2">
        {BRANCHES.map((b) => (
          <button
            key={b.value}
            type="button"
            onClick={() => onChange(b.value)}
            aria-pressed={value === b.value}
            className={`px-3.5 py-2 rounded-lg border text-sm transition-colors ${
              value === b.value ? "border-red-600 bg-red-50 text-red-800 font-medium" : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
