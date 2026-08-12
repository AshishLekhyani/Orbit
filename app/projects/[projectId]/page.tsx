import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { OrbitLogo } from "@/components/shared/OrbitLogo";

interface ProjectPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { _count: { select: { files: true } } },
  });

  if (!project) {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-11 items-center gap-3 border-b border-border-subtle bg-bg-panel px-3.5">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-sm px-1.5 py-1 hover:bg-[#17191D]"
        >
          <OrbitLogo size={19} />
          <span className="text-ui font-semibold text-text-primary">Orbit</span>
        </Link>
        <span className="text-xs text-[#33363C]">/</span>
        <span className="text-ui text-[#C9C8C4]">{project.name}</span>
      </header>

      <main className="flex flex-1 items-center justify-center px-8">
        <div className="text-center">
          <h1 className="m-0 text-title font-semibold text-text-primary">{project.name}</h1>
          <p className="mt-2 text-body text-text-secondary">
            {project._count.files} {project._count.files === 1 ? "file" : "files"} ready. The
            editor is built in the next phase.
          </p>
          <Link
            href="/dashboard"
            className="mt-5 inline-block text-ui text-accent hover:text-accent-hover"
          >
            ← Back to dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
