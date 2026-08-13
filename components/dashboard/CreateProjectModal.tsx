"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/shared/Button";
import { useCreateProjectMutation } from "@/store/api/projectsApi";

export type Template = "blank" | "landing-page";

const TEMPLATES: { id: Template; name: string; note: string }[] = [
  { id: "landing-page", name: "Landing Page", note: "Recommended" },
  { id: "blank", name: "Blank", note: "Empty project" },
];

const STACKS: { name: string; note: string; available: boolean }[] = [
  { name: "HTML / CSS / JS", note: "Recommended", available: true },
  { name: "React", note: "Coming soon", available: false },
  { name: "TypeScript", note: "Coming soon", available: false },
];

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  initialTemplate?: Template;
}

export function CreateProjectModal({ open, onClose, initialTemplate }: CreateProjectModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Create project" maxWidthClassName="max-w-[480px]">
      {open && (
        <CreateProjectForm
          key={initialTemplate ?? "landing-page"}
          onClose={onClose}
          initialTemplate={initialTemplate}
        />
      )}
    </Modal>
  );
}

function CreateProjectForm({
  onClose,
  initialTemplate,
}: {
  onClose: () => void;
  initialTemplate?: Template;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [template, setTemplate] = useState<Template>(initialTemplate ?? "landing-page");
  const [createProject, { isLoading }] = useCreateProjectMutation();

  async function handleCreate() {
    const result = await createProject({ name: name || "Untitled project", template }).unwrap();
    setName("");
    onClose();
    router.push(`/projects/${result.project.id}`);
  }

  return (
    <div className="p-5">
      <div className="text-[14.5px] font-semibold text-text-primary">Create project</div>

      <label htmlFor="project-name" className="mt-4 mb-1.75 block text-xs text-text-tertiary">
        Project name
      </label>
      <input
        id="project-name"
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="My project"
        className="h-9 w-full rounded-btn border border-border-strong bg-bg-editor px-2.75 text-[13px] text-text-primary outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/[0.14]"
      />

      <div className="mt-4 mb-2 text-[10.5px] font-semibold tracking-[0.12em] text-text-muted uppercase">
        Stack
      </div>
      <div className="grid grid-cols-3 gap-2">
        {STACKS.map((stack) => (
          <button
            key={stack.name}
            disabled={!stack.available}
            title={stack.available ? undefined : "Coming soon"}
            className={`rounded-sm border p-2.5 text-left ${
              !stack.available
                ? "cursor-not-allowed border-border-subtle text-text-faint"
                : "border-accent bg-[#1A1C20]"
            }`}
          >
            <div className={`text-xs ${stack.available ? "text-text-primary" : "text-text-faint"}`}>
              {stack.name}
            </div>
            <div className="mt-0.5 text-[10.5px] text-text-faint">{stack.note}</div>
          </button>
        ))}
      </div>

      <div className="mt-4 mb-2 text-[10.5px] font-semibold tracking-[0.12em] text-text-muted uppercase">
        Template
      </div>
      <div className="grid grid-cols-2 gap-2">
        {TEMPLATES.map((option) => (
          <button
            key={option.id}
            onClick={() => setTemplate(option.id)}
            className={`rounded-sm border p-2.5 text-left ${
              template === option.id
                ? "border-accent bg-[#1A1C20]"
                : "border-border-strong bg-bg-editor"
            }`}
          >
            <div className="text-xs text-text-primary">{option.name}</div>
            <div className="mt-0.5 text-[10.5px] text-text-faint">{option.note}</div>
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-2 border-t border-[#22242A] pt-4">
        <span className="text-[11.5px] text-text-muted">
          HTML / CSS / JS · {TEMPLATES.find((option) => option.id === template)?.name}
        </span>
        <div className="flex-1" />
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleCreate} disabled={isLoading}>
          {isLoading ? "Creating…" : "Create project"}
        </Button>
      </div>
    </div>
  );
}
