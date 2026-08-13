import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, getProjectRole } from "@/lib/auth/projectAccess";
import { summarizeVersionChanges } from "@/lib/versionHistory";

interface RouteParams {
  params: Promise<{ projectId: string; versionId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, versionId } = await params;
  const role = await getProjectRole(projectId, userId);
  if (!role) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const version = await prisma.projectVersion.findFirst({
    where: { id: versionId, projectId },
    select: {
      id: true,
      message: true,
      createdAt: true,
      author: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
    },
  });
  if (!version) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const files = await summarizeVersionChanges(projectId, versionId);
  if (!files) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ version: { ...version, files } });
}
