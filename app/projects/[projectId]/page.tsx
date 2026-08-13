import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, getProjectRole } from "@/lib/auth/projectAccess";
import { colorForUserId } from "@/lib/collaboratorColor";
import { EditorShellLoader } from "@/components/editor/EditorShellLoader";

interface ProjectPageProps {
  params: Promise<{ projectId: string }>;
}

const getProjectById = cache((projectId: string) =>
  prisma.project.findUnique({ where: { id: projectId } }),
);

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { projectId } = await params;
  const project = await getProjectById(projectId);
  return { title: project ? `${project.name} — Orbit` : "Orbit" };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;
  const userId = await getCurrentUserId();
  const role = userId ? await getProjectRole(projectId, userId) : null;

  const project = await getProjectById(projectId);

  if (!project || !role || !userId) {
    notFound();
  }

  const profile = await prisma.profile.findUnique({ where: { id: userId } });
  const currentUser = {
    id: userId,
    name: profile?.displayName || profile?.email || "Anonymous",
    color: colorForUserId(userId),
  };

  return (
    <EditorShellLoader
      projectId={project.id}
      projectName={project.name}
      role={role}
      currentUser={currentUser}
    />
  );
}
