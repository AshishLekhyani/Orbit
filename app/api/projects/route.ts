import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/projectAccess";
import { starterFiles, type ProjectTemplateId } from "@/lib/projectTemplates";
import { seedYjsState } from "@/lib/realtime/seedYjsState";

export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const filter = request.nextUrl.searchParams.get("filter");
  const where =
    filter === "shared"
      ? { members: { some: { userId } } }
      : { OR: [{ ownerId: userId }, { members: { some: { userId } } }] };

  const projects = await prisma.project.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 500,
    include: {
      _count: { select: { members: true } },
      favoritedBy: { where: { userId }, select: { id: true } },
    },
  });

  return NextResponse.json({
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      stack: project.stack,
      updatedAt: project.updatedAt,
      isOwner: project.ownerId === userId,
      collaboratorCount: project._count.members,
      isFavorite: project.favoritedBy.length > 0,
    })),
  });
}

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const template: ProjectTemplateId = body?.template === "blank" ? "blank" : "landing-page";

  const project = await prisma.project.create({
    data: {
      name,
      ownerId: userId,
      files: {
        create: starterFiles(template).map((file) => ({
          path: file.path,
          name: file.name,
          type: file.type,
          content: file.content,
          yjsState: seedYjsState(file.content),
        })),
      },
    },
  });

  return NextResponse.json({ project }, { status: 201 });
}
