"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/projectAccess";

const ROLE_RANK = { VIEWER: 0, EDITOR: 1, OWNER: 2 } as const;

export async function acceptShareLink(token: string) {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect(`/signin?redirect=${encodeURIComponent(`/share/${token}`)}`);
  }

  const link = await prisma.shareLink.findUnique({ where: { token } });
  const isValid = link && !link.revokedAt && (!link.expiresAt || link.expiresAt > new Date());
  if (!isValid) {
    redirect(`/share/${token}`);
  }

  const project = await prisma.project.findUnique({
    where: { id: link.projectId },
    select: { ownerId: true },
  });
  if (!project) {
    redirect(`/share/${token}`);
  }

  if (project.ownerId !== userId) {
    const existing = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: link.projectId, userId } },
    });
    if (!existing) {
      await prisma.projectMember.create({
        data: { projectId: link.projectId, userId, role: link.permission },
      });
    } else if (ROLE_RANK[link.permission] > ROLE_RANK[existing.role]) {
      await prisma.projectMember.update({ where: { id: existing.id }, data: { role: link.permission } });
    }
  }

  redirect(`/projects/${link.projectId}`);
}
