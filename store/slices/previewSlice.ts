import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type PreviewDevice = "desktop" | "tablet" | "mobile";
export type BottomTab = "console" | "problems" | "output";

export interface ConsoleEntry {
  id: string;
  type: "log" | "info" | "warn" | "error";
  text: string;
  file?: string;
  line?: number;
}

export interface ProblemEntry {
  id: string;
  severity: "warn" | "error";
  file: string;
  line: number;
  text: string;
}

interface PreviewState {
  device: PreviewDevice;
  zoom: number;
  isLoading: boolean;
  errorText: string | null;
  activeBottomTab: BottomTab;
  console: ConsoleEntry[];
  problems: ProblemEntry[];
  output: string[];
}

const MAX_CONSOLE_ENTRIES = 500;

const initialState: PreviewState = {
  device: "desktop",
  zoom: 100,
  isLoading: true,
  errorText: null,
  activeBottomTab: "console",
  console: [],
  problems: [],
  output: [],
};

const previewSlice = createSlice({
  name: "preview",
  initialState,
  reducers: {
    setDevice(state, action: PayloadAction<PreviewDevice>) {
      state.device = action.payload;
    },
    setZoom(state, action: PayloadAction<number>) {
      state.zoom = action.payload;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.errorText = action.payload;
    },
    setActiveBottomTab(state, action: PayloadAction<BottomTab>) {
      state.activeBottomTab = action.payload;
    },
    appendConsoleEntry(state, action: PayloadAction<ConsoleEntry>) {
      state.console.push(action.payload);
      if (state.console.length > MAX_CONSOLE_ENTRIES) {
        state.console.splice(0, state.console.length - MAX_CONSOLE_ENTRIES);
      }
    },
    setProblems(state, action: PayloadAction<ProblemEntry[]>) {
      state.problems = action.payload;
    },
    clearConsole(state) {
      state.console = [];
      state.output = [];
    },
  },
});

export const {
  setDevice,
  setZoom,
  setLoading,
  setError,
  setActiveBottomTab,
  appendConsoleEntry,
  setProblems,
  clearConsole,
} = previewSlice.actions;

export default previewSlice.reducer;
