"use client";

import { useState } from "react";
import { Calendar, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
  from?: number;
  to?: number;
  onChange: (from?: number, to?: number) => void;
}

const PRESETS = [
  { label: "Today", days: 0 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "Last year", days: 365 },
];

function toDateString(ts?: number): string {
  if (!ts) return "";
  return new Date(ts).toISOString().slice(0, 10);
}

function fromDateString(s: string): number | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d.getTime();
}

export function DateRangePicker({ from, to, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  const applyPreset = (days: number) => {
    if (days === 0) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      onChange(start.getTime(), Date.now());
    } else {
      onChange(Date.now() - days * 86_400_000, Date.now());
    }
    setOpen(false);
  };

  const clearRange = () => {
    onChange(undefined, undefined);
    setOpen(false);
  };

  const hasRange = from !== undefined || to !== undefined;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border transition-colors",
          hasRange
            ? "border-brand-500 text-brand-400 bg-brand-500/10"
            : "border-surface-700 text-surface-400 hover:text-surface-200 hover:border-surface-600 bg-surface-800"
        )}
      >
        <Calendar className="w-3.5 h-3.5" />
        {hasRange ? (
          <span>
            {from ? toDateString(from) : "…"} → {to ? toDateString(to) : "now"}
          </span>
        ) : (
          <span>Date range</span>
        )}
        {hasRange && (
          <X
            className="w-3 h-3 ml-0.5 hover:text-red-400"
            onClick={(e) => {
              e.stopPropagation();
              clearRange();
            }}
          />
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-surface-900 border border-surface-700 rounded-lg shadow-xl p-3 w-72">
          {/* Presets */}
          <div className="mb-3">
            <p className="text-xs text-surface-500 mb-1.5 font-medium uppercase tracking-wide">
              Quick select
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p.days)}
                  className="px-2 py-1 rounded text-xs bg-surface-800 text-surface-300 hover:bg-surface-700 hover:text-surface-100 transition-colors border border-surface-700"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom range */}
          <div>
            <p className="text-xs text-surface-500 mb-1.5 font-medium uppercase tracking-wide">
              Custom range
            </p>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <label className="text-xs text-surface-400 w-8">From</label>
                <input
                  type="date"
                  value={toDateString(from)}
                  onChange={(e) => onChange(fromDateString(e.target.value), to)}
                  className="flex-1 text-xs bg-surface-800 border border-surface-700 rounded px-2 py-1 text-surface-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-surface-400 w-8">To</label>
                <input
                  type="date"
                  value={toDateString(to)}
                  onChange={(e) => onChange(from, fromDateString(e.target.value))}
                  className="flex-1 text-xs bg-surface-800 border border-surface-700 rounded px-2 py-1 text-surface-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={clearRange}
              className="text-xs text-surface-500 hover:text-surface-300 transition-colors"
            >
              Clear
            </button>
            <button
              onClick={() => setOpen(false)}
              className="text-xs px-2 py-1 rounded bg-brand-600 text-white hover:bg-brand-500 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}
    </div>
  );
}
