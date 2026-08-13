"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useToast } from "@/components/shared/ToastProvider";
import { colorForUserId, initialsFor } from "@/lib/collaboratorColor";
import { monacoLanguageFor } from "@/lib/fileMeta";
import { detectFileType } from "@/lib/fileMeta";
import { ORBIT_THEME_NAME, orbitMonacoTheme } from "@/lib/monacoTheme";
import {
  useGetVersionsQuery,
  useGetVersionFileDiffQuery,
  useCreateVersionMutation,
  useRestoreVersionMutation,
  type VersionSummary,
} from "@/store/api/versionsApi";
import type { Monaco } from "@monaco-editor/react";

const DiffEditor = dynamic(
  () => import("@monaco-editor/react").then((mod) => mod.DiffEditor),
  { ssr: false },
);

function formatVersionTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const isSameDay = date.toDateString() === now.toDateString();
  if (isSameDay) return time;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;

  return `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${time}`;
}

function statLabel(additions: number, deletions: number): string {
  return `+${additions} −${deletions}`;
}

interface HistoryPanelProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  canMutate: boolean;
  onRestored: () => void;
}

export function HistoryPanel({ open, onClose, projectId, canMutate, onRestored }: HistoryPanelProps) {
  const { toast } = useToast();
  const { data: versions = [], isLoading } = useGetVersionsQuery(projectId, { skip: !open });
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [createVersion, { isLoading: saving }] = useCreateVersionMutation();
  const [restoreVersion, { isLoading: restoring }] = useRestoreVersionMutation();

  const effectiveVersionId =
    selectedVersionId && versions.some((v) => v.id === selectedVersionId)
      ? selectedVersionId
      : (versions[0]?.id ?? null);
  const selectedVersion = versions.find((v) => v.id === effectiveVersionId) ?? null;

  const effectivePath =
    selectedPath && selectedVersion?.files.some((f) => f.path === selectedPath)
      ? selectedPath
      : (selectedVersion?.files[0]?.path ?? null);

  const { data: diff, isFetching: diffLoading } = useGetVersionFileDiffQuery(
    effectiveVersionId && effectivePath
      ? { projectId, versionId: effectiveVersionId, path: effectivePath }
      : (undefined as never),
    { skip: !effectiveVersionId || !effectivePath },
  );

  const fileIndex = useMemo(() => {
    if (!selectedVersion || !effectivePath) return -1;
    return selectedVersion.files.findIndex((f) => f.path === effectivePath);
  }, [selectedVersion, effectivePath]);

  function stepFile(delta: number) {
    if (!selectedVersion) return;
    const files = selectedVersion.files;
    if (files.length === 0) return;
    const next = (fileIndex + delta + files.length) % files.length;
    setSelectedPath(files[next].path);
  }

  async function handleSave() {
    const trimmed = message.trim();
    if (!trimmed) return;
    try {
      await createVersion({ projectId, message: trimmed }).unwrap();
      setMessage("");
      toast("Version saved");
    } catch (error) {
      const detail =
        error && typeof error === "object" && "data" in error
          ? ((error.data as { error?: string })?.error ?? "Could not save version")
          : "Could not save version";
      toast(detail, undefined, "danger");
    }
  }

  async function handleRestore() {
    if (!selectedVersion) return;
    try {
      await restoreVersion({ projectId, versionId: selectedVersion.id }).unwrap();
      toast(`Restored “${selectedVersion.message}”`, formatVersionTime(selectedVersion.createdAt));
      onRestored();
      onClose();
    } catch {
      toast("Could not restore this version", undefined, "danger");
    }
  }

  function handleBeforeMount(monaco: Monaco) {
    monaco.editor.defineTheme(ORBIT_THEME_NAME, orbitMonacoTheme);
  }

  if (!open) return null;

  return (
    <aside className="absolute top-0 right-0 bottom-0 z-20 flex w-80 flex-col border-l border-border-subtle bg-bg-panel shadow-[-18px_0_40px_rgba(0,0,0,0.45)]">
      <div className="flex h-8.5 flex-none items-center justify-between border-b border-[#17191D] pr-2 pl-3">
        <span className="text-[10.5px] font-semibold tracking-[0.12em] text-text-muted uppercase">
          Version history
        </span>
        <button
          onClick={onClose}
          className="grid h-5.5 w-5.5 place-items-center rounded-sm text-ui text-text-tertiary hover:bg-[#1B1D21] hover:text-text-primary"
        >
          ✕
        </button>
      </div>

      {canMutate && (
        <div className="flex flex-none items-center gap-1.5 border-b border-[#17191D] p-2">
          <input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleSave()}
            placeholder="Describe this change…"
            className="h-7.5 flex-1 rounded-sm border border-border-strong bg-bg-editor px-2 text-meta text-text-primary outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/[0.14]"
          />
          <button
            onClick={handleSave}
            disabled={saving || !message.trim()}
            className="h-7.5 rounded-sm bg-accent px-2.5 text-meta font-medium text-on-accent hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-[#1D1E22] disabled:text-text-faint"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}

      <div className="max-h-[46%] flex-none overflow-auto p-2 pb-3">
        {isLoading && <div className="py-2 text-ui text-text-tertiary">Loading…</div>}
        {!isLoading && versions.length === 0 && (
          <div className="py-2 text-ui text-text-tertiary">No versions yet.</div>
        )}
        {versions.map((version) => (
          <VersionRow
            key={version.id}
            version={version}
            selected={version.id === effectiveVersionId}
            onClick={() => setSelectedVersionId(version.id)}
          />
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col border-t border-[#17191D]">
        <div className="flex h-7.5 flex-none items-center gap-2 border-b border-[#17191D] px-3">
          <span className="truncate font-mono text-meta text-text-primary">{effectivePath ?? "—"}</span>
          <div className="flex-1" />
          <button
            onClick={() => stepFile(-1)}
            title="Previous file"
            disabled={!selectedVersion || selectedVersion.files.length < 2}
            className="text-ui text-text-tertiary hover:text-text-primary disabled:opacity-40"
          >
            ↑
          </button>
          <button
            onClick={() => stepFile(1)}
            title="Next file"
            disabled={!selectedVersion || selectedVersion.files.length < 2}
            className="text-ui text-text-tertiary hover:text-text-primary disabled:opacity-40"
          >
            ↓
          </button>
        </div>

        {selectedVersion && selectedVersion.files.length > 1 && (
          <div className="flex flex-none flex-wrap gap-1 border-b border-[#17191D] px-2 py-1.5">
            {selectedVersion.files.map((file) => (
              <button
                key={file.path}
                onClick={() => setSelectedPath(file.path)}
                className={`rounded-sm px-1.75 py-0.5 font-mono text-[10.5px] ${
                  file.path === effectivePath
                    ? "bg-[#1A1C20] text-text-primary"
                    : "text-text-tertiary hover:bg-[#17191D]"
                }`}
              >
                {file.path.split("/").pop()}
              </button>
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1">
          {diffLoading && <div className="p-3 text-ui text-text-tertiary">Loading diff…</div>}
          {!diffLoading && diff && (
            <DiffEditor
              original={diff.oldContent}
              modified={diff.newContent}
              language={monacoLanguageFor(detectFileType(effectivePath ?? ""))}
              theme={ORBIT_THEME_NAME}
              beforeMount={handleBeforeMount}
              options={{
                readOnly: true,
                renderSideBySide: false,
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
              }}
            />
          )}
          {!diffLoading && !diff && (
            <div className="p-3 text-ui text-text-tertiary">Select a version to view changes.</div>
          )}
        </div>

        <div className="flex flex-none items-center gap-2 border-t border-[#17191D] p-2.5">
          {canMutate && (
            <button
              onClick={handleRestore}
              disabled={!selectedVersion || restoring}
              className="flex-1 rounded-sm bg-accent px-2.5 py-1.5 text-ui font-medium text-on-accent hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-[#1D1E22] disabled:text-text-faint"
            >
              {restoring ? "Restoring…" : "Restore this version"}
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-sm border border-border-strong bg-[#17191D] px-2.5 py-1.5 text-ui text-text-primary hover:border-[#3A3D44]"
          >
            Close
          </button>
        </div>
      </div>
    </aside>
  );
}

function VersionRow({
  version,
  selected,
  onClick,
}: {
  version: VersionSummary;
  selected: boolean;
  onClick: () => void;
}) {
  const authorName = version.author?.displayName || version.author?.email || "Unknown";
  return (
    <div
      onClick={onClick}
      className={`mb-0.5 cursor-pointer rounded-sm border-l-2 p-2 ${
        selected ? "border-accent bg-[#1A1C20]" : "border-transparent hover:bg-[#17191D]"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className={`truncate text-ui font-medium ${selected ? "text-text-primary" : "text-[#C9C8C4]"}`}>
          {version.message}
        </span>
        <span className="flex-none font-mono text-meta text-text-muted">
          {formatVersionTime(version.createdAt)}
        </span>
      </div>
      <div className="mt-1.25 flex items-center gap-1.5">
        <span
          className="grid h-3.5 w-3.5 flex-none place-items-center rounded-full text-[7.5px] font-semibold"
          style={{ background: version.author ? colorForUserId(version.author.id) : "#55585E", color: "#0D0E10" }}
        >
          {initialsFor(authorName)}
        </span>
        <span className="text-meta text-[#7A7C82]">{authorName}</span>
        <span className="ml-auto font-mono text-meta text-text-faint">
          {statLabel(version.additions, version.deletions)}
        </span>
      </div>
    </div>
  );
}
