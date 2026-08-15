"use client";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setActiveBottomTab, clearConsole, type BottomTab } from "@/store/slices/previewSlice";

interface Row {
  id: string;
  glyph: string;
  glyphColor: string;
  text: string;
  meta: string;
  fg: string;
  rail: string;
  onClick?: () => void;
}

const TABS: { id: BottomTab; label: string }[] = [
  { id: "problems", label: "Problems" },
  { id: "console", label: "Console" },
  { id: "output", label: "Output" },
];

interface BottomPanelProps {
  open: boolean;
  height: number;
  onOpenAtLine: (path: string, line: number) => void;
  onToggleOpen: () => void;
}

export function BottomPanel({ open, height, onOpenAtLine, onToggleOpen }: BottomPanelProps) {
  const dispatch = useAppDispatch();
  const activeTab = useAppSelector((state) => state.preview.activeBottomTab);
  const problems = useAppSelector((state) => state.preview.problems);
  const console_ = useAppSelector((state) => state.preview.console);
  const output = useAppSelector((state) => state.preview.output);

  const errorCount = problems.filter((problem) => problem.severity === "error").length;

  const rows: Row[] =
    activeTab === "problems"
      ? problems.map((problem) => ({
          id: problem.id,
          glyph: problem.severity === "error" ? "✕" : "⚠",
          glyphColor: problem.severity === "error" ? "#E0898B" : "#D9A85C",
          text: problem.text,
          meta: `${problem.file}:${problem.line}`,
          fg: "#C9C8C4",
          rail: problem.severity === "error" ? "var(--color-danger)" : "transparent",
          onClick: () => onOpenAtLine(problem.file, problem.line),
        }))
      : activeTab === "output"
        ? output.map((line, index) => ({
            id: `output-${index}`,
            glyph: "›",
            glyphColor: "#45474D",
            text: line,
            meta: "",
            fg: "#8B8C90",
            rail: "transparent",
          }))
        : console_.map((entry) => ({
            id: entry.id,
            glyph: entry.type === "error" ? "✕" : entry.type === "warn" ? "⚠" : "›",
            glyphColor: entry.type === "error" ? "#E0898B" : entry.type === "warn" ? "#D9A85C" : "#45474D",
            text: entry.text,
            meta: entry.file ? `${entry.file}:${entry.line}` : "",
            fg: entry.type === "error" ? "#E0898B" : entry.type === "warn" ? "#D9A85C" : "#C9C8C4",
            rail: entry.type === "error" ? "var(--color-danger)" : "transparent",
            onClick: entry.file ? () => onOpenAtLine(entry.file as string, entry.line ?? 1) : undefined,
          }));

  const emptyText =
    activeTab === "problems"
      ? "No problems detected in this project."
      : "Nothing here yet. Run the project to see output.";

  return (
    <section
      style={{ height: open ? height : 31 }}
      className="flex flex-none flex-col overflow-hidden border-t border-border-subtle bg-bg-panel"
    >
      <div className="flex h-7.75 flex-none items-stretch border-b border-[#17191D] pr-2">
        {TABS.map((tab) => {
          const badgeCount = tab.id === "problems" ? problems.length : tab.id === "console" ? console_.length : 0;
          return (
            <button
              key={tab.id}
              onClick={() => dispatch(setActiveBottomTab(tab.id))}
              className="flex items-center gap-1.5 px-3.25 text-ui"
              style={{
                color: activeTab === tab.id ? "#E9E8E4" : "#8B8C90",
                boxShadow: activeTab === tab.id ? "inset 0 -2px 0 var(--color-accent)" : "none",
              }}
            >
              {tab.label}
              {badgeCount > 0 && (
                <span
                  className="rounded-xs px-1 font-mono text-[9.5px]"
                  style={{
                    color: tab.id === "problems" && errorCount ? "var(--color-danger)" : "#9A9B9F",
                    background: tab.id === "problems" && errorCount ? "rgba(224,137,139,0.12)" : "#1A1C20",
                  }}
                >
                  {badgeCount}
                </span>
              )}
            </button>
          );
        })}
        <div className="flex-1" />
        <button
          onClick={() => dispatch(clearConsole())}
          className="px-2 text-[11px] text-text-muted hover:text-text-primary"
        >
          Clear
        </button>
        <button
          onClick={onToggleOpen}
          title={open ? "Collapse panel" : "Expand panel"}
          aria-label={open ? "Collapse panel" : "Expand panel"}
          className="px-1.5 text-ui text-text-tertiary hover:text-text-primary"
        >
          {open ? "⌄" : "⌃"}
        </button>
      </div>

      {open && (
        <div className="flex-1 overflow-auto py-1.5 font-mono text-[11.5px] leading-loose">
          {rows.length === 0 && (
            <div className="px-3.5 py-4 text-[11.5px] text-text-dim">{emptyText}</div>
          )}
          {rows.map((row) => (
            <div
              key={row.id}
              role={row.onClick ? "button" : undefined}
              tabIndex={row.onClick ? 0 : undefined}
              onClick={row.onClick}
              onKeyDown={
                row.onClick
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        row.onClick?.();
                      }
                    }
                  : undefined
              }
              style={{ borderLeft: `2px solid ${row.rail}`, cursor: row.onClick ? "pointer" : "default" }}
              className="flex gap-2.5 px-3.5 py-0.5 outline-none hover:bg-bg-raised focus-visible:bg-bg-raised"
            >
              <span className="w-2.5 flex-none" style={{ color: row.glyphColor }}>
                {row.glyph}
              </span>
              <span className="wrap-break-word whitespace-pre-wrap" style={{ color: row.fg }}>
                {row.text}
              </span>
              {row.meta && <span className="ml-auto flex-none text-text-dim">{row.meta}</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
