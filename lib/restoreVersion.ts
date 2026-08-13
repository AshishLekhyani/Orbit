import { prisma } from "@/lib/prisma";
import { getFileStateAsOfVersion, createCheckpoint } from "@/lib/versionHistory";
import { replaceFileContent } from "@/lib/realtime/syncFileContent";
import { ensureFileAtPath } from "@/lib/restoreFileTree";
import { broadcastToProjectChannel } from "@/lib/realtime/broadcast";

export async function restoreVersion(projectId: string, versionId: string, actorUserId: string) {
  const version = await prisma.projectVersion.findFirst({
    where: { id: versionId, projectId },
    select: { id: true, message: true },
  });
  if (!version) return null;

  const targetState = await getFileStateAsOfVersion(projectId, versionId);
  if (!targetState) return null;

  const liveFiles = await prisma.file.findMany({
    where: { projectId, isDirectory: false },
    select: { id: true, path: true },
  });
  const liveByPath = new Map(liveFiles.map((f) => [f.path, f]));

  let structuralChange = false;

  for (const [path, file] of liveByPath) {
    const entry = targetState.get(path);
    if (!entry || entry.changeType === "DELETED") {
      await prisma.file.delete({ where: { id: file.id } });
      structuralChange = true;
    }
  }

  for (const [path, entry] of targetState) {
    if (entry.changeType === "DELETED") continue;
    const content = entry.content ?? "";
    const existing = liveByPath.get(path);
    if (existing) {
      await replaceFileContent(existing.id, content);
    } else {
      await ensureFileAtPath(projectId, path, content);
      structuralChange = true;
    }
  }

  const restoreVersionRow = await createCheckpoint(
    projectId,
    actorUserId,
    `Restored to "${version.message}"`,
    { force: true },
  );

  if (structuralChange) {
    await broadcastToProjectChannel(projectId, "files-changed", {});
  }

  return restoreVersionRow;
}
