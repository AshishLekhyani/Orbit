import type { Metadata } from "next";
import { OrbitLogo } from "@/components/shared/OrbitLogo";
import { SignInForm } from "@/components/auth/SignInForm";

export const metadata: Metadata = { title: "Sign in — Orbit" };

export default function SignInPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-[radial-gradient(700px_420px_at_50%_10%,#17181C_0%,#0D0E10_60%)]">
      <div className="w-[372px]">
        <div className="mb-[30px] flex items-center gap-2.5">
          <OrbitLogo size={22} />
          <span className="text-sm font-semibold text-text-primary">Orbit</span>
        </div>

        <h1 className="m-0 mb-1.5 text-title font-semibold text-text-primary">
          Sign in to Orbit
        </h1>
        <p className="mb-[26px] text-[13.5px] text-text-secondary">Continue to your workspace.</p>

        <SignInForm />

        <p className="mt-[26px] text-[11.5px] leading-[1.6] text-text-muted">
          By continuing you agree to the Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
