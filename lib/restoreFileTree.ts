import type { File } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { detectFileType } from "@/lib/fileMeta";
import { seedYjsState } from "@/lib/realtime/seedYjsState";

export async function ensureFileAtPath(projectId: string, path: string, content: string): Promise<File> {
  const segments = path.split("/");
  const name = segments[segments.length - 1];
  const dirSegments = segments.slice(0, -1);

  let parentId: string | null = null;
  let currentPath = "";
  for (const segment of dirSegments) {
    currentPath = currentPath ? `${currentPath}/${segment}` : segment;
    const existing = await prisma.file.findUnique({
      where: { projectId_path: { projectId, path: currentPath } },
    });
    if (existing) {
      parentId = existing.id;
    } else {
      const created: { id: string } = await prisma.file.create({
        data: {
          projectId,
          parentId,
          path: currentPath,
          name: segment,
          isDirectory: true,
          type: "OTHER",
          content: "",
        },
        select: { id: true },
      });
      parentId = created.id;
    }
  }

  return prisma.file.create({
    data: {
      projectId,
      parentId,
      path,
      name,
      isDirectory: false,
      type: detectFileType(name),
      content,
      yjsState: seedYjsState(content),
    },
  });
}
