import { describe, expect, it } from "vitest";
import reducer, { openTab, markDirty, updateTabPath, setActiveFile } from "./editorSlice";

describe("editorSlice tab path sync", () => {
  it("updates an open tab's path in place without closing/reopening it", () => {
    const opened = reducer(undefined, openTab({ fileId: "file-1", path: "styles.css" }));
    const dirtied = reducer(opened, markDirty("file-1"));

    const renamed = reducer(dirtied, updateTabPath({ fileId: "file-1", path: "theme.css" }));

    expect(renamed.openTabs).toEqual([{ fileId: "file-1", path: "theme.css" }]);
    expect(renamed.activeFileId).toBe("file-1");
    expect(renamed.dirtyFileIds).toContain("file-1");
  });

  it("preserves tab order, other open tabs, and active tab when one path changes", () => {
    let state = reducer(undefined, openTab({ fileId: "file-1", path: "index.html" }));
    state = reducer(state, openTab({ fileId: "file-2", path: "styles.css" }));
    state = reducer(state, openTab({ fileId: "file-3", path: "script.js" }));
    state = reducer(state, setActiveFile("file-2"));

    const renamed = reducer(state, updateTabPath({ fileId: "file-2", path: "theme.css" }));

    expect(renamed.openTabs).toEqual([
      { fileId: "file-1", path: "index.html" },
      { fileId: "file-2", path: "theme.css" },
      { fileId: "file-3", path: "script.js" },
    ]);
    expect(renamed.activeFileId).toBe("file-2");
  });

  it("leaves state untouched when the renamed file has no open tab", () => {
    const state = reducer(undefined, openTab({ fileId: "file-1", path: "index.html" }));
    const result = reducer(state, updateTabPath({ fileId: "file-unrelated", path: "elsewhere.txt" }));
    expect(result).toEqual(state);
  });

  it("rolling back to the previous path restores the exact original tab state", () => {
    const opened = reducer(undefined, openTab({ fileId: "file-1", path: "styles.css" }));
    const dirtied = reducer(opened, markDirty("file-1"));

    const optimistic = reducer(dirtied, updateTabPath({ fileId: "file-1", path: "broken.css" }));
    const rolledBack = reducer(optimistic, updateTabPath({ fileId: "file-1", path: "styles.css" }));

    expect(rolledBack).toEqual(dirtied);
  });
});
