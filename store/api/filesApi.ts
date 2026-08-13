import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

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

export const filesApi = createApi({
  reducerPath: "filesApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api/projects" }),
  tagTypes: ["FileTree", "FileContent"],
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
    getFile: builder.query<FileWithContent, { projectId: string; fileId: string }>({
      query: ({ projectId, fileId }) => `/${projectId}/files/${fileId}`,
      transformResponse: (response: { file: FileWithContent }) => response.file,
      providesTags: (_result, _error, arg) => [{ type: "FileContent", id: arg.fileId }],
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
      invalidatesTags: (_result, _error, arg) => [
        { type: "FileTree", id: "LIST" },
        { type: "FileContent", id: arg.fileId },
      ],
    }),
    saveFileContent: builder.mutation<
      FileWithContent,
      { projectId: string; fileId: string; content: string }
    >({
      query: ({ projectId, fileId, content }) => ({
        url: `/${projectId}/files/${fileId}`,
        method: "PATCH",
        body: { content },
      }),
      transformResponse: (response: { file: FileWithContent }) => response.file,
    }),
    deleteFile: builder.mutation<void, { projectId: string; fileId: string }>({
      query: ({ projectId, fileId }) => ({
        url: `/${projectId}/files/${fileId}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "FileTree", id: "LIST" }],
    }),
    duplicateFile: builder.mutation<FileWithContent, { projectId: string; fileId: string }>({
      query: ({ projectId, fileId }) => ({
        url: `/${projectId}/files/${fileId}/duplicate`,
        method: "POST",
      }),
      transformResponse: (response: { file: FileWithContent }) => response.file,
      invalidatesTags: [{ type: "FileTree", id: "LIST" }],
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
  }),
});

export const {
  useGetFilesQuery,
  useGetFileQuery,
  useCreateFileMutation,
  useRenameFileMutation,
  useSaveFileContentMutation,
  useDeleteFileMutation,
  useDuplicateFileMutation,
  useLazySearchFilesQuery,
} = filesApi;
