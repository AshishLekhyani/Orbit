import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { signOut } from "./actions";

export const metadata: Metadata = { title: "Dashboard — Orbit" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = user
    ? await prisma.profile.findUnique({ where: { id: user.id } })
    : null;

  return (
    <DashboardShell
      email={profile?.email ?? ""}
      displayName={profile?.displayName ?? null}
      onSignOut={signOut}
    />
  );
}
