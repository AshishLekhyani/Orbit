"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { editor } from "monaco-editor";
import type { ProjectRole } from "@prisma/client";
import { StoreProvider } from "@/store/StoreProvider";
import { ToastProvider } from "@/components/shared/ToastProvider";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setExplorerWidth, toggleExplorer, setCommandPaletteOpen, setCreatingFile } from "@/store/slices/uiSlice";
import { openTab, setSearchOpen } from "@/store/slices/editorSlice";
import { TopBar } from "./TopBar";
import { Explorer } from "./explorer/Explorer";
import { EditorWorkspace } from "./workspace/EditorWorkspace";
import { CommandPalette } from "./CommandPalette";

interface EditorShellProps {
  projectId: string;
  projectName: string;
  role: ProjectRole;
}

export function EditorShell(props: EditorShellProps) {
  return (
    <StoreProvider>
      <ToastProvider>
        <EditorShellInner {...props} />
      </ToastProvider>
    </StoreProvider>
  );
}

function EditorShellInner({ projectId, projectName, role }: EditorShellProps) {
  const dispatch = useAppDispatch();
  const explorerOpen = useAppSelector((state) => state.ui.explorerOpen);
  const explorerWidth = useAppSelector((state) => state.ui.explorerWidth);
  const commandPaletteOpen = useAppSelector((state) => state.ui.commandPaletteOpen);
  const dirtyFileIds = useAppSelector((state) => state.editor.dirtyFileIds);

  const canEdit = role === "OWNER" || role === "EDITOR";

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingLine, setPendingLine] = useState<number | null>(null);
  const [saveNowToken, setSaveNowToken] = useState(0);
  const editorInstanceRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const resizeState = useRef<{ startX: number; startWidth: number } | null>(null);

  const openAtLine = useCallback(
    (fileId: string, path: string, line: number) => {
      dispatch(openTab({ fileId, path }));
      dispatch(setSearchOpen(false));
      setPendingLine(line);
    },
    [dispatch],
  );

  const triggerFindInFile = useCallback(() => {
    editorInstanceRef.current?.focus();
    editorInstanceRef.current?.getAction("actions.find")?.run();
  }, []);

  const triggerGoToLine = useCallback(() => {
    editorInstanceRef.current?.focus();
    editorInstanceRef.current?.getAction("editor.action.gotoLine")?.run();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey;

      if (meta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        dispatch(setCommandPaletteOpen(!commandPaletteOpen));
        return;
      }
      if (event.key === "Escape" && commandPaletteOpen) {
        dispatch(setCommandPaletteOpen(false));
        return;
      }
      if (meta && event.key.toLowerCase() === "n" && canEdit) {
        event.preventDefault();
        dispatch(setCreatingFile({ parentId: null, isDirectory: false }));
        return;
      }
      if (meta && event.key.toLowerCase() === "b") {
        event.preventDefault();
        dispatch(toggleExplorer());
        return;
      }
      if (meta && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        dispatch(setSearchOpen(true));
        return;
      }
      if (meta && event.key.toLowerCase() === "f") {
        event.preventDefault();
        triggerFindInFile();
        return;
      }
      if (event.ctrlKey && event.key.toLowerCase() === "g") {
        event.preventDefault();
        triggerGoToLine();
        return;
      }
      if (meta && event.key === ",") {
        event.preventDefault();
        setSettingsOpen(true);
        return;
      }
      if (meta && event.key.toLowerCase() === "s") {
        event.preventDefault();
        setSaveNowToken((token) => token + 1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dispatch, commandPaletteOpen, canEdit, triggerFindInFile, triggerGoToLine]);

  function handleResizeStart(event: React.MouseEvent) {
    resizeState.current = { startX: event.clientX, startWidth: explorerWidth };

    function handleMouseMove(moveEvent: MouseEvent) {
      if (!resizeState.current) return;
      const delta = moveEvent.clientX - resizeState.current.startX;
      const next = Math.max(180, Math.min(440, resizeState.current.startWidth + delta));
      dispatch(setExplorerWidth(next));
    }
    function handleMouseUp() {
      resizeState.current = null;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    }
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg-base">
      <TopBar
        projectName={projectName}
        settingsOpen={settingsOpen}
        onSettingsOpenChange={setSettingsOpen}
      />

      <div className="flex min-h-0 flex-1">
        {explorerOpen && (
          <>
            <aside
              style={{ width: explorerWidth }}
              className="flex flex-none flex-col border-r border-border-subtle bg-bg-panel"
            >
              <Explorer
                projectId={projectId}
                canEdit={canEdit}
                dirtyFileIds={new Set(dirtyFileIds)}
                onOpenAtLine={openAtLine}
              />
            </aside>
            <div
              onMouseDown={handleResizeStart}
              className="w-1 flex-none cursor-col-resize hover:bg-accent/35"
            />
          </>
        )}

        <EditorWorkspace
          projectId={projectId}
          canEdit={canEdit}
          pendingLine={pendingLine}
          onLineHandled={() => setPendingLine(null)}
          onEditorMount={(instance) => {
            editorInstanceRef.current = instance;
          }}
          onFindInFile={triggerFindInFile}
          saveNowToken={saveNowToken}
        />
      </div>

      <CommandPalette
        projectId={projectId}
        canEdit={canEdit}
        onGoToLine={triggerGoToLine}
        onFindInFile={triggerFindInFile}
        onOpenSettings={() => setSettingsOpen(true)}
      />
    </div>
  );
}
