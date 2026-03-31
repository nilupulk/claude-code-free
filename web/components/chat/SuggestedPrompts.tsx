"use client";

import {
  Code2,
  FileSearch,
  GitBranch,
  Lightbulb,
  RefreshCw,
  Search,
} from "lucide-react";

interface Prompt {
  icon: React.ElementType;
  title: string;
  text: string;
}

const PROMPTS: Prompt[] = [
  {
    icon: Code2,
    title: "Write code",
    text: "Write a TypeScript function that ",
  },
  {
    icon: Search,
    title: "Review code",
    text: "Review this code for bugs and improvements:\n\n",
  },
  {
    icon: FileSearch,
    title: "Explain code",
    text: "Explain how this code works:\n\n",
  },
  {
    icon: GitBranch,
    title: "Debug issue",
    text: "Help me debug this error:\n\n",
  },
  {
    icon: RefreshCw,
    title: "Refactor",
    text: "Refactor this code to be more readable:\n\n",
  },
  {
    icon: Lightbulb,
    title: "Brainstorm",
    text: "Brainstorm approaches for ",
  },
];

interface SuggestedPromptsProps {
  onSelect: (text: string) => void;
}

export function SuggestedPrompts({ onSelect }: SuggestedPromptsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 max-w-lg w-full mt-6">
      {PROMPTS.map((p) => {
        const Icon = p.icon;
        return (
          <button
            key={p.title}
            onClick={() => onSelect(p.text)}
            className="flex items-start gap-2.5 p-3 rounded-xl bg-surface-800 hover:bg-surface-700 border border-surface-700 hover:border-surface-600 text-left transition-colors group"
          >
            <Icon
              className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5 group-hover:text-brand-300 transition-colors"
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-xs font-medium text-surface-200">{p.title}</p>
              <p className="text-xs text-surface-500 mt-0.5 truncate">{p.text}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
