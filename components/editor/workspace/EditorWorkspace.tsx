"use client";

import dynamic from "next/dynamic";
import type { editor } from "monaco-editor";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setCreatingFile } from "@/store/slices/uiSlice";
import { detectFileType, fileTypeLabel } from "@/lib/fileMeta";
import { EditorTabs } from "./EditorTabs";

const MonacoEditor = dynamic(
  () => import("./MonacoEditor").then((mod) => mod.MonacoEditor),
  { ssr: false },
);

interface EditorWorkspaceProps {
  projectId: string;
  canEdit: boolean;
  pendingLine: number | null;
  onLineHandled: () => void;
  onEditorMount: (editor: editor.IStandaloneCodeEditor) => void;
  onFindInFile: () => void;
  saveNowToken: number;
}

export function EditorWorkspace({
  projectId,
  canEdit,
  pendingLine,
  onLineHandled,
  onEditorMount,
  onFindInFile,
  saveNowToken,
}: EditorWorkspaceProps) {
  const dispatch = useAppDispatch();
  const activeFileId = useAppSelector((state) => state.editor.activeFileId);
  const cursor = useAppSelector((state) => state.editor.cursor);
  const openTabs = useAppSelector((state) => state.editor.openTabs);
  const saveState = useAppSelector((state) => state.editor.saveState);
  const settings = useAppSelector((state) => state.settings);

  const activePath = openTabs.find((tab) => tab.fileId === activeFileId)?.path;
  const langLabel = activePath ? fileTypeLabel(detectFileType(activePath)) : null;

  return (
    <section className="flex min-w-85 flex-1 flex-col bg-bg-editor">
      <EditorTabs onFindInFile={onFindInFile} />

      {activeFileId ? (
        <MonacoEditor
          key={activeFileId}
          projectId={projectId}
          fileId={activeFileId}
          canEdit={canEdit}
          pendingLine={pendingLine}
          onLineHandled={onLineHandled}
          onEditorMount={onEditorMount}
          saveNowToken={saveNowToken}
        />
      ) : (
        <div className="grid flex-1 place-items-center bg-bg-editor">
          <div className="text-center">
            <div className="text-body font-medium text-syntax-plain">No file open</div>
            <div className="mt-1.75 text-ui text-text-muted">
              Select a file from the explorer or create a new one.
            </div>
            {canEdit && (
              <button
                onClick={() => dispatch(setCreatingFile({ parentId: null, isDirectory: false }))}
                className="mt-4.5 rounded-sm border border-border-strong bg-[#17191D] px-3.25 py-1.5 text-ui text-text-primary hover:border-[#3A3D44]"
              >
                + New file
                <span className="ml-2 font-mono text-[10px] text-text-muted">⌘N</span>
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex h-6 flex-none items-center gap-4 border-t border-border-subtle bg-bg-panel px-3 font-mono text-meta text-text-muted">
        <span>
          Ln {cursor.line}, Col {cursor.column}
        </span>
        {langLabel && <span>{langLabel}</span>}
        <span>Spaces: {settings.tabSize}</span>
        <span>UTF-8</span>
        <div className="flex-1" />
        <span
          style={{
            color:
              saveState === "saving"
                ? "var(--color-warn)"
                : saveState === "error"
                  ? "var(--color-danger)"
                  : "var(--color-ok)",
          }}
        >
          {saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed" : "Saved"}
        </span>
      </div>
    </section>
  );
}
