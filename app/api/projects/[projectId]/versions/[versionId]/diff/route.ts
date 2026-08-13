import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUserId, getProjectRole } from "@/lib/auth/projectAccess";
import { getVersionFileDiff } from "@/lib/versionHistory";

interface RouteParams {
  params: Promise<{ projectId: string; versionId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, versionId } = await params;
  const role = await getProjectRole(projectId, userId);
  if (!role) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const path = request.nextUrl.searchParams.get("path");
  if (!path) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  const diff = await getVersionFileDiff(projectId, versionId, path);
  if (!diff) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ diff });
}
