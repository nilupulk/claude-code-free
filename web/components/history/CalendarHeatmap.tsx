"use client";

import { useMemo } from "react";
import type { Conversation } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CalendarHeatmapProps {
  conversations: Conversation[];
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getIntensity(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

const INTENSITY_CLASSES = [
  "bg-surface-800",
  "bg-green-900",
  "bg-green-700",
  "bg-green-600",
  "bg-green-500",
] as const;

export function CalendarHeatmap({ conversations }: CalendarHeatmapProps) {
  const { weeks, monthLabels, maxCount } = useMemo(() => {
    // Build a map of date string → count
    const counts = new Map<string, number>();
    for (const conv of conversations) {
      const d = new Date(conv.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    // Build grid: 53 columns (weeks) × 7 rows (days)
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Start from 52 weeks ago (Sunday)
    const start = new Date(today);
    start.setDate(start.getDate() - 364);
    // Align to previous Sunday
    start.setDate(start.getDate() - start.getDay());

    const grid: Array<Array<{ date: Date; count: number }>> = [];
    let cur = new Date(start);
    let maxCount = 0;

    while (cur <= today) {
      const week: Array<{ date: Date; count: number }> = [];
      for (let d = 0; d < 7; d++) {
        const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
        const count = counts.get(key) ?? 0;
        if (count > maxCount) maxCount = count;
        week.push({ date: new Date(cur), count });
        cur.setDate(cur.getDate() + 1);
      }
      grid.push(week);
    }

    // Compute month label positions
    const monthLabels: Array<{ label: string; col: number }> = [];
    let lastMonth = -1;
    grid.forEach((week, col) => {
      const month = week[0].date.getMonth();
      if (month !== lastMonth) {
        monthLabels.push({ label: MONTHS[month], col });
        lastMonth = month;
      }
    });

    return { weeks: grid, monthLabels, maxCount };
  }, [conversations]);

  const cellSize = 11;
  const gap = 2;
  const dayLabelWidth = 24;
  const monthLabelHeight = 16;
  const totalCols = weeks.length;
  const width = dayLabelWidth + totalCols * (cellSize + gap);
  const height = monthLabelHeight + 7 * (cellSize + gap);

  return (
    <div className="overflow-x-auto">
      <svg
        width={width}
        height={height}
        className="font-sans text-[10px] fill-current"
        aria-label="Conversation activity heatmap"
      >
        {/* Month labels */}
        {monthLabels.map(({ label, col }) => (
          <text
            key={`month-${col}`}
            x={dayLabelWidth + col * (cellSize + gap)}
            y={monthLabelHeight - 2}
            className="fill-surface-500"
            fontSize={10}
          >
            {label}
          </text>
        ))}

        {/* Day labels */}
        {[1, 3, 5].map((dayIdx) => (
          <text
            key={`day-${dayIdx}`}
            x={0}
            y={monthLabelHeight + dayIdx * (cellSize + gap) + cellSize - 1}
            className="fill-surface-500"
            fontSize={10}
          >
            {DAYS[dayIdx].slice(0, 1)}
          </text>
        ))}

        {/* Cells */}
        {weeks.map((week, col) =>
          week.map((cell, row) => {
            const intensity = getIntensity(cell.count);
            const x = dayLabelWidth + col * (cellSize + gap);
            const y = monthLabelHeight + row * (cellSize + gap);
            return (
              <rect
                key={`${col}-${row}`}
                x={x}
                y={y}
                width={cellSize}
                height={cellSize}
                rx={2}
                className={cn(INTENSITY_CLASSES[intensity], "transition-colors")}
                data-date={cell.date.toDateString()}
                data-count={cell.count}
              >
                <title>
                  {cell.count} conversation{cell.count !== 1 ? "s" : ""} on{" "}
                  {cell.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </title>
              </rect>
            );
          })
        )}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-2 justify-end">
        <span className="text-xs text-surface-500">Less</span>
        {([0, 1, 2, 3, 4] as const).map((i) => (
          <div
            key={i}
            className={cn("w-2.5 h-2.5 rounded-sm", INTENSITY_CLASSES[i])}
          />
        ))}
        <span className="text-xs text-surface-500">More</span>
      </div>
    </div>
  );
}
