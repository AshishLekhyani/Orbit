import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/projectAccess";
import { ensureProfile } from "@/lib/auth/ensureProfile";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { signOut } from "./actions";

export const metadata: Metadata = { title: "Dashboard — Orbit" };

export default async function DashboardPage() {
  const userId = await getCurrentUserId();

  let profile = userId
    ? await prisma.profile.findUnique({ where: { id: userId } })
    : null;

  if (userId && !profile) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await ensureProfile(userId, user?.email ?? "");
    profile = await prisma.profile.findUnique({ where: { id: userId } });
  }

  return (
    <DashboardShell
      email={profile?.email ?? ""}
      displayName={profile?.displayName ?? null}
      onSignOut={signOut}
    />
  );
}
