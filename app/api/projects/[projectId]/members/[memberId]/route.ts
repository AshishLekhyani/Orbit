import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, getProjectRole } from "@/lib/auth/projectAccess";
import { broadcastMembershipChange } from "@/lib/realtime/broadcastMembershipChange";

interface RouteParams {
  params: Promise<{ projectId: string; memberId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, memberId } = await params;
  const role = await getProjectRole(projectId, userId);
  if (role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const nextRole = body?.role === "VIEWER" ? "VIEWER" : body?.role === "EDITOR" ? "EDITOR" : null;
  if (!nextRole) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const member = await prisma.projectMember.findFirst({
    where: { id: memberId, projectId },
  });
  if (!member) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.projectMember.update({ where: { id: memberId }, data: { role: nextRole } });
  await broadcastMembershipChange(projectId, member.userId);

  return new NextResponse(null, { status: 204 });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, memberId } = await params;
  const role = await getProjectRole(projectId, userId);
  if (role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const member = await prisma.projectMember.findFirst({
    where: { id: memberId, projectId },
  });
  if (!member) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.projectMember.delete({ where: { id: memberId } });
  await broadcastMembershipChange(projectId, member.userId);

  return new NextResponse(null, { status: 204 });
}
