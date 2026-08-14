"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface PaletteCommand {
  id: string;
  label: string;
  hint: string;
  key?: string;
  icon: string;
  run: () => void;
}

interface CommandPaletteShellProps {
  commands: PaletteCommand[];
  extraItems?: PaletteCommand[];
  onClose: () => void;
}

export function CommandPaletteShell({ commands, extraItems = [], onClose }: CommandPaletteShellProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const pool = useMemo(() => {
    if (!query.trim()) return commands.slice(0, 7);
    const needle = query.trim().toLowerCase();
    return [...commands, ...extraItems].filter((item) => item.label.toLowerCase().includes(needle));
  }, [commands, extraItems, query]);

  const clampedIndex = Math.min(activeIndex, Math.max(0, pool.length - 1));

  function runItem(index: number) {
    const item = pool[index];
    if (!item) return;
    item.run();
    onClose();
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-100 flex items-start justify-center bg-[rgba(8,9,11,0.62)] pt-[14vh]"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="h-fit w-140 max-w-[92vw] overflow-hidden rounded-lg border border-[#2E3036] bg-bg-raised shadow-[0_32px_90px_rgba(0,0,0,0.65)]"
      >
        <div className="flex items-center gap-2.5 border-b border-[#22242A] px-3.5">
          <span className="font-mono text-[13px] text-accent">›</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) => Math.min(pool.length - 1, index + 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) => Math.max(0, index - 1));
              } else if (event.key === "Enter") {
                event.preventDefault();
                runItem(clampedIndex);
              } else if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              }
            }}
            placeholder="Search commands and files…"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-listbox"
            aria-activedescendant={pool[clampedIndex] ? `command-palette-option-${pool[clampedIndex].id}` : undefined}
            aria-autocomplete="list"
            className="h-11.5 flex-1 bg-transparent text-body text-text-primary outline-none placeholder:text-text-faint"
          />
          <span className="rounded-xs border border-border-strong px-1.25 py-0.5 font-mono text-[10px] text-text-faint">
            esc
          </span>
        </div>
        <div id="command-palette-listbox" role="listbox" className="max-h-84 overflow-auto p-1.5">
          <div className="px-2.5 py-1.5 text-[10px] tracking-[0.12em] text-text-dim uppercase">
            {query ? "Results" : "Recent"}
          </div>
          {pool.map((item, index) => (
            <div
              key={item.id}
              id={`command-palette-option-${item.id}`}
              role="option"
              aria-selected={index === clampedIndex}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => runItem(index)}
              className="flex cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-2"
              style={{ background: index === clampedIndex ? "#22242A" : "transparent" }}
            >
              <span
                className="w-3.5 flex-none font-mono text-[10px]"
                style={{ color: index === clampedIndex ? "var(--color-accent)" : "#55585E" }}
              >
                {item.icon}
              </span>
              <span
                className="text-body"
                style={{ color: index === clampedIndex ? "#E9E8E4" : "#C9C8C4" }}
              >
                {item.label}
              </span>
              <span className="text-ui text-text-faint">{item.hint}</span>
              <span className="ml-auto font-mono text-[10.5px] text-text-muted">{item.key}</span>
            </div>
          ))}
          {pool.length === 0 && (
            <div className="px-3 py-6 text-center text-body text-text-muted">
              No matching commands.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
