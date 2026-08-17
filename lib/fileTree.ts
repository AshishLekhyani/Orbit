import type { File } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { detectFileType, isValidFileName, joinPath, withCopySuffix } from "@/lib/fileMeta";

export { detectFileType, isValidFileName, joinPath, withCopySuffix };

interface MoveOrRenameResult {
  ok: true;
  path: string;
  file: File;
}
interface MoveOrRenameError {
  ok: false;
  status: number;
  error: string;
}

export async function moveOrRenameFile(
  projectId: string,
  fileId: string,
  changes: { name?: string; parentId?: string | null },
): Promise<MoveOrRenameResult | MoveOrRenameError> {
  const [file, parent] = await Promise.all([
    prisma.file.findFirst({ where: { id: fileId, projectId } }),
    changes.parentId
      ? prisma.file.findFirst({
          where: { id: changes.parentId, projectId, isDirectory: true },
          select: { path: true },
        })
      : Promise.resolve(null),
  ]);

  if (!file) return { ok: false, status: 404, error: "Not found" };

  const nextName = changes.name?.trim() || file.name;
  if (!isValidFileName(nextName)) return { ok: false, status: 400, error: "Invalid name" };

  const parentChanging = changes.parentId !== undefined;
  const resolvedParentId = parentChanging ? changes.parentId : file.parentId;

  if (resolvedParentId === fileId) {
    return { ok: false, status: 400, error: "Cannot move a folder into itself" };
  }

  let parentPath: string | null = null;
  if (resolvedParentId) {
    if (parentChanging) {
      if (!parent) return { ok: false, status: 404, error: "Parent folder not found" };
      parentPath = parent.path;
    } else {
      const lastSlash = file.path.lastIndexOf("/");
      parentPath = lastSlash === -1 ? null : file.path.slice(0, lastSlash);
    }
    if (file.isDirectory && parentPath !== null && (parentPath === file.path || parentPath.startsWith(`${file.path}/`))) {
      return { ok: false, status: 400, error: "Cannot move a folder into its own descendant" };
    }
  }

  const nextPath = joinPath(parentPath, nextName);

  if (nextPath !== file.path) {
    const collision = await prisma.file.findUnique({
      where: { projectId_path: { projectId, path: nextPath } },
    });
    if (collision) return { ok: false, status: 409, error: "A file with that name already exists" };
  }

  const oldPath = file.path;

  const updatedFile = await prisma.$transaction(async (tx) => {
    const result = await tx.file.update({
      where: { id: fileId },
      data: { name: nextName, parentId: resolvedParentId, path: nextPath },
    });

    if (file.isDirectory && oldPath !== nextPath) {
      const descendants = await tx.file.findMany({
        where: { projectId, path: { startsWith: `${oldPath}/` } },
        select: { id: true, path: true },
      });
      for (const descendant of descendants) {
        await tx.file.update({
          where: { id: descendant.id },
          data: { path: nextPath + descendant.path.slice(oldPath.length) },
        });
      }
    }

    return result;
  });

  return { ok: true, path: nextPath, file: updatedFile };
}
