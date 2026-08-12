import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type EditorTheme = "dark" | "dim" | "light";

interface SettingsState {
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  lineNumbers: boolean;
  autoSave: boolean;
  theme: EditorTheme;
  showCollaboratorCursors: boolean;
}

export const initialSettingsState: SettingsState = {
  fontSize: 13,
  tabSize: 2,
  wordWrap: false,
  minimap: true,
  lineNumbers: true,
  autoSave: true,
  theme: "dark",
  showCollaboratorCursors: true,
};

const settingsSlice = createSlice({
  name: "settings",
  initialState: initialSettingsState,
  reducers: {
    setSettings(state, action: PayloadAction<Partial<SettingsState>>) {
      Object.assign(state, action.payload);
    },
  },
});

export const { setSettings } = settingsSlice.actions;

export default settingsSlice.reducer;
