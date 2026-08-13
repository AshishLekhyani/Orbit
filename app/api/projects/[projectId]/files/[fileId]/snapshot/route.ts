import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, getProjectRole, roleAtLeast } from "@/lib/auth/projectAccess";

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

  const file = await prisma.file.findFirst({
    where: { id: fileId, projectId },
    select: { content: true, yjsState: true },
  });
  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    content: file.content,
    yjsState: file.yjsState ? Buffer.from(file.yjsState).toString("base64") : null,
  });
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
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
  if (!body || typeof body.content !== "string" || typeof body.yjsState !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const exists = await prisma.file.findFirst({ where: { id: fileId, projectId }, select: { id: true } });
  if (!exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await prisma.file.update({
      where: { id: fileId },
      data: { content: body.content, yjsState: Buffer.from(body.yjsState, "base64") },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw error;
  }

  return new NextResponse(null, { status: 204 });
}
