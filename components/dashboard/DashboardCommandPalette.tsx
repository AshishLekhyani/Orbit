"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setCommandPaletteOpen } from "@/store/slices/uiSlice";
import { CommandPaletteShell, type PaletteCommand } from "@/components/shared/CommandPaletteShell";
import type { ProjectSummary } from "@/store/api/projectsApi";

type NavFilter = "all" | "shared" | "favorites";

interface DashboardCommandPaletteProps {
  projects: ProjectSummary[];
  onNewProject: () => void;
  onOpenSettings: () => void;
  onNavFilter: (filter: NavFilter) => void;
}

export function DashboardCommandPalette(props: DashboardCommandPaletteProps) {
  const open = useAppSelector((state) => state.ui.commandPaletteOpen);
  const dispatch = useAppDispatch();
  if (!open) return null;
  return (
    <DashboardCommandPaletteContent
      {...props}
      onClose={() => dispatch(setCommandPaletteOpen(false))}
    />
  );
}

function DashboardCommandPaletteContent({
  projects,
  onNewProject,
  onOpenSettings,
  onNavFilter,
  onClose,
}: DashboardCommandPaletteProps & { onClose: () => void }) {
  const router = useRouter();

  const commands: PaletteCommand[] = useMemo(
    () => [
      { id: "new-project", label: "New Project", hint: "Dashboard", icon: "+", run: onNewProject },
      { id: "all-projects", label: "All Projects", hint: "Navigate", icon: "▤", run: () => onNavFilter("all") },
      {
        id: "shared-with-me",
        label: "Shared with Me",
        hint: "Navigate",
        icon: "▤",
        run: () => onNavFilter("shared"),
      },
      { id: "favorites", label: "Favorites", hint: "Navigate", icon: "★", run: () => onNavFilter("favorites") },
      {
        id: "open-settings",
        label: "Open Settings",
        hint: "Workspace",
        key: "⌘,",
        icon: "⚙",
        run: onOpenSettings,
      },
    ],
    [onNewProject, onNavFilter, onOpenSettings],
  );

  const projectItems: PaletteCommand[] = useMemo(
    () =>
      projects.map((project) => ({
        id: `project-${project.id}`,
        label: project.name,
        hint: "Project",
        icon: "⌘",
        run: () => router.push(`/projects/${project.id}`),
      })),
    [projects, router],
  );

  return <CommandPaletteShell commands={commands} extraItems={projectItems} onClose={onClose} />;
}
