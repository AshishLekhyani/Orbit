import { PrismaClient } from "@prisma/client";

const TX_POOLER_URL = process.env.DATABASE_URL;
const SESSION_POOLER_URL = process.env.DIRECT_URL;
const base = TX_POOLER_URL.split("?")[0];
const TX_POOLER_NO_PGBOUNCER_URL = `${base}?connection_limit=1`;

function makeClient(url) {
  const client = new PrismaClient({
    datasourceUrl: url,
    log: [{ emit: "event", level: "query" }],
  });
  const queries = [];
  client.$on("query", (event) => {
    queries.push({ query: event.query, duration: event.duration });
  });
  return { client, queries };
}

function summarize(queries) {
  return queries.map((q) => `${String(q.duration).padStart(6)}ms  ${q.query.slice(0, 100)}`).join("\n  ");
}

async function timed(fn) {
  const t0 = performance.now();
  await fn();
  return Math.round(performance.now() - t0);
}

async function benchOperation(label, url, fn) {
  const { client, queries } = makeClient(url);
  queries.length = 0;
  const coldMs = await timed(() => fn(client));
  const coldQueries = [...queries];
  queries.length = 0;
  const warmMs = await timed(() => fn(client));
  const warmQueries = [...queries];
  console.log(`\n--- ${label} ---`);
  console.log(`cold: ${coldMs}ms wall-clock, ${coldQueries.length} SQL statements`);
  if (coldQueries.length) console.log(`  ${summarize(coldQueries)}`);
  console.log(`warm: ${warmMs}ms wall-clock, ${warmQueries.length} SQL statements`);
  if (warmQueries.length) console.log(`  ${summarize(warmQueries)}`);
  await client.$disconnect();
}

async function benchRawConnections() {
  console.log("\n\n########## PART 1: connection-mode comparison (raw queries, isolated from app logic) ##########");
  const modes = [
    ["transaction-mode pooler, pgbouncer=true (current DATABASE_URL / prod config)", TX_POOLER_URL],
    ["transaction-mode pooler, pgbouncer=true removed (prepared statements ON — unsafe under real concurrency, for comparison only)", TX_POOLER_NO_PGBOUNCER_URL],
    ["session-mode pooler (current DIRECT_URL — prepared statements supported)", SESSION_POOLER_URL],
  ];

  for (const [label, url] of modes) {
    console.log(`\n=== ${label} ===`);
    await benchOperation("single query", url, (c) => c.profile.findMany({ take: 1 }));
    await benchOperation("3 sequential queries", url, async (c) => {
      await c.profile.findMany({ take: 1 });
      await c.profile.findMany({ take: 1 });
      await c.profile.findMany({ take: 1 });
    });
    await benchOperation("3 parallel queries", url, (c) =>
      Promise.all([c.profile.findMany({ take: 1 }), c.profile.findMany({ take: 1 }), c.profile.findMany({ take: 1 })]),
    );
  }
}

function moveOrRenameFile(prisma, projectId, fileId, changes) {
  return (async () => {
    const [file, parent] = await Promise.all([
      prisma.file.findFirst({ where: { id: fileId, projectId } }),
      changes.parentId
        ? prisma.file.findFirst({ where: { id: changes.parentId, projectId, isDirectory: true }, select: { path: true } })
        : Promise.resolve(null),
    ]);
    if (!file) return;

    const nextName = changes.name?.trim() || file.name;
    const parentChanging = changes.parentId !== undefined;
    const resolvedParentId = parentChanging ? changes.parentId : file.parentId;

    let parentPath = null;
    if (resolvedParentId) {
      if (parentChanging) {
        parentPath = parent?.path ?? null;
      } else {
        const lastSlash = file.path.lastIndexOf("/");
        parentPath = lastSlash === -1 ? null : file.path.slice(0, lastSlash);
      }
    }
    const nextPath = parentPath ? `${parentPath}/${nextName}` : nextName;

    if (nextPath !== file.path) {
      await prisma.file.findUnique({ where: { projectId_path: { projectId, path: nextPath } } });
    }

    await prisma.$transaction(async (tx) => {
      await tx.file.update({ where: { id: fileId }, data: { name: nextName, parentId: resolvedParentId, path: nextPath } });
    });
  })();
}

async function benchRealOperations(projectId) {
  console.log("\n\n########## PART 2: exact application query sequences (transaction-mode pooler, current prod config) ##########");
  const url = TX_POOLER_URL;

  await benchOperation("getProjectRole (owner fast-path, called before every authorized route)", url, async (c) => {
    await c.project.findUnique({ where: { id: projectId }, select: { ownerId: true } });
  });

  await benchOperation("open/load file — GET", url, async (c) => {
    await c.file.findFirst({ where: { projectId, isDirectory: false } });
  });

  await benchOperation("autosave content — PATCH (content-only)", url, async (c) => {
    const file = await c.file.findFirst({ where: { projectId, isDirectory: false } });
    await c.file.update({ where: { id: file.id }, data: { content: file.content } });
    await c.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } });
    await c.file.findUnique({ where: { id: file.id } });
  });

  await benchOperation("create file — POST (root level)", url, async (c) => {
    const name = `bench-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.txt`;
    await c.file.findUnique({ where: { projectId_path: { projectId, path: name } } });
    const file = await c.file.create({
      data: { projectId, parentId: null, path: name, name, isDirectory: false, type: "OTHER", content: "" },
    });
    await c.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } });
    await c.file.delete({ where: { id: file.id } });
  });

  await benchOperation("rename file — PATCH (moveOrRenameFile + route wrapper, path changes)", url, async (c) => {
    const target = await c.file.findFirst({ where: { projectId, isDirectory: false } });
    const tempName = `bench-rename-${Date.now()}.txt`;
    await moveOrRenameFile(c, projectId, target.id, { name: tempName });
    await c.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } });
    await c.file.findUnique({ where: { id: target.id } });
    await moveOrRenameFile(c, projectId, target.id, { name: target.name });
  });

  await benchOperation("duplicate file — POST", url, async (c) => {
    const source = await c.file.findFirst({ where: { projectId, isDirectory: false } });
    const copyName = `bench-copy-${Date.now()}.txt`;
    await c.file.findUnique({ where: { projectId_path: { projectId, path: copyName } } });
    const created = await c.file.create({
      data: { projectId, parentId: source.parentId, path: copyName, name: copyName, isDirectory: false, type: source.type, content: source.content },
    });
    await c.file.delete({ where: { id: created.id } });
  });

  await benchOperation("delete file — DELETE (create scratch file first, not timed)", url, async (c) => {
    const name = `bench-del-${Date.now()}.txt`;
    const created = await c.file.create({
      data: { projectId, parentId: null, path: name, name, isDirectory: false, type: "OTHER", content: "" },
    });
    await c.file.findFirst({ where: { id: created.id, projectId } });
    await c.file.delete({ where: { id: created.id } });
  });
}

async function benchAuthLayer() {
  console.log("\n\n########## PART 3: Supabase Auth layer (getCurrentUserId — not a Postgres query) ##########");
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  for (let i = 1; i <= 3; i++) {
    const t0 = performance.now();
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: ANON_KEY } });
    await res.json();
    console.log(`call ${i}: ${Math.round(performance.now() - t0)}ms (network round-trip only, no user token validation)`);
  }
}

async function main() {
  const admin = new PrismaClient({ datasourceUrl: TX_POOLER_URL });
  const project = await admin.project.findFirst({ select: { id: true } });
  await admin.$disconnect();
  if (!project) {
    console.error("No project found to benchmark against.");
    process.exit(1);
  }
  console.log(`Benchmarking against project ${project.id}`);

  await benchRawConnections();
  await benchRealOperations(project.id);
  await benchAuthLayer();

  console.log("\n\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
