"use client";

import { useMemo } from "react";
import { MessageSquare, Hash, Zap, TrendingUp } from "lucide-react";
import type { Conversation } from "@/lib/types";

interface HistoryStatsProps {
  conversations: Conversation[];
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function HistoryStats({ conversations }: HistoryStatsProps) {
  const stats = useMemo(() => {
    const totalConversations = conversations.length;
    const totalMessages = conversations.reduce((s, c) => s + c.messages.length, 0);
    const avgLength = totalConversations > 0
      ? Math.round(totalMessages / totalConversations)
      : 0;

    // Token usage
    const totalTokens = conversations.reduce((s, c) =>
      s + c.messages.reduce((ms, m) =>
        ms + (m.usage?.input_tokens ?? 0) + (m.usage?.output_tokens ?? 0), 0), 0);

    // Most active day of week
    const dayBuckets = Array(7).fill(0) as number[];
    for (const conv of conversations) {
      dayBuckets[new Date(conv.createdAt).getDay()]++;
    }
    const mostActiveDay = dayBuckets.indexOf(Math.max(...dayBuckets));

    // Most used model
    const modelCounts: Record<string, number> = {};
    for (const conv of conversations) {
      if (conv.model) modelCounts[conv.model] = (modelCounts[conv.model] ?? 0) + 1;
    }
    const topModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

    // Conversation streak (consecutive days up to today)
    const daySet = new Set<string>();
    for (const conv of conversations) {
      const d = new Date(conv.createdAt);
      daySet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
    let streak = 0;
    const cur = new Date();
    while (true) {
      const key = `${cur.getFullYear()}-${cur.getMonth()}-${cur.getDate()}`;
      if (!daySet.has(key)) break;
      streak++;
      cur.setDate(cur.getDate() - 1);
    }

    return { totalConversations, totalMessages, avgLength, totalTokens, mostActiveDay, topModel, streak };
  }, [conversations]);

  const statCards = [
    {
      icon: MessageSquare,
      label: "Conversations",
      value: stats.totalConversations.toLocaleString(),
      sub: `${stats.totalMessages.toLocaleString()} messages total`,
    },
    {
      icon: Hash,
      label: "Avg length",
      value: stats.avgLength,
      sub: "messages per conversation",
    },
    {
      icon: Zap,
      label: "Tokens used",
      value: stats.totalTokens > 1_000_000
        ? `${(stats.totalTokens / 1_000_000).toFixed(1)}M`
        : stats.totalTokens > 1_000
        ? `${(stats.totalTokens / 1_000).toFixed(0)}K`
        : stats.totalTokens,
      sub: "across all conversations",
    },
    {
      icon: TrendingUp,
      label: "Current streak",
      value: `${stats.streak}d`,
      sub: stats.streak > 0 ? `Active ${DAYS[stats.mostActiveDay]}s` : "No streak yet",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {statCards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="bg-surface-800/50 rounded-lg p-3 border border-surface-700/50"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Icon className="w-3.5 h-3.5 text-surface-400" />
              <span className="text-xs text-surface-400 font-medium">{card.label}</span>
            </div>
            <p className="text-xl font-semibold text-surface-100">{card.value}</p>
            <p className="text-xs text-surface-500 mt-0.5">{card.sub}</p>
          </div>
        );
      })}

      {/* Most used model */}
      {stats.topModel && (
        <div className="col-span-2 bg-surface-800/50 rounded-lg p-3 border border-surface-700/50">
          <span className="text-xs text-surface-400 font-medium block mb-1">Favourite model</span>
          <p className="text-sm font-medium text-surface-200">{stats.topModel}</p>
        </div>
      )}
    </div>
  );
}
