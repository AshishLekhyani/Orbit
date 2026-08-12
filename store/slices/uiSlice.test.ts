import { describe, expect, it } from "vitest";
import reducer, {
  setActiveModal,
  setExplorerWidth,
  toggleExplorer,
  togglePreview,
} from "./uiSlice";

describe("uiSlice", () => {
  it("toggles explorer visibility from the default open state", () => {
    const state = reducer(undefined, toggleExplorer());
    expect(state.explorerOpen).toBe(false);

    const reopened = reducer(state, toggleExplorer());
    expect(reopened.explorerOpen).toBe(true);
  });

  it("toggles preview independently of explorer", () => {
    const state = reducer(undefined, togglePreview());
    expect(state.previewOpen).toBe(false);
    expect(state.explorerOpen).toBe(true);
  });

  it("clamps nothing but stores the requested explorer width verbatim", () => {
    const state = reducer(undefined, setExplorerWidth(300));
    expect(state.explorerWidth).toBe(300);
  });

  it("sets and clears the active modal", () => {
    const opened = reducer(undefined, setActiveModal("share"));
    expect(opened.activeModal).toBe("share");

    const closed = reducer(opened, setActiveModal(null));
    expect(closed.activeModal).toBeNull();
  });
});
