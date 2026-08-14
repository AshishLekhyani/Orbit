import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth/projectAccess";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const userId = await getCurrentUserId();

  if (!userId) {
    redirect("/signin");
  }

  return <>{children}</>;
}
