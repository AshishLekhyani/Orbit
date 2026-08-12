import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface OpenTab {
  fileId: string;
  path: string;
}

interface CursorPosition {
  line: number;
  column: number;
}

interface EditorState {
  openTabs: OpenTab[];
  activeFileId: string | null;
  cursor: CursorPosition;
  findOpen: boolean;
  searchOpen: boolean;
}

const initialState: EditorState = {
  openTabs: [],
  activeFileId: null,
  cursor: { line: 1, column: 1 },
  findOpen: false,
  searchOpen: false,
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
    setFindOpen(state, action: PayloadAction<boolean>) {
      state.findOpen = action.payload;
    },
    setSearchOpen(state, action: PayloadAction<boolean>) {
      state.searchOpen = action.payload;
    },
  },
});

export const { openTab, closeTab, setActiveFile, setCursor, setFindOpen, setSearchOpen } =
  editorSlice.actions;

export default editorSlice.reducer;
