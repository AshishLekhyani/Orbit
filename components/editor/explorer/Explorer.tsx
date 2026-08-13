"use client";

import { useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { toggleFolderExpanded } from "@/store/slices/projectSlice";
import { openTab, closeTab, setActiveFile, setSearchOpen } from "@/store/slices/editorSlice";
import { setCreatingFile, setCommandPaletteOpen } from "@/store/slices/uiSlice";
import {
  useGetFilesQuery,
  useCreateFileMutation,
  useRenameFileMutation,
  useDeleteFileMutation,
  useDuplicateFileMutation,
} from "@/store/api/filesApi";
import { buildFileTree, flattenVisibleTree, type TreeNode } from "@/lib/buildFileTree";
import { FileTreeNode, FileTreeRenameInput } from "./FileTreeNode";
import { ContextMenu, type ContextMenuItem } from "@/components/shared/ContextMenu";
import { useToast } from "@/components/shared/ToastProvider";
import { ProjectSearch } from "./ProjectSearch";

interface ExplorerProps {
  projectId: string;
  canEdit: boolean;
  dirtyFileIds: Set<string>;
  onOpenAtLine?: (fileId: string, path: string, line: number) => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  node: TreeNode | null;
}

export function Explorer({ projectId, canEdit, dirtyFileIds, onOpenAtLine }: ExplorerProps) {
  const dispatch = useAppDispatch();
  const activeFileId = useAppSelector((state) => state.editor.activeFileId);
  const openTabs = useAppSelector((state) => state.editor.openTabs);
  const searchOpen = useAppSelector((state) => state.editor.searchOpen);
  const creating = useAppSelector((state) => state.ui.creatingFile);
  const expandedFolderIds = useAppSelector((state) => state.project.expandedFolderIds);
  const { data: files = [] } = useGetFilesQuery(projectId);
  const [createFile] = useCreateFileMutation();
  const [renameFile] = useRenameFileMutation();
  const [deleteFile] = useDeleteFileMutation();
  const [duplicateFile] = useDuplicateFileMutation();
  const { toast } = useToast();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | "root" | null>(null);

  const expandedSet = useMemo(() => new Set(expandedFolderIds), [expandedFolderIds]);
  const tree = useMemo(() => buildFileTree(files), [files]);
  const visible = useMemo(() => flattenVisibleTree(tree, expandedSet), [tree, expandedSet]);

  function ensureExpanded(folderId: string) {
    if (!expandedFolderIds.includes(folderId)) dispatch(toggleFolderExpanded(folderId));
  }

  function openFile(node: TreeNode) {
    if (node.isDirectory) {
      dispatch(toggleFolderExpanded(node.id));
      return;
    }
    dispatch(openTab({ fileId: node.id, path: node.path }));
  }

  function startCreate(parentId: string | null, isDirectory: boolean) {
    if (parentId) ensureExpanded(parentId);
    dispatch(setSearchOpen(false));
    dispatch(setCreatingFile({ parentId, isDirectory }));
  }

  async function submitCreate(name: string) {
    if (!creating) return;
    const { parentId, isDirectory } = creating;
    dispatch(setCreatingFile(null));
    try {
      const file = await createFile({ projectId, name, parentId, isDirectory }).unwrap();
      toast(`Created ${isDirectory ? "folder" : "file"}`, name);
      if (!isDirectory) dispatch(openTab({ fileId: file.id, path: file.path }));
    } catch {
      toast("Couldn't create " + (isDirectory ? "folder" : "file"), undefined, "danger");
    }
  }

  async function submitRename(node: TreeNode, name: string) {
    setRenamingId(null);
    if (name === node.name) return;
    try {
      await renameFile({ projectId, fileId: node.id, name }).unwrap();
      toast("Renamed", name);
    } catch {
      toast("Couldn't rename", undefined, "danger");
    }
  }

  async function handleDelete(node: TreeNode) {
    if (!window.confirm(`Delete "${node.name}"? This can't be undone.`)) return;

    const affectedPrefix = `${node.path}/`;
    const affectedTabs = openTabs.filter(
      (tab) => tab.fileId === node.id || tab.path.startsWith(affectedPrefix),
    );
    const previousActiveFileId = activeFileId;
    affectedTabs.forEach((tab) => dispatch(closeTab(tab.fileId)));

    try {
      await deleteFile({ projectId, fileId: node.id }).unwrap();
      toast("Deleted", node.name);
    } catch {
      affectedTabs.forEach((tab) => dispatch(openTab(tab)));
      if (previousActiveFileId) dispatch(setActiveFile(previousActiveFileId));
      toast("Couldn't delete", undefined, "danger");
    }
  }

  async function handleDuplicate(node: TreeNode) {
    try {
      const file = await duplicateFile({ projectId, fileId: node.id }).unwrap();
      toast("Duplicated", file.name);
      dispatch(openTab({ fileId: file.id, path: file.path }));
    } catch {
      toast("Couldn't duplicate", undefined, "danger");
    }
  }

  async function moveNode(fileId: string, parentId: string | null) {
    try {
      await renameFile({ projectId, fileId, parentId }).unwrap();
    } catch {
      toast("Couldn't move item", undefined, "danger");
    }
  }

  function menuItemsFor(node: TreeNode): ContextMenuItem[] {
    const items: ContextMenuItem[] = [];
    if (node.isDirectory) {
      items.push({ label: "New file", shortcut: "⌘N", onSelect: () => startCreate(node.id, false) });
      items.push({ label: "New folder", onSelect: () => startCreate(node.id, true) });
    }
    items.push({ label: "Rename", shortcut: "F2", onSelect: () => setRenamingId(node.id) });
    if (!node.isDirectory) {
      items.push({ label: "Duplicate", onSelect: () => handleDuplicate(node) });
    }
    items.push({ label: "Delete", shortcut: "⌫", danger: true, onSelect: () => handleDelete(node) });
    return items;
  }

  const creatingInsertIndex = (() => {
    if (!creating) return -1;
    let lastMatch = -1;
    visible.forEach((node, index) => {
      if (node.parentId === creating.parentId) lastMatch = index;
    });
    if (lastMatch !== -1) return lastMatch + 1;
    if (creating.parentId === null) return 0;
    const parentIndex = visible.findIndex((node) => node.id === creating.parentId);
    return parentIndex === -1 ? visible.length : parentIndex + 1;
  })();

  const creatingDepth = creating?.parentId
    ? (visible.find((node) => node.id === creating.parentId)?.depth ?? 0) + 1
    : 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-8.5 flex-none items-center justify-between border-b border-[#17191D] pr-2 pl-3">
        <div className="flex gap-3.5">
          <button
            onClick={() => dispatch(setSearchOpen(false))}
            className={`text-label ${!searchOpen ? "text-text-primary" : "text-text-muted hover:text-text-primary"}`}
          >
            Explorer
          </button>
          <button
            onClick={() => dispatch(setSearchOpen(true))}
            title="Search in files  ⇧⌘F"
            className={`text-label ${searchOpen ? "text-text-primary" : "text-text-muted hover:text-text-primary"}`}
          >
            Search
          </button>
        </div>
        {!searchOpen && canEdit && (
          <div className="flex gap-0.5">
            <button
              onClick={() => startCreate(null, false)}
              title="New file  ⌘N"
              className="grid h-5.5 w-5.5 place-items-center rounded-xs text-ui text-text-secondary hover:bg-[#1B1D21] hover:text-text-primary"
            >
              +
            </button>
            <button
              onClick={() => startCreate(null, true)}
              title="New folder"
              className="grid h-5.5 w-5.5 place-items-center rounded-xs text-[11px] text-text-secondary hover:bg-[#1B1D21] hover:text-text-primary"
            >
              ▤
            </button>
          </div>
        )}
      </div>

      {searchOpen ? (
        <ProjectSearch projectId={projectId} onOpenAtLine={onOpenAtLine} />
      ) : (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDropTarget("root");
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (dragId) moveNode(dragId, null);
            setDragId(null);
            setDropTarget(null);
          }}
          className="min-h-0 flex-1 overflow-auto py-1.5"
        >
          {visible.length === 0 && !creating && (
            <div className="px-3 py-4 text-[11.5px] leading-relaxed text-text-faint">
              No files yet.
            </div>
          )}
          {visible.map((node, index) => (
            <div key={node.id}>
              {renamingId === node.id ? (
                <FileTreeRenameInput
                  initialValue={node.name}
                  depth={node.depth}
                  onSubmit={(name) => submitRename(node, name)}
                  onCancel={() => setRenamingId(null)}
                />
              ) : (
                <FileTreeNode
                  node={node}
                  isActive={node.id === activeFileId}
                  isExpanded={expandedSet.has(node.id)}
                  isDirty={dirtyFileIds.has(node.id)}
                  isDropTarget={dropTarget === node.id}
                  isDragging={dragId === node.id}
                  onClick={() => openFile(node)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    if (!canEdit) return;
                    setContextMenu({ x: event.clientX, y: event.clientY, node });
                  }}
                  onDragStart={(event) => {
                    setDragId(node.id);
                    event.dataTransfer.setData("text/plain", node.id);
                  }}
                  onDragOver={(event) => {
                    if (!node.isDirectory || !canEdit) return;
                    event.preventDefault();
                    event.stopPropagation();
                    setDropTarget(node.id);
                  }}
                  onDragLeave={() => setDropTarget(null)}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (dragId && node.isDirectory) moveNode(dragId, node.id);
                    setDragId(null);
                    setDropTarget(null);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setDropTarget(null);
                  }}
                />
              )}
              {creating && creatingInsertIndex === index + 1 && (
                <FileTreeRenameInput
                  initialValue=""
                  depth={creatingDepth}
                  onSubmit={submitCreate}
                  onCancel={() => dispatch(setCreatingFile(null))}
                />
              )}
            </div>
          ))}
          {creating && creatingInsertIndex === 0 && (
            <FileTreeRenameInput
              initialValue=""
              depth={0}
              onSubmit={submitCreate}
              onCancel={() => dispatch(setCreatingFile(null))}
            />
          )}
        </div>
      )}

      <div className="flex h-8 flex-none items-center justify-between border-t border-[#17191D] px-3 py-2.25">
        <span className="text-[11px] text-text-muted">
          {files.filter((file) => !file.isDirectory).length} files
        </span>
        <button
          onClick={() => dispatch(setCommandPaletteOpen(true))}
          className="rounded-xs border border-[#24262B] px-1.5 py-0.5 font-mono text-[10px] text-text-muted hover:border-[#3A3D44] hover:text-text-primary"
        >
          ⌘K
        </button>
      </div>

      {contextMenu?.node && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={menuItemsFor(contextMenu.node)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
