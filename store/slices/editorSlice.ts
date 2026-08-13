import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface OpenTab {
  fileId: string;
  path: string;
}

interface CursorPosition {
  line: number;
  column: number;
}

export type SaveState = "idle" | "saving" | "saved" | "error";

interface EditorState {
  openTabs: OpenTab[];
  activeFileId: string | null;
  cursor: CursorPosition;
  searchOpen: boolean;
  dirtyFileIds: string[];
  saveState: SaveState;
  liveContent: Record<string, string>;
}

const initialState: EditorState = {
  openTabs: [],
  activeFileId: null,
  cursor: { line: 1, column: 1 },
  searchOpen: false,
  dirtyFileIds: [],
  saveState: "idle",
  liveContent: {},
};

const editorSlice = createSlice({
  name: "editor",
  initialState,
  reducers: {
    openTab(state, action: PayloadAction<OpenTab>) {
      if (!state.openTabs.some((tab) => tab.fileId === action.payload.fileId)) {
        state.openTabs.push(action.payload);
      }
      state.activeFileId = action.payload.fileId;
    },
    closeTab(state, action: PayloadAction<string>) {
      const closingIndex = state.openTabs.findIndex((tab) => tab.fileId === action.payload);
      if (closingIndex === -1) return;
      state.openTabs.splice(closingIndex, 1);
      if (state.activeFileId === action.payload) {
        const fallback = state.openTabs[closingIndex] ?? state.openTabs[closingIndex - 1];
        state.activeFileId = fallback?.fileId ?? null;
      }
    },
    setActiveFile(state, action: PayloadAction<string | null>) {
      state.activeFileId = action.payload;
    },
    setCursor(state, action: PayloadAction<CursorPosition>) {
      state.cursor = action.payload;
    },
    setSearchOpen(state, action: PayloadAction<boolean>) {
      state.searchOpen = action.payload;
    },
    markDirty(state, action: PayloadAction<string>) {
      if (!state.dirtyFileIds.includes(action.payload)) {
        state.dirtyFileIds.push(action.payload);
      }
    },
    markClean(state, action: PayloadAction<string>) {
      state.dirtyFileIds = state.dirtyFileIds.filter((id) => id !== action.payload);
    },
    setSaveState(state, action: PayloadAction<SaveState>) {
      state.saveState = action.payload;
    },
    setLiveContent(state, action: PayloadAction<{ path: string; content: string }>) {
      state.liveContent[action.payload.path] = action.payload.content;
    },
    updateTabPath(state, action: PayloadAction<{ fileId: string; path: string }>) {
      const tab = state.openTabs.find((entry) => entry.fileId === action.payload.fileId);
      if (tab) tab.path = action.payload.path;
    },
  },
});

export const {
  openTab,
  closeTab,
  setActiveFile,
  setCursor,
  setSearchOpen,
  markDirty,
  markClean,
  setSaveState,
  setLiveContent,
  updateTabPath,
} = editorSlice.actions;

export default editorSlice.reducer;
