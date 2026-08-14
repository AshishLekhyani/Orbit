import { PrismaClient } from "@prisma/client";

const base = process.env.DATABASE_URL.split("?")[0];
const directBase = process.env.DIRECT_URL.split("?")[0];

const CONFIG_A_URL = `${base}?pgbouncer=true&connection_limit=5&pool_timeout=15`;
const CONFIG_B_URL = `${directBase}?connection_limit=5&pool_timeout=15`;

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

async function timed(fn) {
  const t0 = performance.now();
  await fn();
  return performance.now() - t0;
}

async function benchOperation(results, label, url, fn) {
  const { client, queries } = makeClient(url);

  queries.length = 0;
  const coldMs = await timed(() => fn(client));
  const coldCount = queries.length;
  const coldSqlMs = queries.reduce((sum, q) => sum + q.duration, 0);

  const warmSamples = [];
  let warmCount = 0;
  let warmSqlMs = 0;
  for (let i = 0; i < 5; i++) {
    queries.length = 0;
    const ms = await timed(() => fn(client));
    warmSamples.push(ms);
    warmCount = queries.length;
    warmSqlMs = queries.reduce((sum, q) => sum + q.duration, 0);
  }
  warmSamples.sort((a, b) => a - b);
  const warmP50 = warmSamples[Math.floor(warmSamples.length * 0.5)];
  const warmMin = warmSamples[0];
  const warmMax = warmSamples[warmSamples.length - 1];

  results.push({
    label,
    coldMs: Math.round(coldMs),
    coldCount,
    coldSqlMs: Math.round(coldSqlMs),
    warmMinMs: Math.round(warmMin),
    warmP50Ms: Math.round(warmP50),
    warmMaxMs: Math.round(warmMax),
    warmCount,
    warmSqlMs: Math.round(warmSqlMs),
    connectionOverheadMs: Math.round(warmP50 - warmSqlMs),
  });

  await client.$disconnect();
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
      if (parentChanging) parentPath = parent?.path ?? null;
      else {
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

async function runOperationsForConfig(configLabel, url, ctx) {
  const results = [];

  await benchOperation(results, "project page load (getProjectRole + project fetch + profile)", url, async (c) => {
    const project = await c.project.findUnique({
      where: { id: ctx.projectId },
      select: { ownerId: true, members: { where: { userId: ctx.userId }, select: { role: true } } },
    });
    void project;
    await c.project.findUnique({ where: { id: ctx.projectId } });
    await c.profile.findUnique({ where: { id: ctx.userId } });
  });

  await benchOperation(results, "project/file list load", url, async (c) => {
    await c.file.findMany({
      where: { projectId: ctx.projectId },
      select: { id: true, path: true, name: true, type: true, isDirectory: true, parentId: true, updatedAt: true },
      orderBy: { path: "asc" },
    });
  });

  await benchOperation(results, "open file (snapshot GET)", url, async (c) => {
    await c.file.findFirst({ where: { id: ctx.fileId, projectId: ctx.projectId }, select: { content: true, yjsState: true } });
  });

  await benchOperation(results, "create file (root level)", url, async (c) => {
    const name = `bench-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.txt`;
    await c.file.findUnique({ where: { projectId_path: { projectId: ctx.projectId, path: name } } });
    const file = await c.file.create({
      data: { projectId: ctx.projectId, parentId: null, path: name, name, isDirectory: false, type: "OTHER", content: "" },
    });
    await c.project.update({ where: { id: ctx.projectId }, data: { updatedAt: new Date() } });
    await c.file.delete({ where: { id: file.id } });
  });

  await benchOperation(results, "rename file (path changes)", url, async (c) => {
    const tempName = `bench-rename-${Date.now()}.txt`;
    await moveOrRenameFile(c, ctx.projectId, ctx.fileId, { name: tempName });
    await c.project.update({ where: { id: ctx.projectId }, data: { updatedAt: new Date() } });
    await moveOrRenameFile(c, ctx.projectId, ctx.fileId, { name: "index.html" });
  });

  await benchOperation(results, "duplicate file", url, async (c) => {
    const source = await c.file.findFirst({ where: { id: ctx.fileId, projectId: ctx.projectId } });
    const copyName = `bench-copy-${Date.now()}.txt`;
    await c.file.findUnique({ where: { projectId_path: { projectId: ctx.projectId, path: copyName } } });
    const created = await c.file.create({
      data: {
        projectId: ctx.projectId,
        parentId: source.parentId,
        path: copyName,
        name: copyName,
        isDirectory: false,
        type: source.type,
        content: source.content,
      },
    });
    await c.file.delete({ where: { id: created.id } });
  });

  await benchOperation(results, "delete file (create scratch first, untimed)", url, async (c) => {
    const name = `bench-del-${Date.now()}.txt`;
    const created = await c.file.create({
      data: { projectId: ctx.projectId, parentId: null, path: name, name, isDirectory: false, type: "OTHER", content: "" },
    });
    await c.file.findFirst({ where: { id: created.id, projectId: ctx.projectId } });
    await c.file.delete({ where: { id: created.id } });
  });

  await benchOperation(results, "move file (into folder + back)", url, async (c) => {
    const folder = await c.file.findFirst({ where: { projectId: ctx.projectId, isDirectory: true } });
    if (!folder) return;
    await moveOrRenameFile(c, ctx.projectId, ctx.fileId, { parentId: folder.id });
    await c.project.update({ where: { id: ctx.projectId }, data: { updatedAt: new Date() } });
    await moveOrRenameFile(c, ctx.projectId, ctx.fileId, { parentId: null });
  });

  await benchOperation(results, "autosave (snapshot PUT, content-only)", url, async (c) => {
    const exists = await c.file.findFirst({ where: { id: ctx.fileId, projectId: ctx.projectId }, select: { id: true } });
    void exists;
    await c.file.update({ where: { id: ctx.fileId }, data: { content: "autosave-bench-content", yjsState: Buffer.from("") } });
  });

  await benchOperation(results, "sharing: list members", url, async (c) => {
    await c.project.findUnique({
      where: { id: ctx.projectId },
      select: {
        owner: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        members: {
          select: { id: true, role: true, user: { select: { id: true, displayName: true, email: true, avatarUrl: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });
  });

  await benchOperation(results, "sharing: get active share link", url, async (c) => {
    await c.shareLink.findFirst({
      where: { projectId: ctx.projectId, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: { createdAt: "desc" },
    });
  });

  await benchOperation(results, "version-history: list with stats", url, async (c) => {
    await c.projectVersion.findMany({
      where: { projectId: ctx.projectId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        message: true,
        createdAt: true,
        author: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        fileSnapshots: { select: { path: true, content: true, changeType: true } },
      },
    });
  });

  await benchOperation(results, "version-history: create checkpoint (write)", url, async (c) => {
    const liveFiles = await c.file.findMany({ where: { projectId: ctx.projectId, isDirectory: false }, select: { path: true, content: true } });
    void liveFiles;
    const version = await c.projectVersion.create({
      data: {
        projectId: ctx.projectId,
        authorId: ctx.userId,
        message: "bench checkpoint",
        fileSnapshots: { create: [{ path: "bench-file.txt", content: "bench content", changeType: "ADDED" }] },
      },
    });
    await c.projectVersion.delete({ where: { id: version.id } });
  });

  console.log(`\n=== ${configLabel} (${url.includes(":6543") ? "transaction mode :6543" : "session mode :5432"}) ===`);
  console.log(
    "operation".padEnd(48) +
      "cold".padEnd(9) +
      "coldSQL".padEnd(10) +
      "warmP50".padEnd(10) +
      "warmSQL".padEnd(10) +
      "connOverhead".padEnd(14) +
      "stmts",
  );
  for (const r of results) {
    console.log(
      r.label.slice(0, 46).padEnd(48) +
        `${r.coldMs}ms`.padEnd(9) +
        `${r.coldSqlMs}ms`.padEnd(10) +
        `${r.warmP50Ms}ms`.padEnd(10) +
        `${r.warmSqlMs}ms`.padEnd(10) +
        `${r.connectionOverheadMs}ms`.padEnd(14) +
        `${r.warmCount}`,
    );
  }

  return results;
}

async function main() {
  const seed = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL });
  const rand = Math.random().toString(36).slice(2, 8);
  const email = `orbit-ab-bench-${rand}@example.com`;
  const owner = await seed.profile.create({ data: { id: `bench-owner-${rand}`, email } });
  const project = await seed.project.create({ data: { name: `AB Bench ${rand}`, ownerId: owner.id } });
  const file = await seed.file.create({
    data: { projectId: project.id, path: "index.html", name: "index.html", type: "HTML", content: "<h1>bench</h1>" },
  });
  await seed.file.create({
    data: { projectId: project.id, path: "assets", name: "assets", type: "OTHER", isDirectory: true, content: "" },
  });

  const ctx = { projectId: project.id, userId: owner.id, fileId: file.id };
  console.log(`Benchmarking against scratch project ${project.id}`);

  const resultsA = await runOperationsForConfig("Config A: transaction mode", CONFIG_A_URL, ctx);
  const resultsB = await runOperationsForConfig("Config B: session mode", CONFIG_B_URL, ctx);

  console.log("\n\n=== A vs B: warm p50 latency delta ===");
  console.log("operation".padEnd(48) + "A (tx)".padEnd(10) + "B (session)".padEnd(12) + "delta".padEnd(10) + "speedup");
  for (let i = 0; i < resultsA.length; i++) {
    const a = resultsA[i];
    const b = resultsB[i];
    const delta = a.warmP50Ms - b.warmP50Ms;
    const speedup = a.warmP50Ms / Math.max(b.warmP50Ms, 1);
    console.log(
      a.label.slice(0, 46).padEnd(48) +
        `${a.warmP50Ms}ms`.padEnd(10) +
        `${b.warmP50Ms}ms`.padEnd(12) +
        `${delta > 0 ? "-" : "+"}${Math.abs(delta)}ms`.padEnd(10) +
        `${speedup.toFixed(2)}x`,
    );
  }

  await seed.project.delete({ where: { id: project.id } }).catch(() => {});
  await seed.profile.delete({ where: { id: owner.id } }).catch(() => {});
  await seed.$disconnect();

  console.log("\nDone.");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
