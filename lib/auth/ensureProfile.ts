import { prisma } from "@/lib/prisma";

export async function ensureProfile(id: string, email: string): Promise<void> {
  await prisma.profile.upsert({
    where: { id },
    update: { email },
    create: { id, email },
  });
}
