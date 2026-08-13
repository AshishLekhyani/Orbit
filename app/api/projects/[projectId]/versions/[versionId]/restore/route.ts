import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUserId, getProjectRole, roleAtLeast } from "@/lib/auth/projectAccess";
import { restoreVersion } from "@/lib/restoreVersion";

interface RouteParams {
  params: Promise<{ projectId: string; versionId: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, versionId } = await params;
  const role = await getProjectRole(projectId, userId);
  if (!roleAtLeast(role, "EDITOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const newVersion = await restoreVersion(projectId, versionId, userId);
  if (!newVersion) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ version: newVersion });
}
