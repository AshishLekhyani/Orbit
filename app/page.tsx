import { LandingHeader } from "@/components/landing/LandingHeader";
import { Hero } from "@/components/landing/Hero";
import { EditorShowcase } from "@/components/landing/EditorShowcase";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(1100px_520px_at_50%_-12%,#17181C_0%,#0D0E10_62%)]">
      <LandingHeader />
      <main className="flex flex-1 flex-col items-center">
        <Hero />
        <EditorShowcase />
      </main>
      <FeaturesSection />
      <LandingFooter />
    </div>
  );
}
