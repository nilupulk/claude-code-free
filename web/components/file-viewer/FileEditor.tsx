"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Save, AlertCircle } from "lucide-react";
import { useFileViewerStore, type FileTab } from "@/lib/fileViewerStore";
import { cn } from "@/lib/utils";

interface FileEditorProps {
  tab: FileTab;
}

// CodeMirror is loaded dynamically to avoid SSR issues
// Types for the dynamically loaded modules
interface EditorViewType {
  state: { doc: { toString(): string; length: number } };
  dispatch: (tr: unknown) => void;
  destroy: () => void;
}

export function FileEditor({ tab }: FileEditorProps) {
  const { updateContent, markSaved } = useFileViewerStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorViewType | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editorReady, setEditorReady] = useState(false);

  const handleSave = useCallback(async () => {
    if (!viewRef.current) return;
    const content = viewRef.current.state.doc.toString();
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/files/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: tab.path, content }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      markSaved(tab.id);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  }, [tab.path, tab.id, markSaved]);

  // Initialize CodeMirror
  useEffect(() => {
    if (!containerRef.current) return;

    let view: EditorViewType | null = null;
    let cancelled = false;

    // Dynamic import to avoid SSR
    Promise.all([
      import("codemirror").then((m) => ({ basicSetup: m.basicSetup, EditorView: m.EditorView })),
      import("@codemirror/state").then((m) => ({ EditorState: m.EditorState })),
      import("@codemirror/view").then((m) => ({ keymap: m.keymap, EditorView: m.EditorView })),
      import("@codemirror/commands").then((m) => ({ defaultKeymap: m.defaultKeymap, historyKeymap: m.historyKeymap })),
      import("@codemirror/theme-one-dark").then((m) => ({ oneDark: m.oneDark })),
      getLangExtension(tab.language),
    ]).then(([cm, state, view_, cmds, theme, lang]) => {
      if (cancelled || !containerRef.current) return;

      const { basicSetup, EditorView } = cm;
      const { EditorState } = state;
      const { keymap } = view_;
      const { oneDark } = theme;

      view = new EditorView({
        state: EditorState.create({
          doc: tab.content,
          extensions: [
            basicSetup,
            oneDark,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...(lang ? [lang as any] : []),
            EditorView.updateListener.of((update: { docChanged: boolean; state: { doc: { toString(): string } } }) => {
              if (update.docChanged) {
                updateContent(tab.id, update.state.doc.toString());
              }
            }),
            keymap.of([
              {
                key: "Mod-s",
                run: () => {
                  handleSave();
                  return true;
                },
              },
            ]),
            EditorView.theme({
              "&": { height: "100%" },
              ".cm-scroller": { overflow: "auto", fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" },
              ".cm-editor": { height: "100%" },
            }),
          ],
        }),
        parent: containerRef.current,
      }) as unknown as EditorViewType;

      viewRef.current = view;
      setEditorReady(true);
    });

    return () => {
      cancelled = true;
      if (view) {
        (view as EditorViewType).destroy();
        viewRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.id, tab.language]);

  // Sync external content changes (e.g., from diff apply)
  useEffect(() => {
    if (!viewRef.current || !editorReady) return;
    const currentDoc = viewRef.current.state.doc.toString();
    if (currentDoc !== tab.content) {
      viewRef.current.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: tab.content },
      });
    }
  }, [tab.content, editorReady]);

  return (
    <div className="flex flex-col h-full">
      {/* Editor save bar */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-surface-800 bg-surface-900/50">
        <div className="flex items-center gap-2">
          {tab.isDirty && (
            <span className="text-xs text-yellow-500/70">Unsaved changes</span>
          )}
          {saveError && (
            <span className="text-xs text-red-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {saveError}
            </span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving || !tab.isDirty}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors",
            tab.isDirty
              ? "bg-brand-600 hover:bg-brand-700 text-white"
              : "bg-surface-800 text-surface-500 cursor-not-allowed"
          )}
          title="Save (Ctrl+S / Cmd+S)"
        >
          <Save className="w-3 h-3" />
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>

      {/* Editor container */}
      <div className="flex-1 overflow-hidden relative">
        {!editorReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#282c34] text-white/20 text-xs animate-pulse">
            Loading editor...
          </div>
        )}
        <div
          ref={containerRef}
          className="h-full"
          style={{ opacity: editorReady ? 1 : 0 }}
        />
      </div>
    </div>
  );
}

// Load language extension based on language string
async function getLangExtension(language: string): Promise<unknown> {
  try {
    switch (language) {
      case "typescript":
      case "tsx": {
        const { javascript } = await import("@codemirror/lang-javascript");
        return javascript({ typescript: true, jsx: language === "tsx" });
      }
      case "javascript":
      case "jsx": {
        const { javascript } = await import("@codemirror/lang-javascript");
        return javascript({ jsx: language === "jsx" });
      }
      case "python": {
        const { python } = await import("@codemirror/lang-python");
        return python();
      }
      case "rust": {
        const { rust } = await import("@codemirror/lang-rust");
        return rust();
      }
      case "go": {
        const { go } = await import("@codemirror/lang-go");
        return go();
      }
      case "css":
      case "scss": {
        const { css } = await import("@codemirror/lang-css");
        return css();
      }
      case "html": {
        const { html } = await import("@codemirror/lang-html");
        return html();
      }
      case "json": {
        const { json } = await import("@codemirror/lang-json");
        return json();
      }
      case "markdown": {
        const { markdown } = await import("@codemirror/lang-markdown");
        return markdown();
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}
