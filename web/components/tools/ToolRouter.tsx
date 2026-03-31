"use client";

import { ToolFileRead } from "./ToolFileRead";
import { ToolFileWrite } from "./ToolFileWrite";
import { ToolFileEdit } from "./ToolFileEdit";
import { ToolBash } from "./ToolBash";
import { ToolGlob } from "./ToolGlob";
import { ToolGrep } from "./ToolGrep";
import { ToolWebFetch } from "./ToolWebFetch";
import { ToolWebSearch } from "./ToolWebSearch";
import { ToolNotebookEdit } from "./ToolNotebookEdit";
import { ToolGeneric } from "./ToolGeneric";

export interface ToolRendererProps {
  toolName: string;
  toolUseId: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  isRunning?: boolean;
  startedAt?: number;
  completedAt?: number;
}

// Normalize tool name to a canonical key
function normalizeToolName(name: string): string {
  return name.toLowerCase().replace(/[_\s-]/g, "");
}

export function ToolRouter({
  toolName,
  toolUseId: _toolUseId,
  input,
  result,
  isError,
  isRunning,
  startedAt,
  completedAt,
}: ToolRendererProps) {
  const key = normalizeToolName(toolName);
  const shared = { result, isError, isRunning, startedAt, completedAt };

  switch (key) {
    case "read":
    case "fileread":
    case "readfile":
      return (
        <ToolFileRead
          input={input as Parameters<typeof ToolFileRead>[0]["input"]}
          {...shared}
        />
      );

    case "write":
    case "filewrite":
    case "writefile":
      return (
        <ToolFileWrite
          input={input as Parameters<typeof ToolFileWrite>[0]["input"]}
          {...shared}
        />
      );

    case "edit":
    case "fileedit":
    case "editfile":
      return (
        <ToolFileEdit
          input={input as Parameters<typeof ToolFileEdit>[0]["input"]}
          {...shared}
        />
      );

    case "bash":
    case "shell":
    case "runcmd":
    case "runterminalcmd":
      return (
        <ToolBash
          input={input as Parameters<typeof ToolBash>[0]["input"]}
          {...shared}
        />
      );

    case "glob":
    case "filesearch":
      return (
        <ToolGlob
          input={input as Parameters<typeof ToolGlob>[0]["input"]}
          {...shared}
        />
      );

    case "grep":
    case "search":
      return (
        <ToolGrep
          input={input as Parameters<typeof ToolGrep>[0]["input"]}
          {...shared}
        />
      );

    case "webfetch":
    case "fetch":
    case "httprequest":
      return (
        <ToolWebFetch
          input={input as Parameters<typeof ToolWebFetch>[0]["input"]}
          {...shared}
        />
      );

    case "websearch":
    case "browsersearch":
      return (
        <ToolWebSearch
          input={input as Parameters<typeof ToolWebSearch>[0]["input"]}
          {...shared}
        />
      );

    case "notebookedit":
    case "editnotebook":
    case "jupyteredit":
      return (
        <ToolNotebookEdit
          input={input as Parameters<typeof ToolNotebookEdit>[0]["input"]}
          {...shared}
        />
      );

    default:
      return <ToolGeneric toolName={toolName} input={input} {...shared} />;
  }
}
