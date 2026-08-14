import type { Metadata } from "next";
import Link from "next/link";
import { OrbitLogo } from "@/components/shared/OrbitLogo";

export const metadata: Metadata = { title: "Page not found — Orbit" };

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-[radial-gradient(700px_420px_at_50%_10%,#17181C_0%,#0D0E10_60%)]">
      <div className="w-[372px] text-center">
        <div className="mb-[30px] flex items-center justify-center gap-2.5">
          <OrbitLogo size={22} />
          <span className="text-sm font-semibold text-text-primary">Orbit</span>
        </div>
        <h1 className="m-0 mb-1.5 text-title font-semibold text-text-primary">Page not found</h1>
        <p className="mb-6 text-[13.5px] text-text-secondary">
          This page doesn&apos;t exist, or you don&apos;t have access to it.
        </p>
        <Link
          href="/dashboard"
          className="flex h-10 w-full items-center justify-center rounded-btn bg-accent text-sm font-medium text-on-accent hover:bg-accent-hover"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
