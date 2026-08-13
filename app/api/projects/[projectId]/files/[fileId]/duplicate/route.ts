import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, getProjectRole, roleAtLeast } from "@/lib/auth/projectAccess";
import { joinPath, withCopySuffix } from "@/lib/fileTree";
import { seedYjsState } from "@/lib/realtime/seedYjsState";

interface RouteParams {
  params: Promise<{ projectId: string; fileId: string }>;
}

function parentPathOf(path: string): string | null {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? null : path.slice(0, idx);
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, fileId } = await params;
  const role = await getProjectRole(projectId, userId);
  if (!roleAtLeast(role, "EDITOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const source = await prisma.file.findFirst({ where: { id: fileId, projectId } });
  if (!source || source.isDirectory) {
    return NextResponse.json({ error: "Only files can be duplicated" }, { status: 400 });
  }

  let name = withCopySuffix(source.name);
  let path = joinPath(parentPathOf(source.path), name);

  let attempt = 1;
  while (await prisma.file.findUnique({ where: { projectId_path: { projectId, path } } })) {
    attempt += 1;
    name = withCopySuffix(source.name).replace(/(-copy)(\.[^.]+)?$/, `$1${attempt}$2`);
    path = joinPath(parentPathOf(source.path), name);
  }

  const file = await prisma.file.create({
    data: {
      projectId,
      parentId: source.parentId,
      path,
      name,
      type: source.type,
      isDirectory: false,
      content: source.content,
      yjsState: seedYjsState(source.content),
    },
  });

  return NextResponse.json({ file }, { status: 201 });
}
