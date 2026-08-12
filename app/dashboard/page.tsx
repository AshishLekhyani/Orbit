import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { signOut } from "./actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = user
    ? await prisma.profile.findUnique({ where: { id: user.id } })
    : null;

  return <DashboardShell email={profile?.email ?? ""} onSignOut={signOut} />;
}
