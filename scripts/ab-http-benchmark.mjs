import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { PrismaClient } from "@prisma/client";

const BASE_URL = "http://localhost:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = "Test-Password-123!";
const CONFIG_LABEL = process.env.AB_CONFIG_LABEL || "unlabeled";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL });

function percentile(sortedMs, p) {
  if (sortedMs.length === 0) return null;
  const idx = Math.min(sortedMs.length - 1, Math.floor(p * sortedMs.length));
  return sortedMs[idx];
}

async function sessionCookies(email, password) {
  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const captured = [];
  const serverClient = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: { getAll: () => [], setAll: (c) => captured.push(...c) },
  });
  await serverClient.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  return captured.map((c) => `${c.name}=${c.value}`).join("; ");
}

async function timedFetch(method, path, cookie, body) {
  const start = performance.now();
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    await res.text().catch(() => {});
    return { ok: res.status < 400, status: res.status, ms: performance.now() - start };
  } catch (error) {
    return { ok: false, status: 0, ms: performance.now() - start, error: error.message };
  }
}

function summarizeLatencies(samples) {
  const ok = samples.filter((s) => s.ok);
  const ms = ok.map((s) => s.ms).sort((a, b) => a - b);
  return {
    n: samples.length,
    success: ok.length,
    failed: samples.length - ok.length,
    p50: percentile(ms, 0.5),
    p95: percentile(ms, 0.95),
    p99: percentile(ms, 0.99),
    min: ms[0] ?? null,
    max: ms[ms.length - 1] ?? null,
  };
}

function fmt(ms) {
  return ms === null || ms === undefined ? "-" : `${Math.round(ms)}ms`;
}

async function main() {
  const rand = Math.random().toString(36).slice(2, 8);
  const email = `orbit-ab-http-${rand}@example.com`;
  const { data: userData } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  const userId = userData.user.id;
  await prisma.profile.create({ data: { id: userId, email, displayName: "AB Bench User" } });

  const project = await prisma.project.create({ data: { name: `AB HTTP Bench ${rand}`, ownerId: userId } });
  const projectId = project.id;
  const folder = await prisma.file.create({
    data: { projectId, path: "assets", name: "assets", type: "OTHER", isDirectory: true, content: "" },
  });
  const file = await prisma.file.create({
    data: { projectId, path: "index.html", name: "index.html", type: "HTML", content: "<h1>bench</h1>" },
  });
  const fileId = file.id;
  const folderId = folder.id;
  const cookie = await sessionCookies(email, PASSWORD);

  console.log(`\n########## HTTP OPERATION BENCHMARK — ${CONFIG_LABEL} ##########`);
  console.log(`Project ${projectId}\n`);

  const operations = [];

  async function measure(label, samples, fn) {
    const results = [];
    for (let i = 0; i < samples; i++) {
      results.push(await fn(i));
    }
    const cold = results[0];
    const warm = results.slice(1);
    const stats = summarizeLatencies(warm.length ? warm : results);
    operations.push({ label, coldMs: cold.ms, coldOk: cold.ok, ...stats });
  }

  await measure("project page load", 20, () => timedFetch("GET", `/projects/${projectId}`, cookie));
  await measure("project/file list load", 20, () => timedFetch("GET", `/api/projects/${projectId}/files`, cookie));
  await measure("open file (snapshot GET)", 20, () => timedFetch("GET", `/api/projects/${projectId}/files/${fileId}/snapshot`, cookie));
  await measure("sharing: list members", 20, () => timedFetch("GET", `/api/projects/${projectId}/members`, cookie));
  await measure("sharing: get share link", 20, () => timedFetch("GET", `/api/projects/${projectId}/share-links`, cookie));
  await measure("version-history: list", 20, () => timedFetch("GET", `/api/projects/${projectId}/versions`, cookie));

  await measure("autosave (snapshot PUT)", 8, (i) =>
    timedFetch("PUT", `/api/projects/${projectId}/files/${fileId}/snapshot`, cookie, {
      content: `autosave content ${i}`,
      yjsState: "",
    }),
  );

  await measure("create file", 8, async (i) => {
    const name = `bench-create-${Date.now()}-${i}.txt`;
    const res = await timedFetch("POST", `/api/projects/${projectId}/files`, cookie, { name, parentId: null, isDirectory: false });
    return res;
  });

  await measure("rename file", 8, async (i) => {
    const created = await prisma.file.create({
      data: { projectId, parentId: null, path: `bench-rn-src-${i}.txt`, name: `bench-rn-src-${i}.txt`, isDirectory: false, type: "OTHER", content: "" },
    });
    const res = await timedFetch("PATCH", `/api/projects/${projectId}/files/${created.id}`, cookie, { name: `bench-rn-dst-${i}.txt` });
    await prisma.file.delete({ where: { id: created.id } }).catch(() => {});
    return res;
  });

  await measure("move file", 8, async (i) => {
    const created = await prisma.file.create({
      data: { projectId, parentId: null, path: `bench-mv-${i}.txt`, name: `bench-mv-${i}.txt`, isDirectory: false, type: "OTHER", content: "" },
    });
    const res = await timedFetch("PATCH", `/api/projects/${projectId}/files/${created.id}`, cookie, { parentId: folderId });
    await prisma.file.delete({ where: { id: created.id } }).catch(() => {});
    return res;
  });

  await measure("duplicate file", 8, async (i) => {
    const created = await prisma.file.create({
      data: { projectId, parentId: null, path: `bench-dup-${i}.txt`, name: `bench-dup-${i}.txt`, isDirectory: false, type: "OTHER", content: "hi" },
    });
    const res = await timedFetch("POST", `/api/projects/${projectId}/files/${created.id}/duplicate`, cookie);
    await prisma.file.deleteMany({ where: { projectId, path: { startsWith: "bench-dup" } } }).catch(() => {});
    return res;
  });

  await measure("delete file", 8, async (i) => {
    const created = await prisma.file.create({
      data: { projectId, parentId: null, path: `bench-del-${Date.now()}-${i}.txt`, name: `bench-del-${i}.txt`, isDirectory: false, type: "OTHER", content: "" },
    });
    return timedFetch("DELETE", `/api/projects/${projectId}/files/${created.id}`, cookie);
  });

  await measure("version-history: create checkpoint", 6, async (i) => {
    await prisma.file.update({ where: { id: fileId }, data: { content: `bench checkpoint content ${i}-${Date.now()}` } });
    return timedFetch("POST", `/api/projects/${projectId}/versions`, cookie, { message: `bench checkpoint ${i}` });
  });

  console.log(
    "operation".padEnd(34) + "cold".padEnd(9) + "p50".padEnd(9) + "p95".padEnd(9) + "p99".padEnd(9) + "min".padEnd(9) + "max".padEnd(9) + "success",
  );
  for (const op of operations) {
    console.log(
      op.label.padEnd(34) +
        fmt(op.coldMs).padEnd(9) +
        fmt(op.p50).padEnd(9) +
        fmt(op.p95).padEnd(9) +
        fmt(op.p99).padEnd(9) +
        fmt(op.min).padEnd(9) +
        fmt(op.max).padEnd(9) +
        `${op.success}/${op.n}`,
    );
  }

  console.log(`\n########## CONCURRENCY BENCHMARK — ${CONFIG_LABEL} ##########`);
  console.log("(distinct users/projects per concurrent request, hitting project page load)\n");

  const concurrencyLevels = [1, 2, 4, 8, 16, 20];
  const maxUsers = Math.max(...concurrencyLevels);
  const bulkUsers = [];
  for (let i = 0; i < maxUsers; i++) {
    const bEmail = `orbit-ab-conc-${rand}-${i}@example.com`;
    const { data } = await admin.auth.admin.createUser({ email: bEmail, password: PASSWORD, email_confirm: true });
    await prisma.profile.create({ data: { id: data.user.id, email: bEmail } });
    const p = await prisma.project.create({ data: { name: `Conc ${rand} ${i}`, ownerId: data.user.id } });
    const c = await sessionCookies(bEmail, PASSWORD);
    bulkUsers.push({ userId: data.user.id, projectId: p.id, cookie: c });
  }

  console.log("concurrency".padEnd(12) + "success".padEnd(9) + "failed".padEnd(8) + "poolErr".padEnd(9) + "p50".padEnd(9) + "p95".padEnd(9) + "max");
  for (const concurrency of concurrencyLevels) {
    const calls = Array.from({ length: concurrency }, (_, i) => {
      const u = bulkUsers[i % bulkUsers.length];
      return (async () => {
        const start = performance.now();
        try {
          const res = await fetch(`${BASE_URL}/projects/${u.projectId}`, { headers: { Cookie: u.cookie } });
          const text = await res.text().catch(() => "");
          return { ok: res.status < 400, status: res.status, ms: performance.now() - start, isPoolError: /connection pool/i.test(text) };
        } catch (error) {
          return { ok: false, status: 0, ms: performance.now() - start, isPoolError: false, error: error.message };
        }
      })();
    });
    const results = await Promise.all(calls);
    const ok = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);
    const poolErr = results.filter((r) => r.isPoolError);
    const ms = ok.map((r) => r.ms).sort((a, b) => a - b);
    console.log(
      String(concurrency).padEnd(12) +
        String(ok.length).padEnd(9) +
        String(failed.length).padEnd(8) +
        String(poolErr.length).padEnd(9) +
        fmt(percentile(ms, 0.5)).padEnd(9) +
        fmt(percentile(ms, 0.95)).padEnd(9) +
        fmt(ms[ms.length - 1]),
    );
    if (failed.length) {
      console.log("  failures:", failed.slice(0, 3).map((f) => `status=${f.status} err=${f.error ?? ""}`));
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  for (const u of bulkUsers) {
    await prisma.project.delete({ where: { id: u.projectId } }).catch(() => {});
    await admin.auth.admin.deleteUser(u.userId).catch(() => {});
    await prisma.profile.delete({ where: { id: u.userId } }).catch(() => {});
  }
  await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
  await admin.auth.admin.deleteUser(userId).catch(() => {});
  await prisma.profile.delete({ where: { id: userId } }).catch(() => {});
  await prisma.$disconnect();

  console.log(`\n${CONFIG_LABEL} complete.\n`);
}

main().catch(async (e) => {
  console.error("FATAL:", e);
  await prisma.$disconnect();
  process.exit(1);
});
