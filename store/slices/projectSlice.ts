import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ProjectRole } from "@prisma/client";

interface ProjectState {
  id: string | null;
  name: string | null;
  role: ProjectRole | null;
  expandedFolderIds: string[];
}

const initialState: ProjectState = {
  id: null,
  name: null,
  role: null,
  expandedFolderIds: [],
};

const projectSlice = createSlice({
  name: "project",
  initialState,
  reducers: {
    setActiveProject(
      state,
      action: PayloadAction<{ id: string; name: string; role: ProjectRole }>,
    ) {
      state.id = action.payload.id;
      state.name = action.payload.name;
      state.role = action.payload.role;
      state.expandedFolderIds = [];
    },
    clearActiveProject(state) {
      state.id = null;
      state.name = null;
      state.role = null;
      state.expandedFolderIds = [];
    },
    toggleFolderExpanded(state, action: PayloadAction<string>) {
      const index = state.expandedFolderIds.indexOf(action.payload);
      if (index === -1) {
        state.expandedFolderIds.push(action.payload);
      } else {
        state.expandedFolderIds.splice(index, 1);
      }
    },
  },
});

export const { setActiveProject, clearActiveProject, toggleFolderExpanded } =
  projectSlice.actions;

export default projectSlice.reducer;
