import { configureStore } from "@reduxjs/toolkit";
import uiReducer from "./slices/uiSlice";
import editorReducer from "./slices/editorSlice";
import projectReducer from "./slices/projectSlice";
import previewReducer from "./slices/previewSlice";
import collaborationReducer from "./slices/collaborationSlice";
import settingsReducer from "./slices/settingsSlice";
import { projectsApi } from "./api/projectsApi";
import { filesApi } from "./api/filesApi";
import { sharingApi } from "./api/sharingApi";
import { versionsApi } from "./api/versionsApi";

export function makeStore() {
  return configureStore({
    reducer: {
      ui: uiReducer,
      editor: editorReducer,
      project: projectReducer,
      preview: previewReducer,
      collaboration: collaborationReducer,
      settings: settingsReducer,
      [projectsApi.reducerPath]: projectsApi.reducer,
      [filesApi.reducerPath]: filesApi.reducer,
      [sharingApi.reducerPath]: sharingApi.reducer,
      [versionsApi.reducerPath]: versionsApi.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(
        projectsApi.middleware,
        filesApi.middleware,
        sharingApi.middleware,
        versionsApi.middleware,
      ),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
