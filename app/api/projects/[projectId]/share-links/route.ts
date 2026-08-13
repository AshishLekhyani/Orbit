import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, getProjectRole } from "@/lib/auth/projectAccess";
import { generateShareToken } from "@/lib/shareToken";
import { findActiveShareLink } from "@/lib/shareLinks";

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
  if (role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const link = await findActiveShareLink(projectId);
  return NextResponse.json({ link });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;
  const role = await getProjectRole(projectId, userId);
  if (role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const permission = body?.permission === "EDITOR" ? "EDITOR" : body?.permission === "VIEWER" ? "VIEWER" : null;
  if (!permission) {
    return NextResponse.json({ error: "Invalid permission" }, { status: 400 });
  }

  const existing = await findActiveShareLink(projectId);
  const link = existing
    ? await prisma.shareLink.update({ where: { id: existing.id }, data: { permission } })
    : await prisma.shareLink.create({
        data: { projectId, token: generateShareToken(), permission, createdById: userId },
      });

  return NextResponse.json({ link });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;
  const role = await getProjectRole(projectId, userId);
  if (role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await findActiveShareLink(projectId);
  if (existing) {
    await prisma.shareLink.update({ where: { id: existing.id }, data: { revokedAt: new Date() } });
  }

  return new NextResponse(null, { status: 204 });
}
