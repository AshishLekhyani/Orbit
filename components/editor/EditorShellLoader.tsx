"use client";

import dynamic from "next/dynamic";
import type { ProjectRole } from "@prisma/client";
import { OrbitLogo } from "@/components/shared/OrbitLogo";

const EditorShell = dynamic(
  () => import("./EditorShell").then((mod) => mod.EditorShell),
  { ssr: false, loading: () => <EditorShellSkeleton /> },
);

function EditorShellSkeleton() {
  return (
    <div className="flex h-screen items-center justify-center bg-bg-base">
      <OrbitLogo size={32} className="animate-pulse" />
    </div>
  );
}

export function EditorShellLoader(props: {
  projectId: string;
  projectName: string;
  role: ProjectRole;
}) {
  return <EditorShell {...props} />;
}
