"use client";

import { useEffect, useRef } from "react";

export interface ContextMenuItem {
  label: string;
  shortcut?: string;
  danger?: boolean;
  onSelect: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{ left: x, top: y }}
      className="fixed z-80 w-44 rounded-md border border-border-strong bg-bg-raised p-1.25 shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => {
            item.onSelect();
            onClose();
          }}
          className={`flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-ui hover:bg-[#22242A] ${
            item.danger ? "text-danger-text" : "text-[#C9C8C4]"
          }`}
        >
          {item.label}
          {item.shortcut && (
            <span className="font-mono text-[10px] text-text-faint">{item.shortcut}</span>
          )}
        </button>
      ))}
    </div>
  );
}
