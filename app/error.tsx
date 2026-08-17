"use client";

import { useEffect } from "react";
import Link from "next/link";
import { OrbitLogo } from "@/components/shared/OrbitLogo";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center bg-[radial-gradient(700px_420px_at_50%_10%,#17181C_0%,#0D0E10_60%)] px-6">
      <div className="w-full max-w-[420px] text-center">
        <div className="mb-[30px] flex items-center justify-center gap-2.5">
          <OrbitLogo size={22} />
          <span className="text-sm font-semibold text-text-primary">Orbit</span>
        </div>

        <h1 className="m-0 mb-1.5 text-title font-semibold text-text-primary">Something went wrong</h1>
        <p className="mb-[26px] text-[13.5px] leading-relaxed text-text-secondary">
          This page hit an unexpected error. Trying again usually works — the connection to the
          database can occasionally time out under load.
        </p>

        {error.digest && (
          <p className="mb-[26px] font-mono text-[11px] text-text-muted">Reference: {error.digest}</p>
        )}

        <div className="flex justify-center gap-2">
          <button
            onClick={reset}
            className="rounded-btn bg-accent px-4 py-2 text-[13px] font-medium text-on-accent hover:bg-accent-hover"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="rounded-btn border border-border-strong bg-[#17191D] px-4 py-2 text-[13px] text-text-primary hover:border-[#3A3D44]"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
