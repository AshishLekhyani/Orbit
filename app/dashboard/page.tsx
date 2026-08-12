import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { OrbitLogo } from "@/components/shared/OrbitLogo";
import { Button } from "@/components/shared/Button";
import { signOut } from "./actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = user
    ? await prisma.profile.findUnique({ where: { id: user.id } })
    : null;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-[52px] items-center justify-between border-b border-border-subtle bg-bg-editor px-6">
        <div className="flex items-center gap-2.5">
          <OrbitLogo size={20} />
          <span className="text-sm font-semibold text-text-primary">Orbit</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-ui text-text-secondary">{profile?.email}</span>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-8">
        <div className="text-center">
          <h1 className="m-0 text-title font-semibold text-text-primary">
            You&apos;re signed in
          </h1>
          <p className="mt-2 text-body text-text-secondary">
            The project dashboard is built in the next phase — you&apos;ll see your projects here.
          </p>
        </div>
      </main>
    </div>
  );
}
