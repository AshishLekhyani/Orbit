import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, getProjectRole, roleAtLeast } from "@/lib/auth/projectAccess";
import { detectFileType, joinPath } from "@/lib/fileTree";
import { seedYjsState } from "@/lib/realtime/seedYjsState";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;
  const role = await getProjectRole(projectId, userId);
  if (!role) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const files = await prisma.file.findMany({
    where: { projectId },
    select: {
      id: true,
      path: true,
      name: true,
      type: true,
      isDirectory: true,
      parentId: true,
      updatedAt: true,
    },
    orderBy: { path: "asc" },
  });

  return NextResponse.json({ files });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;
  const role = await getProjectRole(projectId, userId);
  if (!roleAtLeast(role, "EDITOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const parentId = typeof body?.parentId === "string" ? body.parentId : null;
  const isDirectory = Boolean(body?.isDirectory);

  if (!name || name.includes("/")) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  let parentPath: string | null = null;
  if (parentId) {
    const parent = await prisma.file.findFirst({
      where: { id: parentId, projectId, isDirectory: true },
      select: { path: true },
    });
    if (!parent) {
      return NextResponse.json({ error: "Parent folder not found" }, { status: 404 });
    }
    parentPath = parent.path;
  }

  const path = joinPath(parentPath, name);

  const existing = await prisma.file.findUnique({
    where: { projectId_path: { projectId, path } },
  });
  if (existing) {
    return NextResponse.json({ error: "A file with that name already exists" }, { status: 409 });
  }

  const file = await prisma.file.create({
    data: {
      projectId,
      parentId,
      path,
      name,
      isDirectory,
      type: isDirectory ? "OTHER" : detectFileType(name),
      content: "",
      yjsState: isDirectory ? undefined : seedYjsState(""),
    },
  });

  await prisma.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } });

  return NextResponse.json({ file }, { status: 201 });
}
