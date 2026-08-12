import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type ModalId = "share" | "settings" | "history" | "newProject" | null;

interface UiState {
  explorerOpen: boolean;
  previewOpen: boolean;
  bottomPanelOpen: boolean;
  explorerWidth: number;
  previewWidth: number;
  bottomPanelHeight: number;
  commandPaletteOpen: boolean;
  activeModal: ModalId;
}

const initialState: UiState = {
  explorerOpen: true,
  previewOpen: true,
  bottomPanelOpen: true,
  explorerWidth: 236,
  previewWidth: 520,
  bottomPanelHeight: 184,
  commandPaletteOpen: false,
  activeModal: null,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    toggleExplorer(state) {
      state.explorerOpen = !state.explorerOpen;
    },
    togglePreview(state) {
      state.previewOpen = !state.previewOpen;
    },
    toggleBottomPanel(state) {
      state.bottomPanelOpen = !state.bottomPanelOpen;
    },
    setExplorerWidth(state, action: PayloadAction<number>) {
      state.explorerWidth = action.payload;
    },
    setPreviewWidth(state, action: PayloadAction<number>) {
      state.previewWidth = action.payload;
    },
    setBottomPanelHeight(state, action: PayloadAction<number>) {
      state.bottomPanelHeight = action.payload;
    },
    setCommandPaletteOpen(state, action: PayloadAction<boolean>) {
      state.commandPaletteOpen = action.payload;
    },
    setActiveModal(state, action: PayloadAction<ModalId>) {
      state.activeModal = action.payload;
    },
  },
});

export const {
  toggleExplorer,
  togglePreview,
  toggleBottomPanel,
  setExplorerWidth,
  setPreviewWidth,
  setBottomPanelHeight,
  setCommandPaletteOpen,
  setActiveModal,
} = uiSlice.actions;

export default uiSlice.reducer;
