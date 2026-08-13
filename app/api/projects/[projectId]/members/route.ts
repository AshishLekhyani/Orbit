import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, getProjectRole } from "@/lib/auth/projectAccess";

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

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      owner: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      members: {
        select: {
          id: true,
          role: true,
          user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    owner: {
      id: project.owner.id,
      name: project.owner.displayName || project.owner.email,
      email: project.owner.email,
      avatarUrl: project.owner.avatarUrl,
    },
    members: project.members.map((member) => ({
      id: member.id,
      userId: member.user.id,
      name: member.user.displayName || member.user.email,
      email: member.user.email,
      avatarUrl: member.user.avatarUrl,
      role: member.role,
    })),
  });
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
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const requestedRole = body?.role === "VIEWER" ? "VIEWER" : body?.role === "EDITOR" ? "EDITOR" : null;

  if (!email || !requestedRole) {
    return NextResponse.json({ error: "A valid email and role are required" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true, owner: { select: { email: true } } },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (project.owner.email.toLowerCase() === email) {
    return NextResponse.json({ error: "This user already owns the project" }, { status: 400 });
  }

  const invitee = await prisma.profile.findUnique({ where: { email } });
  if (!invitee) {
    return NextResponse.json(
      { error: "No Orbit account found for that email" },
      { status: 404 },
    );
  }

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: invitee.id } },
  });
  if (existing) {
    return NextResponse.json({ error: "This user is already a member" }, { status: 409 });
  }

  const member = await prisma.projectMember.create({
    data: { projectId, userId: invitee.id, role: requestedRole },
    select: {
      id: true,
      role: true,
      user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
    },
  });

  return NextResponse.json(
    {
      member: {
        id: member.id,
        userId: member.user.id,
        name: member.user.displayName || member.user.email,
        email: member.user.email,
        avatarUrl: member.user.avatarUrl,
        role: member.role,
      },
    },
    { status: 201 },
  );
}
