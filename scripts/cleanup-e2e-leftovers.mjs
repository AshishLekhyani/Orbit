import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const prisma = new PrismaClient();

const staleProfiles = await prisma.profile.findMany({
  where: { email: { contains: "@orbit-test.local" } },
});

for (const profile of staleProfiles) {
  await prisma.project.deleteMany({ where: { ownerId: profile.id } });
}
for (const profile of staleProfiles) {
  await prisma.profile.deleteMany({ where: { id: profile.id } }).catch(() => {});
  await admin.auth.admin.deleteUser(profile.id).catch(() => {});
}

console.log(`cleaned up ${staleProfiles.length} stale e2e profiles/users`);
await prisma.$disconnect();
