import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, getProjectRole, roleAtLeast } from "@/lib/auth/projectAccess";
import { moveOrRenameFile } from "@/lib/fileTree";

interface RouteParams {
  params: Promise<{ projectId: string; fileId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, fileId } = await params;
  const role = await getProjectRole(projectId, userId);
  if (!role) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const file = await prisma.file.findFirst({ where: { id: fileId, projectId } });
  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ file });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, fileId } = await params;
  const role = await getProjectRole(projectId, userId);
  if (!roleAtLeast(role, "EDITOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (typeof body.name === "string" || body.parentId !== undefined) {
    const result = await moveOrRenameFile(projectId, fileId, {
      name: typeof body.name === "string" ? body.name : undefined,
      parentId: body.parentId,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
  }

  if (typeof body.content === "string") {
    await prisma.file.update({ where: { id: fileId }, data: { content: body.content } });
  }

  await prisma.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } });

  const file = await prisma.file.findUnique({ where: { id: fileId } });
  return NextResponse.json({ file });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, fileId } = await params;
  const role = await getProjectRole(projectId, userId);
  if (!roleAtLeast(role, "EDITOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const file = await prisma.file.findFirst({ where: { id: fileId, projectId } });
  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.file.delete({ where: { id: fileId } });

  return new NextResponse(null, { status: 204 });
}
