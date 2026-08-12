import type { ProjectRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function getProjectRole(
  projectId: string,
  userId: string,
): Promise<ProjectRole | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  });

  if (!project) return null;
  if (project.ownerId === userId) return "OWNER";

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: true },
  });

  return member?.role ?? null;
}

export function roleAtLeast(role: ProjectRole | null, required: ProjectRole): boolean {
  const order: ProjectRole[] = ["VIEWER", "EDITOR", "OWNER"];
  if (!role) return false;
  return order.indexOf(role) >= order.indexOf(required);
}
