"use client";

import { useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setSettings, type EditorTheme } from "@/store/slices/settingsSlice";

type Category = "General" | "Editor" | "Appearance" | "Keyboard Shortcuts" | "Collaboration" | "Security";

const CATEGORIES: Category[] = [
  "General",
  "Editor",
  "Appearance",
  "Keyboard Shortcuts",
  "Collaboration",
  "Security",
];

const AVAILABLE: Category[] = ["General", "Editor", "Appearance"];

const DESCRIPTIONS: Record<Category, string> = {
  General: "Workspace defaults for new projects.",
  Editor: "How code looks and behaves while you type.",
  Appearance: "Theme and interface density.",
  "Keyboard Shortcuts": "Every shortcut Orbit listens for - available once the editor ships.",
  Collaboration: "Presence, cursors, and session limits - coming with real-time collaboration.",
  Security: "Access, sessions, and sharing defaults - coming with project sharing.",
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative h-4.75 w-8.5 rounded-full border border-[#2E3036]"
      style={{ background: checked ? "var(--color-accent)" : "#1A1C20" }}
    >
      <span
        className="absolute top-0.5 h-3.25 w-3.25 rounded-full transition-[left]"
        style={{
          left: checked ? "16px" : "2px",
          background: checked ? "var(--color-on-accent)" : "var(--color-text-muted)",
        }}
      />
    </button>
  );
}

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center overflow-hidden rounded-sm border border-border-strong">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="grid h-6 w-6 place-items-center bg-bg-editor text-ui text-text-tertiary hover:text-text-primary"
      >
        −
      </button>
      <span className="w-8.5 text-center font-mono text-ui text-text-primary">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="grid h-6 w-6 place-items-center bg-bg-editor text-ui text-text-tertiary hover:text-text-primary"
      >
        +
      </button>
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 border-b border-border-subtle py-2.75">
      <div className="min-w-0">
        <div className="text-ui text-text-primary">{label}</div>
        <div className="mt-0.5 text-xs text-text-muted">{description}</div>
      </div>
      <div className="ml-auto flex-none">{children}</div>
    </div>
  );
}

function KeyRow({ label, description, value }: { label: string; description: string; value: string }) {
  return (
    <div className="flex items-center gap-4 border-b border-border-subtle py-2.75">
      <div className="min-w-0">
        <div className="text-ui text-text-primary">{label}</div>
        <div className="mt-0.5 text-xs text-text-muted">{description}</div>
      </div>
      <div className="ml-auto flex-none rounded-sm border border-border-strong bg-bg-editor px-2 py-1 font-mono text-ui text-text-tertiary">
        {value}
      </div>
    </div>
  );
}

const THEMES: { id: EditorTheme; name: string; available: boolean }[] = [
  { id: "dark", name: "Dark", available: true },
  { id: "dim", name: "Dim", available: false },
  { id: "light", name: "Light", available: false },
];

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [category, setCategory] = useState<Category>("Editor");

  return (
    <Modal open={open} onClose={onClose} title="Settings" maxWidthClassName="max-w-[720px]">
      <div className="flex h-120 max-h-[88vh]">
        <div className="w-46 flex-none border-r border-[#22242A] bg-bg-editor px-2.5 py-4">
          <div className="px-2 pb-3.5 text-[13.5px] font-semibold text-text-primary">Settings</div>
          {CATEGORIES.map((cat) => {
            const available = AVAILABLE.includes(cat);
            return (
              <button
                key={cat}
                disabled={!available}
                onClick={() => setCategory(cat)}
                className={`mb-0.5 flex w-full items-center justify-between rounded-sm px-2.25 py-1.75 text-left text-ui ${
                  !available
                    ? "cursor-not-allowed text-text-faint"
                    : category === cat
                      ? "bg-[#1A1C20] text-text-primary"
                      : "text-text-secondary hover:bg-[#17191D]"
                }`}
              >
                {cat}
                {!available && <span className="text-[9.5px] text-text-faint">Soon</span>}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-auto px-6 py-5.5">
          <div className="mb-1 text-[13.5px] font-semibold text-text-primary">{category}</div>
          <div className="mb-5 text-[12px] text-text-muted">{DESCRIPTIONS[category]}</div>

          {category === "General" && <GeneralSettings />}
          {category === "Editor" && <EditorSettings />}
          {category === "Appearance" && <AppearanceSettings />}
        </div>
      </div>
    </Modal>
  );
}

function GeneralSettings() {
  return (
    <>
      <KeyRow label="Workspace" description="Personal workspace" value="Personal" />
      <KeyRow label="Default stack" description="Applied to new projects" value="HTML / CSS / JS" />
    </>
  );
}

function EditorSettings() {
  const dispatch = useAppDispatch();
  const settings = useAppSelector((state) => state.settings);

  return (
    <>
      <SettingRow label="Font size" description="Editor and gutter type size">
        <Stepper
          value={settings.fontSize}
          min={11}
          max={20}
          onChange={(fontSize) => dispatch(setSettings({ fontSize }))}
        />
      </SettingRow>
      <SettingRow label="Tab size" description="Spaces inserted per indent level">
        <Stepper
          value={settings.tabSize}
          min={2}
          max={8}
          onChange={(tabSize) => dispatch(setSettings({ tabSize }))}
        />
      </SettingRow>
      <SettingRow label="Word wrap" description="Wrap long lines to the viewport width">
        <Toggle
          checked={settings.wordWrap}
          onChange={(wordWrap) => dispatch(setSettings({ wordWrap }))}
        />
      </SettingRow>
      <SettingRow label="Minimap" description="Show the document overview column">
        <Toggle
          checked={settings.minimap}
          onChange={(minimap) => dispatch(setSettings({ minimap }))}
        />
      </SettingRow>
      <SettingRow label="Line numbers" description="Show the gutter">
        <Toggle
          checked={settings.lineNumbers}
          onChange={(lineNumbers) => dispatch(setSettings({ lineNumbers }))}
        />
      </SettingRow>
      <SettingRow label="Auto-save" description="Save and rebuild the preview as you type">
        <Toggle
          checked={settings.autoSave}
          onChange={(autoSave) => dispatch(setSettings({ autoSave }))}
        />
      </SettingRow>
    </>
  );
}

function AppearanceSettings() {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((state) => state.settings.theme);

  return (
    <SettingRow label="Theme" description="Dim and Light ship in a future release">
      <div className="flex gap-1">
        {THEMES.map((option) => (
          <button
            key={option.id}
            disabled={!option.available}
            onClick={() => dispatch(setSettings({ theme: option.id }))}
            title={option.available ? option.name : "Not available yet"}
            className={`rounded-sm border px-2.25 py-1 text-ui ${
              !option.available
                ? "cursor-not-allowed border-border-subtle text-text-faint"
                : theme === option.id
                  ? "border-accent bg-accent text-on-accent"
                  : "border-border-strong bg-bg-editor text-text-primary"
            }`}
          >
            {option.name}
          </button>
        ))}
      </div>
    </SettingRow>
  );
}
