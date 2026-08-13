import { PrismaClient } from "@prisma/client";

const BASE_URL = process.env.DATABASE_URL;
if (!BASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const CONCURRENCY_LEVELS = process.env.BENCH_CONCURRENCY
  ? process.env.BENCH_CONCURRENCY.split(",").map(Number)
  : [1, 2, 4, 8];
const CONNECTION_LIMITS = process.env.BENCH_LIMITS
  ? process.env.BENCH_LIMITS.split(",").map(Number)
  : [1, 3, 5];

function urlWithLimit(limit) {
  const url = new URL(BASE_URL);
  url.searchParams.set("connection_limit", String(limit));
  return url.toString();
}

function percentile(sorted, p) {
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}

async function timedCall(fn) {
  const start = performance.now();
  try {
    await fn();
    return { ok: true, ms: performance.now() - start };
  } catch (error) {
    return {
      ok: false,
      ms: performance.now() - start,
      isPoolTimeout: /connection pool/i.test(error.message ?? ""),
      message: error.message?.split("\n")[0] ?? String(error),
    };
  }
}

async function runConcurrency(client, pairs, concurrency) {
  const calls = Array.from({ length: concurrency }, (_, i) => {
    const pair = pairs[i % pairs.length];
    return timedCall(() =>
      client.$queryRawUnsafe(
        `select "ownerId", (select role from project_members where "projectId" = $1 and "userId" = $2) as member_role from projects where id = $1`,
        pair.projectId,
        pair.userId,
      ),
    );
  });
  const results = await Promise.all(calls);
  const oks = results.filter((r) => r.ok);
  const fails = results.filter((r) => !r.ok);
  const poolTimeouts = fails.filter((r) => r.isPoolTimeout);
  const latencies = oks.map((r) => r.ms).sort((a, b) => a - b);

  return {
    concurrency,
    success: oks.length,
    failed: fails.length,
    poolTimeouts: poolTimeouts.length,
    otherErrors: fails.filter((r) => !r.isPoolTimeout).map((r) => r.message),
    minMs: latencies.length ? latencies[0].toFixed(0) : "-",
    avgMs: latencies.length ? (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(0) : "-",
    p95Ms: latencies.length ? percentile(latencies, 0.95).toFixed(0) : "-",
    maxMs: latencies.length ? latencies[latencies.length - 1].toFixed(0) : "-",
  };
}

async function seedPairs(seedClient, count) {
  const rand = Math.random().toString(36).slice(2, 8);
  const pairs = [];
  for (let i = 0; i < count; i++) {
    const owner = await seedClient.profile.create({
      data: { id: `bench-owner-${rand}-${i}`, email: `bench-owner-${rand}-${i}@example.com` },
    });
    const project = await seedClient.project.create({
      data: { name: `Bench ${rand} ${i}`, ownerId: owner.id },
    });
    pairs.push({ projectId: project.id, userId: owner.id, ownerId: owner.id });
  }
  return pairs;
}

async function cleanupPairs(seedClient, pairs) {
  for (const pair of pairs) {
    await seedClient.project.delete({ where: { id: pair.projectId } }).catch(() => {});
    await seedClient.profile.delete({ where: { id: pair.ownerId } }).catch(() => {});
  }
}

async function main() {
  const seedClient = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL });
  const pairs = await seedPairs(seedClient, Math.max(...CONCURRENCY_LEVELS));
  console.log(`Benchmarking against ${pairs.length} distinct scratch project/user pairs\n`);
  console.log(
    "limit".padEnd(6) +
      "concurrency".padEnd(12) +
      "success".padEnd(9) +
      "failed".padEnd(8) +
      "poolTO".padEnd(8) +
      "min".padEnd(7) +
      "avg".padEnd(7) +
      "p95".padEnd(7) +
      "max",
  );

  for (const limit of CONNECTION_LIMITS) {
    const client = new PrismaClient({ datasourceUrl: urlWithLimit(limit) });
    await client.$connect();

    for (const concurrency of CONCURRENCY_LEVELS) {
      const r = await runConcurrency(client, pairs, concurrency);
      console.log(
        String(limit).padEnd(6) +
          String(r.concurrency).padEnd(12) +
          String(r.success).padEnd(9) +
          String(r.failed).padEnd(8) +
          String(r.poolTimeouts).padEnd(8) +
          `${r.minMs}ms`.padEnd(7) +
          `${r.avgMs}ms`.padEnd(7) +
          `${r.p95Ms}ms`.padEnd(7) +
          `${r.maxMs}ms`,
      );
      if (r.otherErrors.length) {
        console.log("   other errors:", r.otherErrors.slice(0, 3));
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    await client.$disconnect();
    console.log("");
  }

  await cleanupPairs(seedClient, pairs);
  await seedClient.$disconnect();
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
