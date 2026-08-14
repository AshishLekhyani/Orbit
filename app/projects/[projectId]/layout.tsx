import { notFound, redirect } from "next/navigation";
import { getCurrentUserId, getProjectRole } from "@/lib/auth/projectAccess";

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}

export default async function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const userId = await getCurrentUserId();

  if (!userId) {
    redirect("/signin");
  }

  const { projectId } = await params;
  const role = await getProjectRole(projectId, userId);

  if (!role) {
    notFound();
  }

  return <>{children}</>;
}
