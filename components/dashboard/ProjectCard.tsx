"use client";

import { useRouter } from "next/navigation";
import type { ProjectSummary } from "@/store/api/projectsApi";
import { useSetFavoriteMutation, useDeleteProjectMutation } from "@/store/api/projectsApi";
import { useToast } from "@/components/shared/ToastProvider";

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < 1) return "Updated just now";
  if (diffMins < 60) return `Updated ${diffMins}m ago`;
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `Updated ${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) return "Updated yesterday";
  if (diffDays < 7) return `Updated ${diffDays}d ago`;
  return `Updated ${date.toLocaleDateString()}`;
}

export function ProjectCard({ project }: { project: ProjectSummary }) {
  const router = useRouter();
  const { toast } = useToast();
  const [setFavorite] = useSetFavoriteMutation();
  const [deleteProject] = useDeleteProjectMutation();

  async function handleDelete(event: React.MouseEvent | React.KeyboardEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!window.confirm(`Delete "${project.name}"? This can't be undone.`)) return;
    try {
      await deleteProject(project.id).unwrap();
      toast("Deleted", project.name);
    } catch {
      toast("Couldn't delete project", undefined, "danger");
    }
  }

  return (
    <button
      onClick={() => router.push(`/projects/${project.id}`)}
      className="group flex min-h-32 flex-col gap-1.5 rounded-md border border-[#1F2126] bg-[#131418] p-4 text-left hover:border-[#33363C] hover:bg-bg-raised"
    >
      <div className="flex items-center justify-between gap-1.5">
        <span className="min-w-0 truncate text-[13.5px] font-semibold text-text-primary">{project.name}</span>
        <div className="flex flex-none items-center gap-1.5">
          {project.isOwner && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleDelete}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") handleDelete(event);
              }}
              className="text-[11px] text-border-strong opacity-0 hover:text-danger-text group-hover:opacity-100"
              aria-label={`Delete ${project.name}`}
              title="Delete project"
            >
              ✕
            </span>
          )}
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              setFavorite({ id: project.id, favorite: !project.isFavorite });
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                setFavorite({ id: project.id, favorite: !project.isFavorite });
              }
            }}
            className={`text-[11px] ${project.isFavorite ? "text-accent" : "text-border-strong hover:text-text-muted"}`}
            aria-label={project.isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            ★
          </span>
        </div>
      </div>
      <span className="font-mono text-[11px] text-text-dim">HTML · CSS · JS</span>
      <span className="flex-1" />
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] text-text-muted">{formatUpdatedAt(project.updatedAt)}</span>
        {project.collaboratorCount > 0 && (
          <span className="text-[11px] text-collab-1">
            ● {project.collaboratorCount} {project.collaboratorCount === 1 ? "collaborator" : "collaborators"}
          </span>
        )}
      </div>
    </button>
  );
}
