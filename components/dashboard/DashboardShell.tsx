"use client";

import { useEffect, useState } from "react";
import { StoreProvider } from "@/store/StoreProvider";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setCommandPaletteOpen } from "@/store/slices/uiSlice";
import { DashboardHeader } from "./DashboardHeader";
import { ProjectCard } from "./ProjectCard";
import { CreateProjectModal, type Template } from "./CreateProjectModal";
import { TemplatesSection } from "./TemplatesSection";
import { DashboardCommandPalette } from "./DashboardCommandPalette";
import { useGetProjectsQuery } from "@/store/api/projectsApi";

type NavFilter = "all" | "shared" | "favorites";

const NAV_ITEMS: { id: NavFilter; label: string }[] = [
  { id: "all", label: "All projects" },
  { id: "shared", label: "Shared with me" },
  { id: "favorites", label: "Favorites" },
];

const SECTION_LABEL: Record<NavFilter, string> = {
  all: "Recent projects",
  shared: "Shared with me",
  favorites: "Favorites",
};

const SECTION_SUBTITLE: Record<NavFilter, string> = {
  all: "Projects you own or collaborate on.",
  shared: "Projects other people have shared with you.",
  favorites: "Projects you've starred.",
};

interface DashboardShellProps {
  email: string;
  displayName: string | null;
  onSignOut: () => void;
}

export function DashboardShell(props: DashboardShellProps) {
  return (
    <StoreProvider>
      <DashboardContent {...props} />
    </StoreProvider>
  );
}

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function firstNameFrom(displayName: string | null, email: string): string | null {
  const fromDisplayName = displayName?.trim().split(/\s+/)[0];
  if (fromDisplayName) return fromDisplayName;
  const local = email.split("@")[0] ?? "";
  const [first] = local.split(/[._-]/).filter(Boolean);
  if (!first) return null;
  return first[0].toUpperCase() + first.slice(1);
}

function DashboardContent({ email, displayName, onSignOut }: DashboardShellProps) {
  const dispatch = useAppDispatch();
  const commandPaletteOpen = useAppSelector((state) => state.ui.commandPaletteOpen);
  const [nav, setNav] = useState<NavFilter>("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createTemplate, setCreateTemplate] = useState<Template | undefined>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [greetingPrefix] = useState(() => greetingForHour(new Date().getHours()));
  const name = firstNameFrom(displayName, email);
  const greeting = name ? `${greetingPrefix}, ${name}.` : `${greetingPrefix}.`;

  const { data: projects, isLoading } = useGetProjectsQuery(nav === "shared" ? "shared" : undefined);

  const filtered = (projects ?? [])
    .filter((project) => (nav === "favorites" ? project.isFavorite : true))
    .filter((project) => project.name.toLowerCase().includes(search.trim().toLowerCase()));

  function openCreate(template?: Template) {
    setCreateTemplate(template);
    setCreateOpen(true);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        dispatch(setCommandPaletteOpen(!commandPaletteOpen));
        return;
      }
      if (event.key === "Escape" && commandPaletteOpen) {
        dispatch(setCommandPaletteOpen(false));
        return;
      }
      if (meta && event.key === ",") {
        event.preventDefault();
        setSettingsOpen(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dispatch, commandPaletteOpen]);

  return (
    <div className="flex min-h-screen flex-col">
      <DashboardHeader
        email={email}
        search={search}
        onSearchChange={setSearch}
        onSignOut={onSignOut}
        settingsOpen={settingsOpen}
        onSettingsOpenChange={setSettingsOpen}
      />

      <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-[188px_1fr]">
        <nav className="border-r border-[#17191D] px-4 py-8">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setNav(item.id)}
              className={`mb-0.5 w-full rounded-sm px-2.5 py-1.75 text-left text-ui hover:bg-[#17191D] ${
                nav === item.id ? "bg-[#1A1C20] text-text-primary" : "text-text-secondary"
              }`}
            >
              {item.label}
            </button>
          ))}
          <div className="my-4.5 h-px bg-border-subtle" />
          <button
            onClick={() => openCreate()}
            className="w-full rounded-sm border border-dashed border-[#2E3036] px-2.5 py-1.75 text-left text-ui text-text-tertiary hover:border-accent hover:text-accent"
          >
            + New project
          </button>
        </nav>

        <main className="px-8 pt-10 pb-16">
          <h1 className="m-0 text-[24px] leading-[1.2] font-semibold tracking-tight text-text-primary">
            {greeting}
          </h1>
          <p className="mt-2 text-body text-text-secondary">{SECTION_SUBTITLE[nav]}</p>

          <div className="mt-10 mb-3.5 flex items-baseline justify-between">
            <h2 className="m-0 text-label text-text-muted uppercase">{SECTION_LABEL[nav]}</h2>
            <span className="text-[12px] text-text-muted">
              {filtered.length} {filtered.length === 1 ? "project" : "projects"}
            </span>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(268px,1fr))] gap-3.5">
              {[1, 2, 3, 4, 5, 6].map((key) => (
                <div
                  key={key}
                  className="h-32 animate-pulse rounded-md border border-[#1F2126] bg-[#131418]"
                />
              ))}
            </div>
          ) : filtered.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(268px,1fr))] gap-3.5">
              {filtered.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <div className="rounded-[10px] border border-dashed border-[#26282D] px-6 py-14 text-center">
              <div className="text-[15px] font-semibold text-text-primary">
                {search ? `No projects match "${search}"` : "Nothing here yet"}
              </div>
              <div className="mt-2 mb-5 text-[13px] text-text-secondary">
                {search
                  ? "Try a different name, or create a project."
                  : "Create your first project and start building."}
              </div>
              {!search && nav === "all" && (
                <button
                  onClick={() => openCreate()}
                  className="rounded-btn bg-accent px-4 py-2 text-[13px] font-medium text-on-accent hover:bg-accent-hover"
                >
                  + New project
                </button>
              )}
            </div>
          )}

          {nav === "all" && <TemplatesSection onSelect={(template) => openCreate(template)} />}
        </main>
      </div>

      <CreateProjectModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        initialTemplate={createTemplate}
      />

      <DashboardCommandPalette
        projects={projects ?? []}
        onNewProject={() => openCreate()}
        onOpenSettings={() => setSettingsOpen(true)}
        onNavFilter={setNav}
      />
    </div>
  );
}
