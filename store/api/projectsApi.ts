import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export interface ProjectSummary {
  id: string;
  name: string;
  stack: string;
  updatedAt: string;
  isOwner: boolean;
  collaboratorCount: number;
  isFavorite: boolean;
}

export type ProjectFilter = "all" | "shared";

export const projectsApi = createApi({
  reducerPath: "projectsApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api" }),
  tagTypes: ["Project"],
  endpoints: (builder) => ({
    getProjects: builder.query<ProjectSummary[], ProjectFilter | undefined>({
      query: (filter) => ({ url: "/projects", params: filter ? { filter } : undefined }),
      transformResponse: (response: { projects: ProjectSummary[] }) => response.projects,
      providesTags: (result) =>
        result
          ? [
              ...result.map((project) => ({ type: "Project" as const, id: project.id })),
              { type: "Project" as const, id: "LIST" },
            ]
          : [{ type: "Project" as const, id: "LIST" }],
    }),
    createProject: builder.mutation<
      { project: { id: string; name: string } },
      { name: string; template: "blank" | "landing-page" }
    >({
      query: (body) => ({ url: "/projects", method: "POST", body }),
      invalidatesTags: [{ type: "Project", id: "LIST" }],
    }),
    renameProject: builder.mutation<void, { id: string; name: string }>({
      query: ({ id, name }) => ({ url: `/projects/${id}`, method: "PATCH", body: { name } }),
      invalidatesTags: (_result, _error, arg) => [
        { type: "Project", id: arg.id },
        { type: "Project", id: "LIST" },
      ],
    }),
    deleteProject: builder.mutation<void, string>({
      query: (id) => ({ url: `/projects/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Project", id: "LIST" }],
    }),
    setFavorite: builder.mutation<void, { id: string; favorite: boolean }>({
      query: ({ id, favorite }) => ({
        url: `/projects/${id}/favorite`,
        method: favorite ? "POST" : "DELETE",
      }),
      async onQueryStarted({ id, favorite }, { dispatch, queryFulfilled }) {
        const patches = [
          dispatch(
            projectsApi.util.updateQueryData("getProjects", undefined, (draft) => {
              const project = draft.find((p) => p.id === id);
              if (project) project.isFavorite = favorite;
            }),
          ),
          dispatch(
            projectsApi.util.updateQueryData("getProjects", "shared", (draft) => {
              const project = draft.find((p) => p.id === id);
              if (project) project.isFavorite = favorite;
            }),
          ),
        ];
        try {
          await queryFulfilled;
        } catch {
          patches.forEach((patch) => patch.undo());
        }
      },
    }),
  }),
});

export const {
  useGetProjectsQuery,
  useCreateProjectMutation,
  useRenameProjectMutation,
  useDeleteProjectMutation,
  useSetFavoriteMutation,
} = projectsApi;
