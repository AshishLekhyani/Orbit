import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, getProjectRole } from "@/lib/auth/projectAccess";
import { generateShareToken } from "@/lib/shareToken";
import { findActiveShareLink } from "@/lib/shareLinks";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
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
  if (!existing) {
    return NextResponse.json({ error: "No active link to regenerate" }, { status: 404 });
  }

  const [, link] = await prisma.$transaction([
    prisma.shareLink.update({ where: { id: existing.id }, data: { revokedAt: new Date() } }),
    prisma.shareLink.create({
      data: { projectId, token: generateShareToken(), permission: existing.permission, createdById: userId },
    }),
  ]);

  return NextResponse.json({ link });
}
