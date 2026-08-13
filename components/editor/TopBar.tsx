"use client";

import { useState } from "react";
import Link from "next/link";
import { OrbitLogo } from "@/components/shared/OrbitLogo";
import { SettingsModal } from "@/components/shared/SettingsModal";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { togglePreview } from "@/store/slices/uiSlice";

const SAVE_LABEL: Record<string, { text: string; color: string }> = {
  idle: { text: "Saved", color: "var(--color-ok)" },
  saved: { text: "Saved", color: "var(--color-ok)" },
  saving: { text: "Saving…", color: "var(--color-warn)" },
  error: { text: "Save failed", color: "var(--color-danger)" },
};

interface TopBarProps {
  projectName: string;
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
  onRun: () => void;
}

export function TopBar({ projectName, settingsOpen, onSettingsOpenChange, onRun }: TopBarProps) {
  const saveState = useAppSelector((state) => state.editor.saveState);
  const [moreOpen, setMoreOpen] = useState(false);
  const dispatch = useAppDispatch();

  const save = SAVE_LABEL[saveState] ?? SAVE_LABEL.idle;

  return (
    <header className="flex h-11 flex-none items-center gap-3 border-b border-border-subtle bg-bg-panel pr-3 pl-3.5">
      <Link
        href="/dashboard"
        title="Back to dashboard"
        className="flex items-center gap-2.25 rounded-sm px-1.5 py-1 hover:bg-[#17191D]"
      >
        <OrbitLogo size={19} />
        <span className="text-ui font-semibold text-text-primary">Orbit</span>
      </Link>
      <span className="text-xs text-[#33363C]">/</span>
      <span className="text-ui text-[#C9C8C4]">{projectName}</span>
      <span className="ml-1.5 flex items-center gap-1.25 text-[11.5px]" style={{ color: save.color }}>
        <span className="block h-1.25 w-1.25 rounded-full" style={{ background: save.color }} />
        {save.text}
      </span>

      <div className="flex-1" />

      <button
        onClick={onRun}
        className="flex items-center gap-1.5 rounded-sm bg-accent px-2.75 py-1.5 text-ui font-medium text-on-accent hover:bg-accent-hover"
      >
        Run
        <span className="font-mono text-[10px] opacity-70">⌘↵</span>
      </button>

      <div className="relative">
        <button
          onClick={() => setMoreOpen((value) => !value)}
          className="rounded-sm px-2 py-1.5 text-sm leading-none text-text-tertiary hover:bg-[#17191D] hover:text-text-primary"
        >
          ···
        </button>
        {moreOpen && (
          <div
            onMouseLeave={() => setMoreOpen(false)}
            className="absolute top-8 right-0 z-60 w-48 rounded-md border border-border-strong bg-bg-raised p-1.25 shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
          >
            <button
              onClick={() => {
                onSettingsOpenChange(true);
                setMoreOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-ui text-[#C9C8C4] hover:bg-[#22242A]"
            >
              Settings
              <span className="font-mono text-[10px] text-text-faint">⌘,</span>
            </button>
            <button
              onClick={() => {
                dispatch(togglePreview());
                setMoreOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-ui text-[#C9C8C4] hover:bg-[#22242A]"
            >
              Toggle preview
              <span className="font-mono text-[10px] text-text-faint">⌘⇧P</span>
            </button>
          </div>
        )}
      </div>

      <SettingsModal open={settingsOpen} onClose={() => onSettingsOpenChange(false)} />
    </header>
  );
}
