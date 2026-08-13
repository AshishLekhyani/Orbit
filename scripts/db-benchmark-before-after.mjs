import { PrismaClient } from "@prisma/client";

const TX_POOLER_URL = process.env.DATABASE_URL;

function makeClient() {
  const client = new PrismaClient({ datasourceUrl: TX_POOLER_URL, log: [{ emit: "event", level: "query" }] });
  const queries = [];
  client.$on("query", (event) => queries.push({ query: event.query, duration: event.duration }));
  return { client, queries };
}

async function timed(fn) {
  const t0 = performance.now();
  await fn();
  return Math.round(performance.now() - t0);
}

async function bench(label, warmup, fn) {
  const { client, queries } = makeClient();
  await warmup(client);
  queries.length = 0;
  const warmMs = await timed(() => fn(client));
  console.log(`${label}\n  ${warmMs}ms warm, ${queries.length} SQL statements = ${queries.length / 4} logical queries`);
  await client.$disconnect();
}

function moveOrRenameFileAfter(prisma, projectId, fileId, changes) {
  return (async () => {
    const [file, parent] = await Promise.all([
      prisma.file.findFirst({ where: { id: fileId, projectId } }),
      changes.parentId
        ? prisma.file.findFirst({ where: { id: changes.parentId, projectId, isDirectory: true }, select: { path: true } })
        : Promise.resolve(null),
    ]);
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
    return prisma.$transaction((tx) =>
      tx.file.update({ where: { id: fileId }, data: { name: nextName, parentId: resolvedParentId, path: nextPath } }),
    );
  })();
}

async function main() {
  const admin = new PrismaClient({ datasourceUrl: TX_POOLER_URL });
  const project = await admin.project.findFirst({ select: { id: true } });
  const file = await admin.file.findFirst({ where: { projectId: project.id, isDirectory: false } });
  await admin.$disconnect();
  console.log(`Benchmarking against project ${project.id}, file ${file.path}\n`);

  console.log("=== AUTOSAVE (content-only PATCH), 1 query is a no-op warmup to establish a warm connection first ===\n");

  await bench(
    "BEFORE: update + project.update + findUnique (3 queries)",
    (c) => c.profile.findFirst(),
    async (c) => {
      await c.file.update({ where: { id: file.id }, data: { content: file.content } });
      await c.project.update({ where: { id: project.id }, data: { updatedAt: new Date() } });
      await c.file.findUnique({ where: { id: file.id } });
    },
  );

  await bench(
    "AFTER: update only (1 query)",
    (c) => c.profile.findFirst(),
    async (c) => {
      await c.file.update({ where: { id: file.id }, data: { content: file.content } });
    },
  );

  console.log("\n=== RENAME (structural PATCH), single direction, restore is untimed cleanup ===\n");

  await bench(
    "BEFORE: parallel-fetch(as-sequential) + collision check + transaction + project.update + findUnique (5 queries)",
    (c) => c.profile.findFirst(),
    async (c) => {
      const tempName = `bench-before-${Date.now()}.txt`;
      const f = await c.file.findFirst({ where: { id: file.id, projectId: project.id } });
      await c.file.findUnique({ where: { projectId_path: { projectId: project.id, path: tempName } } });
      await c.$transaction((tx) => tx.file.update({ where: { id: f.id }, data: { name: tempName, path: tempName } }));
      await c.project.update({ where: { id: project.id }, data: { updatedAt: new Date() } });
      await c.file.findUnique({ where: { id: f.id } });
    },
  );
  await restore(file);

  await bench(
    "AFTER: parallel fetch + collision check + transaction + project.update (4 queries, no re-fetch)",
    (c) => c.profile.findFirst(),
    async (c) => {
      const tempName = `bench-after-${Date.now()}.txt`;
      await moveOrRenameFileAfter(c, project.id, file.id, { name: tempName });
      await c.project.update({ where: { id: project.id }, data: { updatedAt: new Date() } });
    },
  );
  await restore(file);

  async function restore(originalFile) {
    const restoreClient = new PrismaClient({ datasourceUrl: TX_POOLER_URL });
    await restoreClient.file.update({ where: { id: originalFile.id }, data: { name: originalFile.name, path: originalFile.path } });
    await restoreClient.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
