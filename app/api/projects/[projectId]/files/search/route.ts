import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, getProjectRole } from "@/lib/auth/projectAccess";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

const MAX_MATCHES_PER_FILE = 20;
const MAX_FILES = 30;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;
  const role = await getProjectRole(projectId, userId);
  if (!role) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const caseSensitive = request.nextUrl.searchParams.get("caseSensitive") === "1";
  const wholeWord = request.nextUrl.searchParams.get("wholeWord") === "1";

  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const files = await prisma.file.findMany({
    where: {
      projectId,
      isDirectory: false,
      content: { contains: query, mode: caseSensitive ? "default" : "insensitive" },
    },
    select: { id: true, path: true, content: true },
    take: MAX_FILES,
  });

  const pattern = wholeWord ? `\\b${escapeRegExp(query)}\\b` : escapeRegExp(query);
  const matcher = new RegExp(pattern, caseSensitive ? "" : "i");

  const results = files
    .map((file) => {
      const lines = file.content.split("\n");
      const matches: { line: number; text: string }[] = [];
      for (let i = 0; i < lines.length && matches.length < MAX_MATCHES_PER_FILE; i++) {
        if (matcher.test(lines[i])) {
          matches.push({ line: i + 1, text: lines[i].trim().slice(0, 200) });
        }
      }
      return { fileId: file.id, path: file.path, matches };
    })
    .filter((file) => file.matches.length > 0);

  return NextResponse.json({ results });
}
