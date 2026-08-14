import { OrbitLogo } from "@/components/shared/OrbitLogo";

export default function ShareLoading() {
  return (
    <div className="grid min-h-screen place-items-center bg-[radial-gradient(700px_420px_at_50%_10%,#17181C_0%,#0D0E10_60%)]">
      <OrbitLogo size={32} className="animate-pulse" />
    </div>
  );
}
