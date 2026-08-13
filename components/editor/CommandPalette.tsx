"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setCommandPaletteOpen, toggleExplorer, togglePreview, setCreatingFile } from "@/store/slices/uiSlice";
import { openTab, setSearchOpen } from "@/store/slices/editorSlice";
import { useGetFilesQuery } from "@/store/api/filesApi";
import { CommandPaletteShell, type PaletteCommand } from "@/components/shared/CommandPaletteShell";

interface CommandPaletteProps {
  projectId: string;
  canEdit: boolean;
  canShare: boolean;
  onGoToLine: () => void;
  onFindInFile: () => void;
  onOpenSettings: () => void;
  onOpenShare: () => void;
  onRun: () => void;
}

export function CommandPalette(props: CommandPaletteProps) {
  const open = useAppSelector((state) => state.ui.commandPaletteOpen);
  const dispatch = useAppDispatch();
  if (!open) return null;
  return <CommandPaletteContent {...props} onClose={() => dispatch(setCommandPaletteOpen(false))} />;
}

function CommandPaletteContent({
  projectId,
  canEdit,
  canShare,
  onGoToLine,
  onFindInFile,
  onOpenSettings,
  onOpenShare,
  onRun,
  onClose,
}: CommandPaletteProps & { onClose: () => void }) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { data: files = [] } = useGetFilesQuery(projectId);

  const commands: PaletteCommand[] = useMemo(() => {
    const list: PaletteCommand[] = [
      {
        id: "run-project",
        label: "Run Project",
        hint: "Preview",
        key: "⌘↵",
        icon: "▶",
        run: onRun,
      },
      {
        id: "toggle-preview",
        label: "Toggle Preview",
        hint: "Layout",
        key: "⌘⇧P",
        icon: "▤",
        run: () => dispatch(togglePreview()),
      },
      {
        id: "toggle-sidebar",
        label: "Toggle Sidebar",
        hint: "Layout",
        key: "⌘B",
        icon: "▥",
        run: () => dispatch(toggleExplorer()),
      },
      {
        id: "find-in-file",
        label: "Find in File",
        hint: "Editor",
        key: "⌘F",
        icon: "⌕",
        run: onFindInFile,
      },
      {
        id: "search-in-files",
        label: "Search in Files",
        hint: "Project",
        key: "⇧⌘F",
        icon: "⌕",
        run: () => dispatch(setSearchOpen(true)),
      },
      {
        id: "go-to-line",
        label: "Go to Line",
        hint: "Editor",
        key: "⌃G",
        icon: "#",
        run: onGoToLine,
      },
      {
        id: "open-settings",
        label: "Open Settings",
        hint: "Workspace",
        key: "⌘,",
        icon: "⚙",
        run: onOpenSettings,
      },
      ...(canShare
        ? [
            {
              id: "share-project",
              label: "Share Project",
              hint: "Collaboration",
              key: "⌘⇧S",
              icon: "⚯",
              run: onOpenShare,
            },
          ]
        : []),
      {
        id: "back-to-dashboard",
        label: "Back to Dashboard",
        hint: "Navigate",
        icon: "←",
        run: () => router.push("/dashboard"),
      },
    ];
    if (canEdit) {
      list.unshift(
        {
          id: "new-file",
          label: "New File",
          hint: "Explorer",
          key: "⌘N",
          icon: "+",
          run: () => dispatch(setCreatingFile({ parentId: null, isDirectory: false })),
        },
        {
          id: "new-folder",
          label: "New Folder",
          hint: "Explorer",
          icon: "▤",
          run: () => dispatch(setCreatingFile({ parentId: null, isDirectory: true })),
        },
      );
    }
    return list;
  }, [dispatch, router, onGoToLine, onFindInFile, onOpenSettings, onOpenShare, onRun, canEdit, canShare]);

  const fileItems: PaletteCommand[] = useMemo(
    () =>
      files
        .filter((file) => !file.isDirectory)
        .map((file) => ({
          id: `file-${file.id}`,
          label: file.path,
          hint: "File",
          icon: "⌘",
          run: () => dispatch(openTab({ fileId: file.id, path: file.path })),
        })),
    [files, dispatch],
  );

  return <CommandPaletteShell commands={commands} extraItems={fileItems} onClose={onClose} />;
}
