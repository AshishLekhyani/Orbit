"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { editor } from "monaco-editor";
import type { ProjectRole } from "@prisma/client";
import { StoreProvider } from "@/store/StoreProvider";
import { ToastProvider, useToast } from "@/components/shared/ToastProvider";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  setExplorerWidth,
  setPreviewWidth,
  setBottomPanelHeight,
  toggleExplorer,
  togglePreview,
  toggleBottomPanel,
  setCommandPaletteOpen,
  setCreatingFile,
} from "@/store/slices/uiSlice";
import { openTab, setSearchOpen } from "@/store/slices/editorSlice";
import { setCollaborators, setConnectionState, type ConnectionState } from "@/store/slices/collaborationSlice";
import { useGetFilesQuery } from "@/store/api/filesApi";
import { createClient } from "@/lib/supabase/client";
import { ProjectPresenceChannel } from "@/lib/realtime/ProjectPresenceChannel";
import type { LocalUser } from "@/lib/realtime/SupabaseYjsProvider";
import { TopBar } from "./TopBar";
import { Explorer } from "./explorer/Explorer";
import { EditorWorkspace } from "./workspace/EditorWorkspace";
import { PreviewPanel } from "./preview/PreviewPanel";
import { BottomPanel } from "./preview/BottomPanel";
import { CommandPalette } from "./CommandPalette";
import { ShareModal } from "./ShareModal";

interface EditorShellProps {
  projectId: string;
  projectName: string;
  role: ProjectRole;
  currentUser: LocalUser;
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function trackDrag(startEvent: React.MouseEvent, axis: "x" | "y", onDelta: (delta: number) => void) {
  const startPos = axis === "x" ? startEvent.clientX : startEvent.clientY;

  function handleMouseMove(event: MouseEvent) {
    const pos = axis === "x" ? event.clientX : event.clientY;
    onDelta(pos - startPos);
  }
  function handleMouseUp() {
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  }
  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mouseup", handleMouseUp);
}

function EditorShellInner({ projectId, projectName, role: initialRole, currentUser }: EditorShellProps) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { toast } = useToast();
  const [role, setRole] = useState<ProjectRole>(initialRole);
  const [shareOpen, setShareOpen] = useState(false);
  const explorerOpen = useAppSelector((state) => state.ui.explorerOpen);
  const explorerWidth = useAppSelector((state) => state.ui.explorerWidth);
  const previewOpen = useAppSelector((state) => state.ui.previewOpen);
  const previewWidth = useAppSelector((state) => state.ui.previewWidth);
  const bottomPanelOpen = useAppSelector((state) => state.ui.bottomPanelOpen);
  const bottomPanelHeight = useAppSelector((state) => state.ui.bottomPanelHeight);
  const commandPaletteOpen = useAppSelector((state) => state.ui.commandPaletteOpen);
  const dirtyFileIds = useAppSelector((state) => state.editor.dirtyFileIds);
  const activeFileId = useAppSelector((state) => state.editor.activeFileId);
  const openTabs = useAppSelector((state) => state.editor.openTabs);
  const { data: files = [] } = useGetFilesQuery(projectId);

  const canEdit = role === "OWNER" || role === "EDITOR";

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingLine, setPendingLine] = useState<number | null>(null);
  const [saveNowToken, setSaveNowToken] = useState(0);
  const [runToken, setRunToken] = useState(0);
  const editorInstanceRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const supabaseRef = useRef(createClient());
  const presenceRef = useRef<ProjectPresenceChannel | null>(null);

  const handleMembershipChanged = useCallback(
    async (changedUserId: string) => {
      if (changedUserId !== currentUser.id) return;

      const response = await fetch(`/api/projects/${projectId}`).catch(() => null);
      const newRole: ProjectRole | null =
        response && response.ok ? ((await response.json()).project?.role ?? null) : null;

      if (!newRole) {
        toast("You no longer have access to this project", undefined, "danger");
        router.push("/dashboard");
        return;
      }

      setRole((prev) => {
        if (prev === newRole) return prev;
        toast(`Your role on this project changed to ${newRole.charAt(0)}${newRole.slice(1).toLowerCase()}`);
        return newRole;
      });
    },
    [projectId, currentUser.id, router, toast],
  );

  useEffect(() => {
    const presence = new ProjectPresenceChannel({
      supabase: supabaseRef.current,
      projectId,
      localUser: currentUser,
      onCollaboratorsChange: (collaborators) => dispatch(setCollaborators(collaborators)),
      onMembershipChanged: handleMembershipChanged,
    });
    presenceRef.current = presence;
    return () => {
      presence.destroy();
      presenceRef.current = null;
    };
  }, [projectId, currentUser, dispatch, handleMembershipChanged]);

  useEffect(() => {
    const activePath = openTabs.find((tab) => tab.fileId === activeFileId)?.path ?? null;
    presenceRef.current?.setActiveFile(activeFileId, activePath);
  }, [activeFileId, openTabs]);

  const followingUserId = useAppSelector((state) => state.collaboration.followingUserId);
  const collaborators = useAppSelector((state) => state.collaboration.collaborators);
  const followedFileId = collaborators.find((c) => c.userId === followingUserId)?.activeFileId ?? null;

  useEffect(() => {
    if (!followedFileId || followedFileId === activeFileId) return;
    const file = files.find((entry) => entry.id === followedFileId);
    if (file) dispatch(openTab({ fileId: file.id, path: file.path }));
  }, [followedFileId, activeFileId, files, dispatch]);

  const handleConnectionStateChange = useCallback(
    (state: ConnectionState) => {
      dispatch(setConnectionState(state));
    },
    [dispatch],
  );

  const openAtLine = useCallback(
    (fileId: string, path: string, line: number) => {
      dispatch(openTab({ fileId, path }));
      dispatch(setSearchOpen(false));
      setPendingLine(line);
    },
    [dispatch],
  );

  const openPathAtLine = useCallback(
    (path: string, line: number) => {
      const file = files.find((entry) => entry.path === path);
      if (file) openAtLine(file.id, file.path, line);
    },
    [files, openAtLine],
  );

  const triggerFindInFile = useCallback(() => {
    editorInstanceRef.current?.focus();
    editorInstanceRef.current?.getAction("actions.find")?.run();
  }, []);

  const triggerGoToLine = useCallback(() => {
    editorInstanceRef.current?.focus();
    editorInstanceRef.current?.getAction("editor.action.gotoLine")?.run();
  }, []);

  const triggerRun = useCallback(() => {
    setRunToken((token) => token + 1);
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
      if (meta && event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        dispatch(togglePreview());
        return;
      }
      if (meta && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        dispatch(setSearchOpen(true));
        return;
      }
      if (meta && event.shiftKey && event.key.toLowerCase() === "s" && role === "OWNER") {
        event.preventDefault();
        setShareOpen(true);
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
      if (meta && event.key === "Enter") {
        event.preventDefault();
        triggerRun();
        return;
      }
      if (meta && event.key.toLowerCase() === "s") {
        event.preventDefault();
        setSaveNowToken((token) => token + 1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dispatch, commandPaletteOpen, canEdit, role, triggerFindInFile, triggerGoToLine, triggerRun]);

  function handleExplorerResizeStart(event: React.MouseEvent) {
    const startWidth = explorerWidth;
    trackDrag(event, "x", (delta) => dispatch(setExplorerWidth(clamp(startWidth + delta, 180, 440))));
  }

  function handlePreviewResizeStart(event: React.MouseEvent) {
    const startWidth = previewWidth;
    trackDrag(event, "x", (delta) => dispatch(setPreviewWidth(clamp(startWidth - delta, 280, 900))));
  }

  function handleBottomResizeStart(event: React.MouseEvent) {
    if (!bottomPanelOpen) dispatch(toggleBottomPanel());
    const startHeight = bottomPanelHeight;
    trackDrag(event, "y", (delta) => dispatch(setBottomPanelHeight(clamp(startHeight - delta, 120, 460))));
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg-base">
      <TopBar
        projectName={projectName}
        settingsOpen={settingsOpen}
        onSettingsOpenChange={setSettingsOpen}
        onRun={triggerRun}
        canShare={role === "OWNER"}
        onOpenShare={() => setShareOpen(true)}
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
              onMouseDown={handleExplorerResizeStart}
              className="w-1 flex-none cursor-col-resize hover:bg-accent/35"
            />
          </>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1">
            <EditorWorkspace
              projectId={projectId}
              canEdit={canEdit}
              currentUser={currentUser}
              onConnectionStateChange={handleConnectionStateChange}
              pendingLine={pendingLine}
              onLineHandled={() => setPendingLine(null)}
              onEditorMount={(instance) => {
                editorInstanceRef.current = instance;
              }}
              onFindInFile={triggerFindInFile}
              saveNowToken={saveNowToken}
            />

            {previewOpen && (
              <>
                <div
                  onMouseDown={handlePreviewResizeStart}
                  className="w-1 flex-none cursor-col-resize hover:bg-accent/35"
                />
                <div style={{ width: previewWidth }} className="flex-none">
                  <PreviewPanel
                    projectId={projectId}
                    projectName={projectName}
                    runToken={runToken}
                    onOpenAtLine={openPathAtLine}
                  />
                </div>
              </>
            )}
          </div>

          <div
            onMouseDown={handleBottomResizeStart}
            className="h-1 flex-none cursor-row-resize hover:bg-accent/35"
          />
          <BottomPanel open={bottomPanelOpen} height={bottomPanelHeight} onOpenAtLine={openPathAtLine} />
        </div>
      </div>

      <CommandPalette
        projectId={projectId}
        canEdit={canEdit}
        canShare={role === "OWNER"}
        onGoToLine={triggerGoToLine}
        onFindInFile={triggerFindInFile}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenShare={() => setShareOpen(true)}
        onRun={triggerRun}
      />

      {role === "OWNER" && (
        <ShareModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          projectId={projectId}
          projectName={projectName}
        />
      )}
    </div>
  );
}
