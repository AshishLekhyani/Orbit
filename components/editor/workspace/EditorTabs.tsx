"use client";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { closeTab, setActiveFile } from "@/store/slices/editorSlice";
import { setSettings } from "@/store/slices/settingsSlice";

interface EditorTabsProps {
  onFindInFile: () => void;
}

export function EditorTabs({ onFindInFile }: EditorTabsProps) {
  const dispatch = useAppDispatch();
  const openTabs = useAppSelector((state) => state.editor.openTabs);
  const activeFileId = useAppSelector((state) => state.editor.activeFileId);
  const dirtyFileIds = useAppSelector((state) => state.editor.dirtyFileIds);
  const minimap = useAppSelector((state) => state.settings.minimap);

  if (openTabs.length === 0) return null;

  return (
    <div className="flex h-8.75 flex-none items-stretch overflow-x-auto border-b border-border-subtle bg-bg-panel">
      {openTabs.map((tab) => {
        const isActive = tab.fileId === activeFileId;
        const isDirty = dirtyFileIds.includes(tab.fileId);
        const name = tab.path.split("/").pop() ?? tab.path;
        return (
          <div
            key={tab.fileId}
            onClick={() => dispatch(setActiveFile(tab.fileId))}
            className="flex cursor-pointer items-center gap-2 border-r border-border-subtle py-0 pr-2.5 pl-3.25 whitespace-nowrap hover:bg-[#17191D]"
            style={{
              background: isActive ? "#101114" : "transparent",
              boxShadow: isActive ? "inset 0 2px 0 var(--color-accent)" : "none",
            }}
          >
            <span className="text-ui" style={{ color: isActive ? "#E9E8E4" : "#7A7C82" }}>
              {name}
            </span>
            <span
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                dispatch(closeTab(tab.fileId));
              }}
              className="w-3.5 rounded-xs text-center text-ui hover:bg-border-strong hover:text-text-primary"
              style={{ color: isDirty ? "var(--color-accent)" : "#55585E" }}
            >
              {isDirty ? "●" : "✕"}
            </span>
          </div>
        );
      })}
      <div className="flex-1" />
      <button
        onClick={onFindInFile}
        title="Find in file  ⌘F"
        className="flex-none px-2 text-[11px] text-text-muted hover:text-text-primary"
      >
        ⌕
      </button>
      <button
        onClick={() => dispatch(setSettings({ minimap: !minimap }))}
        title="Toggle minimap"
        className="flex-none px-2.5 text-[11px] text-text-muted hover:text-text-primary"
      >
        ▥
      </button>
    </div>
  );
}
