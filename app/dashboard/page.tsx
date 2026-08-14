import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/projectAccess";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { signOut } from "./actions";

export const metadata: Metadata = { title: "Dashboard — Orbit" };

export default async function DashboardPage() {
  const userId = await getCurrentUserId();

  const profile = userId
    ? await prisma.profile.findUnique({ where: { id: userId } })
    : null;

  return (
    <DashboardShell
      email={profile?.email ?? ""}
      displayName={profile?.displayName ?? null}
      onSignOut={signOut}
    />
  );
}
