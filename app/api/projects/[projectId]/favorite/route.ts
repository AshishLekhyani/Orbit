import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, getProjectRole } from "@/lib/auth/projectAccess";

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
  if (!role) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.projectFavorite.upsert({
    where: { userId_projectId: { userId, projectId } },
    update: {},
    create: { userId, projectId },
  });

  return new NextResponse(null, { status: 204 });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;
  await prisma.projectFavorite.deleteMany({ where: { userId, projectId } });

  return new NextResponse(null, { status: 204 });
}
