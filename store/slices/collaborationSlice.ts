import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type ConnectionState = "synced" | "syncing" | "offline" | "reconnecting";

export interface Collaborator {
  userId: string;
  name: string;
  color: string;
  activeFileId: string | null;
  activeFilePath: string | null;
}

interface CollaborationState {
  connectionState: ConnectionState;
  collaborators: Collaborator[];
  followingUserId: string | null;
}

const initialState: CollaborationState = {
  connectionState: "synced",
  collaborators: [],
  followingUserId: null,
};

const collaborationSlice = createSlice({
  name: "collaboration",
  initialState,
  reducers: {
    setConnectionState(state, action: PayloadAction<ConnectionState>) {
      state.connectionState = action.payload;
    },
    setCollaborators(state, action: PayloadAction<Collaborator[]>) {
      state.collaborators = action.payload;
    },
    setFollowing(state, action: PayloadAction<string | null>) {
      state.followingUserId = action.payload;
    },
  },
});

export const { setConnectionState, setCollaborators, setFollowing } =
  collaborationSlice.actions;

export default collaborationSlice.reducer;
