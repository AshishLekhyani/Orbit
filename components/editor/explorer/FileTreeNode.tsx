"use client";

import { useEffect, useRef, useState } from "react";
import type { TreeNode } from "@/lib/buildFileTree";

const ICONS: Record<string, { icon: string; color: string }> = {
  HTML: { icon: "<>", color: "#E0898B" },
  CSS: { icon: "#", color: "#8FB8D9" },
  JS: { icon: "JS", color: "#D9A85C" },
  JSON: { icon: "{}", color: "#7A7C82" },
  MARKDOWN: { icon: "M", color: "#7A7C82" },
  OTHER: { icon: "•", color: "#7A7C82" },
};

interface FileTreeNodeProps {
  node: TreeNode;
  isActive: boolean;
  isExpanded: boolean;
  isDirty: boolean;
  isDropTarget: boolean;
  isDragging: boolean;
  onClick: () => void;
  onContextMenu: (event: React.MouseEvent) => void;
  onDragStart: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (event: React.DragEvent) => void;
  onDragEnd: () => void;
}

export function FileTreeNode({
  node,
  isActive,
  isExpanded,
  isDirty,
  isDropTarget,
  isDragging,
  onClick,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: FileTreeNodeProps) {
  const meta = node.isDirectory ? null : ICONS[node.type];

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      style={{ paddingLeft: 10 + node.depth * 14, opacity: isDragging ? 0.4 : 1 }}
      className={`flex h-6.25 cursor-pointer items-center gap-1.75 rounded-sm pr-2 select-none ${
        isActive ? "bg-[#191B1F]" : "hover:bg-[#191B1F]"
      } ${isDropTarget ? "shadow-[inset_0_0_0_1px_var(--color-accent)]" : ""}`}
    >
      <span className="w-2.75 flex-none text-center font-mono text-[9px] text-text-muted">
        {node.isDirectory ? (isExpanded ? "⌄" : "›") : meta?.icon}
      </span>
      <span
        className="overflow-hidden text-ellipsis whitespace-nowrap text-ui"
        style={{ color: node.isDirectory ? "#C9C8C4" : meta?.color ?? "#C9C8C4" }}
      >
        {node.name}
      </span>
      {isDirty && <span className="ml-auto block h-1.25 w-1.25 flex-none rounded-full bg-accent" />}
    </div>
  );
}

export function FileTreeRenameInput({
  initialValue,
  depth,
  onSubmit,
  onCancel,
}: {
  initialValue: string;
  depth: number;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function commit() {
    const trimmed = value.trim();
    if (trimmed) {
      onSubmit(trimmed);
    } else {
      onCancel();
    }
  }

  return (
    <div
      style={{ paddingLeft: 10 + depth * 14 }}
      className="flex h-6.25 items-center gap-1.75 pr-2"
    >
      <span className="w-2.75 flex-none" />
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") onCancel();
        }}
        className="h-5.5 flex-1 rounded-xs border border-accent bg-bg-editor px-1 text-ui text-text-primary outline-none"
      />
    </div>
  );
}
