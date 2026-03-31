"use client";

import { X } from "lucide-react";
import type { SearchFilters as Filters } from "@/lib/types";
import { useChatStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { DateRangePicker } from "./DateRangePicker";

interface SearchFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

const TAG_COLOR_CLASSES: Record<string, string> = {
  blue: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  green: "bg-green-500/20 text-green-400 border-green-500/30",
  red: "bg-red-500/20 text-red-400 border-red-500/30",
  yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  purple: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  pink: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  orange: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  teal: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  cyan: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  indigo: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
};

export function SearchFilters({ filters, onChange }: SearchFiltersProps) {
  const { conversations, tags } = useChatStore();

  const models = [...new Set(conversations.map((c) => c.model).filter(Boolean))] as string[];

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    onChange({ ...filters, [key]: value || undefined });
  };

  const toggleTag = (tagId: string) => {
    const current = filters.tagIds ?? [];
    onChange({
      ...filters,
      tagIds: current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId],
    });
  };

  const activeCount = [
    filters.dateFrom || filters.dateTo,
    filters.role,
    filters.conversationId,
    filters.contentType,
    filters.model,
    filters.tagIds?.length,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-surface-800">
      {/* Date range */}
      <DateRangePicker
        from={filters.dateFrom}
        to={filters.dateTo}
        onChange={(from, to) => onChange({ ...filters, dateFrom: from, dateTo: to })}
      />

      {/* Role */}
      <select
        value={filters.role ?? ""}
        onChange={(e) => update("role", e.target.value as Filters["role"])}
        className={cn(
          "text-xs bg-surface-800 border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors",
          filters.role
            ? "border-brand-500 text-brand-400"
            : "border-surface-700 text-surface-400"
        )}
      >
        <option value="">All roles</option>
        <option value="user">User</option>
        <option value="assistant">Assistant</option>
      </select>

      {/* Content type */}
      <select
        value={filters.contentType ?? ""}
        onChange={(e) => update("contentType", e.target.value as Filters["contentType"])}
        className={cn(
          "text-xs bg-surface-800 border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors",
          filters.contentType
            ? "border-brand-500 text-brand-400"
            : "border-surface-700 text-surface-400"
        )}
      >
        <option value="">All content</option>
        <option value="text">Text</option>
        <option value="code">Code</option>
        <option value="tool_use">Tool use</option>
        <option value="file">Files</option>
      </select>

      {/* Model */}
      {models.length > 0 && (
        <select
          value={filters.model ?? ""}
          onChange={(e) => update("model", e.target.value)}
          className={cn(
            "text-xs bg-surface-800 border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors",
            filters.model
              ? "border-brand-500 text-brand-400"
              : "border-surface-700 text-surface-400"
          )}
        >
          <option value="">All models</option>
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => {
            const active = filters.tagIds?.includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                className={cn(
                  "px-2 py-0.5 rounded-full text-xs border transition-colors",
                  active
                    ? TAG_COLOR_CLASSES[tag.color] ?? TAG_COLOR_CLASSES.blue
                    : "border-surface-700 text-surface-500 hover:text-surface-300"
                )}
              >
                {tag.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Clear all */}
      {activeCount > 0 && (
        <button
          onClick={() => onChange({})}
          className="flex items-center gap-1 text-xs text-surface-500 hover:text-red-400 transition-colors ml-auto"
        >
          <X className="w-3 h-3" />
          Clear filters ({activeCount})
        </button>
      )}
    </div>
  );
}
