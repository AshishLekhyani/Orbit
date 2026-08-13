import { prisma } from "@/lib/prisma";

export function findActiveShareLink(projectId: string) {
  return prisma.shareLink.findFirst({
    where: {
      projectId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
  });
}
