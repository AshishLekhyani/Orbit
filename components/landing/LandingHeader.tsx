import { OrbitLogo } from "@/components/shared/OrbitLogo";
import { Button } from "@/components/shared/Button";

export function LandingHeader() {
  return (
    <header className="flex h-[60px] items-center justify-between border-b border-border-subtle px-8">
      <div className="flex items-center gap-2.5">
        <OrbitLogo size={22} />
        <span className="text-sm font-semibold tracking-[-0.01em] text-text-primary">Orbit</span>
      </div>
      <div className="flex items-center gap-6">
        <span className="text-sm text-text-secondary">Docs</span>
        <span className="text-sm text-text-secondary">Changelog</span>
        <Button href="/signin" variant="secondary" size="sm">
          Sign in
        </Button>
      </div>
    </header>
  );
}
