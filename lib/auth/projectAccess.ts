import { cache } from "react";
import type { ProjectRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export const getCurrentUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
});

export const getProjectRole = cache(
  async (projectId: string, userId: string): Promise<ProjectRole | null> => {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        ownerId: true,
        members: { where: { userId }, select: { role: true } },
      },
    });

    if (!project) return null;
    if (project.ownerId === userId) return "OWNER";

    return project.members[0]?.role ?? null;
  },
);

export function roleAtLeast(role: ProjectRole | null, required: ProjectRole): boolean {
  const order: ProjectRole[] = ["VIEWER", "EDITOR", "OWNER"];
  if (!role) return false;
  return order.indexOf(role) >= order.indexOf(required);
}
