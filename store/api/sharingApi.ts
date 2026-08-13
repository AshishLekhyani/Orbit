import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export type ShareRole = "EDITOR" | "VIEWER";

export interface ProjectOwnerInfo {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface ProjectMemberInfo {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: ShareRole;
}

export interface ShareLinkInfo {
  id: string;
  token: string;
  permission: ShareRole;
  expiresAt: string | null;
  createdAt: string;
}

export const sharingApi = createApi({
  reducerPath: "sharingApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api/projects" }),
  tagTypes: ["Members", "ShareLink"],
  endpoints: (builder) => ({
    getMembers: builder.query<{ owner: ProjectOwnerInfo; members: ProjectMemberInfo[] }, string>({
      query: (projectId) => `/${projectId}/members`,
      providesTags: [{ type: "Members", id: "LIST" }],
    }),
    inviteMember: builder.mutation<
      { member: ProjectMemberInfo },
      { projectId: string; email: string; role: ShareRole }
    >({
      query: ({ projectId, ...body }) => ({ url: `/${projectId}/members`, method: "POST", body }),
      invalidatesTags: [{ type: "Members", id: "LIST" }],
    }),
    updateMemberRole: builder.mutation<
      void,
      { projectId: string; memberId: string; role: ShareRole }
    >({
      query: ({ projectId, memberId, role }) => ({
        url: `/${projectId}/members/${memberId}`,
        method: "PATCH",
        body: { role },
      }),
      invalidatesTags: [{ type: "Members", id: "LIST" }],
    }),
    removeMember: builder.mutation<void, { projectId: string; memberId: string }>({
      query: ({ projectId, memberId }) => ({
        url: `/${projectId}/members/${memberId}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "Members", id: "LIST" }],
    }),
    getShareLink: builder.query<{ link: ShareLinkInfo | null }, string>({
      query: (projectId) => `/${projectId}/share-links`,
      providesTags: [{ type: "ShareLink", id: "CURRENT" }],
    }),
    setShareLink: builder.mutation<{ link: ShareLinkInfo }, { projectId: string; permission: ShareRole }>({
      query: ({ projectId, permission }) => ({
        url: `/${projectId}/share-links`,
        method: "POST",
        body: { permission },
      }),
      invalidatesTags: [{ type: "ShareLink", id: "CURRENT" }],
    }),
    revokeShareLink: builder.mutation<void, string>({
      query: (projectId) => ({ url: `/${projectId}/share-links`, method: "DELETE" }),
      invalidatesTags: [{ type: "ShareLink", id: "CURRENT" }],
    }),
    regenerateShareLink: builder.mutation<{ link: ShareLinkInfo }, string>({
      query: (projectId) => ({ url: `/${projectId}/share-links/regenerate`, method: "POST" }),
      invalidatesTags: [{ type: "ShareLink", id: "CURRENT" }],
    }),
  }),
});

export const {
  useGetMembersQuery,
  useInviteMemberMutation,
  useUpdateMemberRoleMutation,
  useRemoveMemberMutation,
  useGetShareLinkQuery,
  useSetShareLinkMutation,
  useRevokeShareLinkMutation,
  useRegenerateShareLinkMutation,
} = sharingApi;
