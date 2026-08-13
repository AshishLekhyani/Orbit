import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, getProjectRole } from "@/lib/auth/projectAccess";
import { EditorShellLoader } from "@/components/editor/EditorShellLoader";

interface ProjectPageProps {
  params: Promise<{ projectId: string }>;
}

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  });
  return { title: project ? `${project.name} — Orbit` : "Orbit" };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;
  const userId = await getCurrentUserId();
  const role = userId ? await getProjectRole(projectId, userId) : null;

  const project = await prisma.project.findUnique({ where: { id: projectId } });

  if (!project || !role) {
    notFound();
  }

  return <EditorShellLoader projectId={project.id} projectName={project.name} role={role} />;
}
