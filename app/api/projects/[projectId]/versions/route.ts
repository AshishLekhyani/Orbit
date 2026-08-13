import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUserId, getProjectRole, roleAtLeast } from "@/lib/auth/projectAccess";
import { createCheckpoint, listVersionsWithStats } from "@/lib/versionHistory";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;
  const role = await getProjectRole(projectId, userId);
  if (!role) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const versions = await listVersionsWithStats(projectId);
  return NextResponse.json({ versions });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;
  const role = await getProjectRole(projectId, userId);
  if (!roleAtLeast(role, "EDITOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "A message is required" }, { status: 400 });
  }

  const version = await createCheckpoint(projectId, userId, message);
  if (!version) {
    return NextResponse.json({ error: "Nothing to save — no changes since the last version" }, { status: 400 });
  }

  return NextResponse.json({ version }, { status: 201 });
}
