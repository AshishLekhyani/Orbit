import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { detectFileType, joinPath, withCopySuffix } from "@/lib/fileMeta";
import { updateTabPath } from "@/store/slices/editorSlice";
import type { RootState } from "@/store";

export interface FileNode {
  id: string;
  path: string;
  name: string;
  type: string;
  isDirectory: boolean;
  parentId: string | null;
  updatedAt: string;
}

export interface FileWithContent extends FileNode {
  content: string;
  projectId: string;
  createdAt: string;
}

export interface FileSearchMatch {
  line: number;
  text: string;
}

export interface FileSearchResult {
  fileId: string;
  path: string;
  matches: FileSearchMatch[];
}

export interface BundleFile {
  path: string;
  content: string;
  type: string;
}

export const filesApi = createApi({
  reducerPath: "filesApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api/projects" }),
  tagTypes: ["FileTree"],
  endpoints: (builder) => ({
    getFiles: builder.query<FileNode[], string>({
      query: (projectId) => `/${projectId}/files`,
      transformResponse: (response: { files: FileNode[] }) => response.files,
      providesTags: (result) =>
        result
          ? [
              ...result.map((file) => ({ type: "FileTree" as const, id: file.id })),
              { type: "FileTree" as const, id: "LIST" },
            ]
          : [{ type: "FileTree" as const, id: "LIST" }],
    }),
    getFileSnapshot: builder.query<
      { content: string; yjsState: string | null },
      { projectId: string; fileId: string }
    >({
      query: ({ projectId, fileId }) => `/${projectId}/files/${fileId}/snapshot`,
    }),
    saveFileSnapshot: builder.mutation<
      void,
      { projectId: string; fileId: string; content: string; yjsState: string }
    >({
      query: ({ projectId, fileId, content, yjsState }) => ({
        url: `/${projectId}/files/${fileId}/snapshot`,
        method: "PUT",
        body: { content, yjsState },
      }),
    }),
    createFile: builder.mutation<
      FileWithContent,
      { projectId: string; name: string; parentId: string | null; isDirectory: boolean }
    >({
      query: ({ projectId, ...body }) => ({
        url: `/${projectId}/files`,
        method: "POST",
        body,
      }),
      transformResponse: (response: { file: FileWithContent }) => response.file,
      invalidatesTags: [{ type: "FileTree", id: "LIST" }],
      async onQueryStarted({ projectId, name, parentId, isDirectory }, { dispatch, queryFulfilled, getState }) {
        const cached = filesApi.endpoints.getFiles.select(projectId)(getState()).data ?? [];
        const parent = parentId ? cached.find((file) => file.id === parentId) : undefined;
        const path = joinPath(parent?.path ?? null, name);
        const tempId = `optimistic-${Math.random().toString(36).slice(2)}`;

        const patchResult = dispatch(
          filesApi.util.updateQueryData("getFiles", projectId, (draft) => {
            draft.push({
              id: tempId,
              path,
              name,
              type: isDirectory ? "OTHER" : detectFileType(name),
              isDirectory,
              parentId,
              updatedAt: new Date().toISOString(),
            });
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
    }),
    renameFile: builder.mutation<
      FileWithContent,
      { projectId: string; fileId: string; name?: string; parentId?: string | null }
    >({
      query: ({ projectId, fileId, ...body }) => ({
        url: `/${projectId}/files/${fileId}`,
        method: "PATCH",
        body,
      }),
      transformResponse: (response: { file: FileWithContent }) => response.file,
      invalidatesTags: [{ type: "FileTree", id: "LIST" }],
      async onQueryStarted({ projectId, fileId, name, parentId }, { dispatch, queryFulfilled, getState }) {
        const cached = filesApi.endpoints.getFiles.select(projectId)(getState()).data ?? [];
        const current = cached.find((file) => file.id === fileId);
        if (!current) return;

        const nextName = name?.trim() || current.name;
        const nextParentId = parentId !== undefined ? parentId : current.parentId;
        const parent = nextParentId ? cached.find((file) => file.id === nextParentId) : undefined;
        const nextPath = joinPath(parent?.path ?? null, nextName);

        const patchResult = dispatch(
          filesApi.util.updateQueryData("getFiles", projectId, (draft) => {
            const target = draft.find((file) => file.id === fileId);
            if (target) {
              target.name = nextName;
              target.parentId = nextParentId;
              target.path = nextPath;
            }
          }),
        );

        const openTab = (getState() as RootState).editor.openTabs.find((tab) => tab.fileId === fileId);
        const previousPath = openTab?.path;
        if (openTab && previousPath !== nextPath) {
          dispatch(updateTabPath({ fileId, path: nextPath }));
        }

        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
          if (openTab && previousPath !== undefined && previousPath !== nextPath) {
            dispatch(updateTabPath({ fileId, path: previousPath }));
          }
        }
      },
    }),
    deleteFile: builder.mutation<void, { projectId: string; fileId: string }>({
      query: ({ projectId, fileId }) => ({
        url: `/${projectId}/files/${fileId}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "FileTree", id: "LIST" }],
      async onQueryStarted({ projectId, fileId }, { dispatch, queryFulfilled, getState }) {
        const cached = filesApi.endpoints.getFiles.select(projectId)(getState()).data ?? [];
        const target = cached.find((file) => file.id === fileId);

        const patchResult = dispatch(
          filesApi.util.updateQueryData("getFiles", projectId, (draft) => {
            const removePrefix = target ? `${target.path}/` : null;
            return draft.filter((file) => file.id !== fileId && !(removePrefix && file.path.startsWith(removePrefix)));
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
    }),
    duplicateFile: builder.mutation<FileWithContent, { projectId: string; fileId: string }>({
      query: ({ projectId, fileId }) => ({
        url: `/${projectId}/files/${fileId}/duplicate`,
        method: "POST",
      }),
      transformResponse: (response: { file: FileWithContent }) => response.file,
      invalidatesTags: [{ type: "FileTree", id: "LIST" }],
      async onQueryStarted({ projectId, fileId }, { dispatch, queryFulfilled, getState }) {
        const cached = filesApi.endpoints.getFiles.select(projectId)(getState()).data ?? [];
        const source = cached.find((file) => file.id === fileId);
        if (!source || source.isDirectory) return;

        const name = withCopySuffix(source.name);
        const parent = source.parentId ? cached.find((file) => file.id === source.parentId) : undefined;
        const path = joinPath(parent?.path ?? null, name);
        const tempId = `optimistic-${Math.random().toString(36).slice(2)}`;

        const patchResult = dispatch(
          filesApi.util.updateQueryData("getFiles", projectId, (draft) => {
            draft.push({
              id: tempId,
              path,
              name,
              type: source.type,
              isDirectory: false,
              parentId: source.parentId,
              updatedAt: new Date().toISOString(),
            });
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
    }),
    searchFiles: builder.query<
      FileSearchResult[],
      { projectId: string; query: string; caseSensitive?: boolean; wholeWord?: boolean }
    >({
      query: ({ projectId, query, caseSensitive, wholeWord }) => ({
        url: `/${projectId}/files/search`,
        params: {
          q: query,
          caseSensitive: caseSensitive ? "1" : undefined,
          wholeWord: wholeWord ? "1" : undefined,
        },
      }),
      transformResponse: (response: { results: FileSearchResult[] }) => response.results,
    }),
    getFileBundle: builder.query<BundleFile[], string>({
      query: (projectId) => `/${projectId}/files/bundle`,
      transformResponse: (response: { files: BundleFile[] }) => response.files,
      providesTags: [{ type: "FileTree", id: "LIST" }],
    }),
  }),
});

export const {
  useGetFilesQuery,
  useGetFileSnapshotQuery,
  useSaveFileSnapshotMutation,
  useCreateFileMutation,
  useRenameFileMutation,
  useDeleteFileMutation,
  useDuplicateFileMutation,
  useLazySearchFilesQuery,
  useGetFileBundleQuery,
} = filesApi;
