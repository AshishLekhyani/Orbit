import type { ChangeType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { diffLines, diffStats } from "@/lib/diffLines";

export interface EffectiveFileEntry {
  content: string | null;
  changeType: ChangeType;
}

async function reconstructState(
  projectId: string,
  cutoff: { createdAt: Date; inclusive: boolean } | null,
): Promise<Map<string, EffectiveFileEntry>> {
  const snapshots = await prisma.versionFileSnapshot.findMany({
    where: {
      version: {
        projectId,
        ...(cutoff
          ? { createdAt: cutoff.inclusive ? { lte: cutoff.createdAt } : { lt: cutoff.createdAt } }
          : {}),
      },
    },
    select: { path: true, content: true, changeType: true, version: { select: { createdAt: true } } },
    orderBy: { version: { createdAt: "asc" } },
  });

  const state = new Map<string, EffectiveFileEntry>();
  for (const snap of snapshots) {
    state.set(snap.path, { content: snap.content, changeType: snap.changeType });
  }
  return state;
}

export function getFileStateLatest(projectId: string) {
  return reconstructState(projectId, null);
}

export async function getFileStateAsOfVersion(projectId: string, versionId: string) {
  const target = await prisma.projectVersion.findFirst({
    where: { id: versionId, projectId },
    select: { createdAt: true },
  });
  if (!target) return null;
  return reconstructState(projectId, { createdAt: target.createdAt, inclusive: true });
}

export async function getFileStateBeforeVersion(projectId: string, versionId: string) {
  const target = await prisma.projectVersion.findFirst({
    where: { id: versionId, projectId },
    select: { createdAt: true },
  });
  if (!target) return null;
  return reconstructState(projectId, { createdAt: target.createdAt, inclusive: false });
}

interface PendingChange {
  path: string;
  changeType: ChangeType;
  content: string | null;
}

async function computePendingChanges(projectId: string): Promise<PendingChange[]> {
  const [liveFiles, effectiveState] = await Promise.all([
    prisma.file.findMany({ where: { projectId, isDirectory: false }, select: { path: true, content: true } }),
    getFileStateLatest(projectId),
  ]);

  const liveByPath = new Map(liveFiles.map((f) => [f.path, f.content]));
  const changes: PendingChange[] = [];

  for (const [path, content] of liveByPath) {
    const prev = effectiveState.get(path);
    if (!prev || prev.changeType === "DELETED") {
      changes.push({ path, changeType: "ADDED", content });
    } else if (prev.content !== content) {
      changes.push({ path, changeType: "MODIFIED", content });
    }
  }
  for (const [path, prev] of effectiveState) {
    if (prev.changeType === "DELETED") continue;
    if (!liveByPath.has(path)) {
      changes.push({ path, changeType: "DELETED", content: null });
    }
  }

  return changes;
}

export async function createCheckpoint(
  projectId: string,
  authorId: string,
  message: string,
  options?: { force?: boolean },
) {
  const changes = await computePendingChanges(projectId);
  if (changes.length === 0 && !options?.force) {
    return null;
  }

  return prisma.projectVersion.create({
    data: {
      projectId,
      authorId,
      message,
      fileSnapshots: {
        create: changes.map((c) => ({ path: c.path, content: c.content, changeType: c.changeType })),
      },
    },
  });
}

export interface FileDiffSummary {
  path: string;
  changeType: ChangeType;
  additions: number;
  deletions: number;
}

export interface AuthorInfo {
  id: string;
  displayName: string | null;
  email: string;
  avatarUrl: string | null;
}

export interface VersionWithStats {
  id: string;
  message: string;
  createdAt: Date;
  author: AuthorInfo | null;
  files: FileDiffSummary[];
  additions: number;
  deletions: number;
}

export const VERSION_LIST_LIMIT = 100;

export async function listVersionsWithStats(projectId: string): Promise<VersionWithStats[]> {
  const versions = await prisma.projectVersion.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: VERSION_LIST_LIMIT,
    select: {
      id: true,
      message: true,
      createdAt: true,
      author: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      fileSnapshots: { select: { path: true, content: true, changeType: true } },
    },
  });

  const chronological = [...versions].reverse();
  const runningContent = new Map<string, string>();

  const oldestInWindow = chronological[0];
  if (oldestInWindow) {
    const baseline = await reconstructState(projectId, {
      createdAt: oldestInWindow.createdAt,
      inclusive: false,
    });
    for (const [path, entry] of baseline) {
      if (entry.changeType !== "DELETED" && entry.content !== null) {
        runningContent.set(path, entry.content);
      }
    }
  }
  const statsByVersionId = new Map<string, { files: FileDiffSummary[]; additions: number; deletions: number }>();

  for (const version of chronological) {
    const files: FileDiffSummary[] = [];
    let additions = 0;
    let deletions = 0;
    for (const snap of version.fileSnapshots) {
      const prevContent = runningContent.get(snap.path) ?? "";
      const nextContent = snap.content ?? "";
      const stats = diffStats(diffLines(prevContent, nextContent));
      files.push({ path: snap.path, changeType: snap.changeType, additions: stats.additions, deletions: stats.deletions });
      additions += stats.additions;
      deletions += stats.deletions;
      if (snap.changeType === "DELETED") runningContent.delete(snap.path);
      else runningContent.set(snap.path, nextContent);
    }
    statsByVersionId.set(version.id, { files, additions, deletions });
  }

  return versions.map((v) => ({
    id: v.id,
    message: v.message,
    createdAt: v.createdAt,
    author: v.author,
    ...statsByVersionId.get(v.id)!,
  }));
}

export async function summarizeVersionChanges(
  projectId: string,
  versionId: string,
): Promise<FileDiffSummary[] | null> {
  const version = await prisma.projectVersion.findFirst({
    where: { id: versionId, projectId },
    select: {
      fileSnapshots: { select: { path: true, content: true, changeType: true } },
    },
  });
  if (!version) return null;

  const before = await getFileStateBeforeVersion(projectId, versionId);
  if (!before) return null;

  return version.fileSnapshots.map((snap) => {
    const prevContent = before.get(snap.path)?.content ?? "";
    const nextContent = snap.content ?? "";
    const { additions, deletions } = diffStats(diffLines(prevContent, nextContent));
    return { path: snap.path, changeType: snap.changeType, additions, deletions };
  });
}

export interface FileDiffDetail extends FileDiffSummary {
  oldContent: string;
  newContent: string;
}

export async function getVersionFileDiff(
  projectId: string,
  versionId: string,
  path: string,
): Promise<FileDiffDetail | null> {
  const version = await prisma.projectVersion.findFirst({
    where: { id: versionId, projectId },
    select: { fileSnapshots: { where: { path }, select: { content: true, changeType: true } } },
  });
  if (!version) return null;
  const snap = version.fileSnapshots[0];
  if (!snap) return null;

  const before = await getFileStateBeforeVersion(projectId, versionId);
  if (!before) return null;

  const oldContent = before.get(path)?.content ?? "";
  const newContent = snap.content ?? "";
  const { additions, deletions } = diffStats(diffLines(oldContent, newContent));

  return { path, changeType: snap.changeType, additions, deletions, oldContent, newContent };
}
