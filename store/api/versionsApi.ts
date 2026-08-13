import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export type ChangeType = "ADDED" | "MODIFIED" | "DELETED";

export interface FileDiffSummary {
  path: string;
  changeType: ChangeType;
  additions: number;
  deletions: number;
}

export interface VersionAuthor {
  id: string;
  displayName: string | null;
  email: string;
  avatarUrl: string | null;
}

export interface VersionSummary {
  id: string;
  message: string;
  createdAt: string;
  author: VersionAuthor | null;
  files: FileDiffSummary[];
  additions: number;
  deletions: number;
}

export interface VersionDetail {
  id: string;
  message: string;
  createdAt: string;
  author: VersionAuthor | null;
  files: FileDiffSummary[];
}

export interface FileDiffDetail extends FileDiffSummary {
  oldContent: string;
  newContent: string;
}

export const versionsApi = createApi({
  reducerPath: "versionsApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api/projects" }),
  tagTypes: ["Versions"],
  endpoints: (builder) => ({
    getVersions: builder.query<VersionSummary[], string>({
      query: (projectId) => `/${projectId}/versions`,
      transformResponse: (response: { versions: VersionSummary[] }) => response.versions,
      providesTags: [{ type: "Versions", id: "LIST" }],
    }),
    getVersionDetail: builder.query<VersionDetail, { projectId: string; versionId: string }>({
      query: ({ projectId, versionId }) => `/${projectId}/versions/${versionId}`,
      transformResponse: (response: { version: VersionDetail }) => response.version,
    }),
    getVersionFileDiff: builder.query<
      FileDiffDetail,
      { projectId: string; versionId: string; path: string }
    >({
      query: ({ projectId, versionId, path }) => ({
        url: `/${projectId}/versions/${versionId}/diff`,
        params: { path },
      }),
      transformResponse: (response: { diff: FileDiffDetail }) => response.diff,
    }),
    createVersion: builder.mutation<{ version: VersionSummary }, { projectId: string; message: string }>({
      query: ({ projectId, message }) => ({
        url: `/${projectId}/versions`,
        method: "POST",
        body: { message },
      }),
      invalidatesTags: [{ type: "Versions", id: "LIST" }],
    }),
    restoreVersion: builder.mutation<void, { projectId: string; versionId: string }>({
      query: ({ projectId, versionId }) => ({
        url: `/${projectId}/versions/${versionId}/restore`,
        method: "POST",
      }),
      invalidatesTags: [{ type: "Versions", id: "LIST" }],
    }),
  }),
});

export const {
  useGetVersionsQuery,
  useGetVersionDetailQuery,
  useGetVersionFileDiffQuery,
  useCreateVersionMutation,
  useRestoreVersionMutation,
} = versionsApi;
