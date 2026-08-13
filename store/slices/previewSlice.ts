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

export interface PreviewError {
  text: string;
  file: string;
  line: number;
}

interface PreviewState {
  device: PreviewDevice;
  zoom: number;
  isLoading: boolean;
  error: PreviewError | null;
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
  error: null,
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
    setError(state, action: PayloadAction<PreviewError | null>) {
      state.error = action.payload;
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
    },
    startRun(state) {
      state.isLoading = true;
      state.error = null;
      state.console = [];
      state.problems = state.problems.filter((problem) => problem.severity !== "error");
    },
    appendOutput(state, action: PayloadAction<string>) {
      state.output.push(action.payload);
      if (state.output.length > MAX_CONSOLE_ENTRIES) {
        state.output.splice(0, state.output.length - MAX_CONSOLE_ENTRIES);
      }
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
  startRun,
  appendOutput,
} = previewSlice.actions;

export default previewSlice.reducer;
