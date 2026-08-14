import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/projectAccess";
import { OrbitLogo } from "@/components/shared/OrbitLogo";
import { acceptShareLink } from "./actions";

export const metadata: Metadata = { title: "Join project — Orbit" };

interface SharePageProps {
  params: Promise<{ token: string }>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[radial-gradient(700px_420px_at_50%_10%,#17181C_0%,#0D0E10_60%)]">
      <div className="w-[372px]">
        <div className="mb-[30px] flex items-center gap-2.5">
          <OrbitLogo size={22} />
          <span className="text-sm font-semibold text-text-primary">Orbit</span>
        </div>
        {children}
      </div>
    </div>
  );
}

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params;
  const [link, userId] = await Promise.all([
    prisma.shareLink.findUnique({ where: { token } }),
    getCurrentUserId(),
  ]);
  const isValid = link && !link.revokedAt && (!link.expiresAt || link.expiresAt > new Date());

  if (!isValid) {
    return (
      <Shell>
        <h1 className="m-0 mb-1.5 text-title font-semibold text-text-primary">Link not available</h1>
        <p className="text-[13.5px] text-text-secondary">
          This share link is invalid, has been revoked, or has expired. Ask the project owner for a new one.
        </p>
      </Shell>
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: link.projectId },
    select: { name: true },
  });
  if (!project) {
    return (
      <Shell>
        <h1 className="m-0 mb-1.5 text-title font-semibold text-text-primary">Project not found</h1>
        <p className="text-[13.5px] text-text-secondary">This project no longer exists.</p>
      </Shell>
    );
  }

  const permissionLabel = link.permission === "EDITOR" ? "edit" : "view";

  return (
    <Shell>
      <h1 className="m-0 mb-1.5 text-title font-semibold text-text-primary">Join “{project.name}”</h1>
      <p className="mb-[26px] text-[13.5px] text-text-secondary">
        You’ve been invited to {permissionLabel} this project in Orbit.
      </p>

      {userId ? (
        <form action={acceptShareLink.bind(null, token)}>
          <button
            type="submit"
            className="h-10 w-full rounded-btn bg-accent text-sm font-medium text-on-accent hover:bg-accent-hover"
          >
            Continue to project
          </button>
        </form>
      ) : (
        <a
          href={`/signin?redirect=${encodeURIComponent(`/share/${token}`)}`}
          className="flex h-10 w-full items-center justify-center rounded-btn bg-accent text-sm font-medium text-on-accent hover:bg-accent-hover"
        >
          Sign in to continue
        </a>
      )}
    </Shell>
  );
}
