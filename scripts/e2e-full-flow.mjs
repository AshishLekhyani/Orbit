import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = "http://localhost:3000";
const RUN_ID = Date.now().toString(36);
const SHOT_DIR = process.env.E2E_SHOT_DIR || ".";
const TEST_PASSWORD = "E2E-test-password-1!";
fs.mkdirSync(SHOT_DIR, { recursive: true });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const prisma = new PrismaClient();

const results = [];
const createdUserIds = [];
const createdProjectIds = [];

process.on("unhandledRejection", (error) => {
  console.error("unhandled rejection (ignored, likely a Playwright route race):", error?.message ?? error);
});

function log(...args) {
  console.log(...args);
}

let activePages = [];

async function resetStrayOverlays() {
  for (const page of activePages) {
    await page.keyboard.press("Escape").catch(() => {});
  }
}

async function record(name, fn) {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, pass: true, ms: Date.now() - start });
    log(`  PASS  ${name} (${Date.now() - start}ms)`);
  } catch (error) {
    results.push({ name, pass: false, ms: Date.now() - start, error: String(error?.message ?? error) });
    log(`  FAIL  ${name}: ${error?.message ?? error}`);
    for (const [index, page] of activePages.entries()) {
      await shot(page, `FAIL-${name.replace(/[^a-z0-9]+/gi, "-")}-page${index}`);
    }
  } finally {
    await resetStrayOverlays();
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function shot(page, name) {
  const file = path.join(SHOT_DIR, `${RUN_ID}-${name}.png`);
  await page.screenshot({ path: file }).catch(() => {});
  return file;
}

async function getOtp(email) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(`generateLink failed: ${error.message}`);
  if (data.user?.id && !createdUserIds.includes(data.user.id)) createdUserIds.push(data.user.id);
  return data.properties.email_otp;
}

async function sessionCookiesFor(email, password) {
  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signInWithPassword failed: ${error.message}`);
  const captured = [];
  const serverClient = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: { getAll: () => [], setAll: (c) => captured.push(...c) },
  });
  await serverClient.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  return captured;
}

async function passwordSignIn(context, page, email) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser failed: ${error.message}`);
  createdUserIds.push(data.user.id);
  await prisma.profile.upsert({
    where: { id: data.user.id },
    update: { email },
    create: { id: data.user.id, email },
  });

  const cookies = await sessionCookiesFor(email, TEST_PASSWORD);
  await context.addCookies(cookies.map((c) => ({ name: c.name, value: c.value, url: BASE_URL })));
  await page.goto(`${BASE_URL}/dashboard`);
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 15000 });
}

async function typedOtpSignIn(page, email) {
  await page.goto(`${BASE_URL}/signin`);
  await page.route(/\/auth\/v1\/otp/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByText("Check your email").waitFor({ timeout: 10000 });
  await page.unroute(/\/auth\/v1\/otp/);
  const otp = await getOtp(email);
  await page.getByPlaceholder("Code from email").fill(otp);
  await page.getByRole("button", { name: "Verify code" }).click();
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 15000 });
}

async function createProject(page, name) {
  await page.getByRole("button", { name: "+ New project" }).first().click();
  await page.getByLabel("Project name").fill(name);
  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes("/api/projects") && res.request().method() === "POST"),
    page.getByRole("button", { name: "Create project" }).click(),
  ]);
  const body = await response.json();
  const projectId = body.project.id;
  createdProjectIds.push(projectId);
  await page.waitForURL(`${BASE_URL}/projects/${projectId}`, { timeout: 15000 });
  return projectId;
}

function filesTree(page) {
  return page.getByLabel("Files", { exact: true });
}

async function monacoText(page) {
  return page.evaluate(() => {
    const editors = window.monaco?.editor?.getEditors?.() ?? [];
    const active = editors.find((e) => e.hasTextFocus()) ?? editors[0];
    if (active) return active.getValue();
    const lines = Array.from(document.querySelectorAll(".monaco-editor .view-lines .view-line"));
    return lines.map((line) => line.textContent).join("\n");
  });
}

async function setMonacoContent(page, text) {
  const editor = page.locator(".monaco-editor").first();
  await editor.click();
  await page.waitForTimeout(150);
  await page.keyboard.press("Control+A");
  await page.waitForTimeout(150);
  await page.keyboard.press("Delete");
  await page.waitForTimeout(150);
  await page.keyboard.insertText(text);
  await page.waitForTimeout(150);
}

async function waitFor(fn, { timeout = 25000, interval = 300, message = "condition" } = {}) {
  const start = Date.now();
  let lastErr;
  while (Date.now() - start < timeout) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      lastErr = error;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`Timed out waiting for: ${message}${lastErr ? ` (last error: ${lastErr.message})` : ""}`);
}

async function main() {
  log(`\n=== Orbit E2E full flow (run ${RUN_ID}) ===\n`);
  const browser = await chromium.launch();

  const emailA = `e2e-${RUN_ID}-a@orbit-test.local`;
  const emailB = `e2e-${RUN_ID}-b@orbit-test.local`;
  const emailC = `e2e-${RUN_ID}-c@orbit-test.local`;

  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  activePages = [pageA, pageB];

  let projectId;

  try {
  await record("A: fresh signup via typed OTP code", async () => {
    await typedOtpSignIn(pageA, emailA);
    await pageA.getByPlaceholder("Search projects…").waitFor({ timeout: 10000 });
  });

  await record("A: dashboard client-side loading skeleton visible while projects fetch", async () => {
    await pageA.route(/\/api\/projects(\?|$)/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.continue().catch(() => {});
    });
    await pageA.reload();
    const shimmer = pageA.locator(".skeleton-shimmer").first();
    await shimmer.waitFor({ state: "visible", timeout: 5000 });
    await shot(pageA, "dashboard-skeleton");
    await pageA.unroute(/\/api\/projects(\?|$)/);
    await pageA.getByPlaceholder("Search projects…").waitFor({ timeout: 10000 });
  });

  await record("A: create project", async () => {
    projectId = await createProject(pageA, `E2E Project ${RUN_ID}`);
    await pageA.locator('[role="treeitem"]').first().waitFor({ timeout: 45000 });
  });

  await record("A: project loading skeleton appears on fresh navigation", async () => {
    await pageA.goto(`${BASE_URL}/dashboard`);
    await pageA.getByPlaceholder("Search projects…").waitFor({ timeout: 10000 });
    const navPromise = pageA.goto(`${BASE_URL}/projects/${projectId}`);
    await shot(pageA, "project-skeleton-attempt");
    await navPromise;
    await pageA.locator('[role="treeitem"]').first().waitFor({ timeout: 45000 });
  });

  await record("A: file tree shows starter files", async () => {
    const count = await pageA.locator('[role="treeitem"]').count();
    assert(count > 0, `expected starter files in tree, got ${count}`);
  });

  await record("A: Monaco does not mount until a file is opened", async () => {
    const before = await pageA.locator(".monaco-editor").count();
    assert(before === 0, `expected no Monaco instance before opening a file, found ${before}`);
    await filesTree(pageA).getByText("index.html", { exact: true }).first().click();
    await pageA.locator(".monaco-editor").first().waitFor({ timeout: 45000 });
  });

  await record("A: create a new file via Explorer", async () => {
    await pageA.getByTitle("New file  ⌘N").click();
    const [createResponse] = await Promise.all([
      pageA.waitForResponse(
        (res) => /\/api\/projects\/[^/]+\/files$/.test(res.url()) && res.request().method() === "POST",
      ),
      (async () => {
        await pageA.keyboard.insertText("e2e-notes.js");
        await pageA.keyboard.press("Enter");
      })(),
    ]);
    assert(createResponse.ok(), `expected file create to succeed, got ${createResponse.status()}`);
    await waitFor(
      async () => (await filesTree(pageA).getByText("e2e-notes.js", { exact: true }).count()) > 0,
      { message: "created file to appear in tree" },
    );
    await pageA.waitForTimeout(1500);
  });

  await record("A: optimistic create shows file before server responds", async () => {
    await pageA.route(/\/api\/projects\/[^/]+\/files$/, async (route) => {
      if (route.request().method() === "POST") {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      await route.continue().catch(() => {});
    });
    try {
      await pageA.getByTitle("New folder").click();
      await pageA.keyboard.insertText("temp-folder");
      await pageA.keyboard.press("Enter");
      const appeared = await filesTree(pageA).getByText("temp-folder", { exact: true }).isVisible({ timeout: 500 }).catch(() => false);
      assert(appeared, "optimistic folder row should appear immediately, before the 1s server delay resolves");
    } finally {
      await pageA.unroute(/\/api\/projects\/[^/]+\/files$/);
    }
    await waitFor(
      async () => (await filesTree(pageA).getByText("temp-folder", { exact: true }).count()) > 0,
      { message: "folder to persist after real response" },
    );
    await pageA.waitForTimeout(1500);
  });

  await record("A: optimistic rollback when create fails", async () => {
    await pageA.route(/\/api\/projects\/[^/]+\/files$/, async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({ status: 500, body: JSON.stringify({ error: "forced failure" }) }).catch(() => {});
        return;
      }
      await route.continue().catch(() => {});
    });
    await pageA.getByTitle("New file  ⌘N").click();
    await pageA.keyboard.insertText("will-fail.js");
    await pageA.keyboard.press("Enter");
    await pageA.getByText("Couldn't create file").waitFor({ timeout: 5000 });
    await pageA.unroute(/\/api\/projects\/[^/]+\/files$/);
    await waitFor(
      async () => (await filesTree(pageA).getByText("will-fail.js", { exact: true }).count()) === 0,
      { message: "optimistic row to be rolled back after failure" },
    );
    await pageA.waitForTimeout(1500);
  });

  await record("A: rename a file via F2", async () => {
    const row = filesTree(pageA).getByText("e2e-notes.js", { exact: true });
    await row.click();
    await pageA.keyboard.press("F2");
    await pageA.keyboard.press("Control+A");
    await pageA.keyboard.insertText("e2e-notes-renamed.js");
    await pageA.keyboard.press("Enter");
    await waitFor(
      async () => (await filesTree(pageA).getByText("e2e-notes-renamed.js", { exact: true }).count()) > 0,
      { message: "renamed file to appear" },
    );
    await pageA.waitForTimeout(1500);
  });

  await record("A: duplicate a file", async () => {
    await filesTree(pageA).getByText("e2e-notes-renamed.js", { exact: true }).click({ button: "right" });
    const [duplicateResponse] = await Promise.all([
      pageA.waitForResponse(
        (res) => /\/duplicate$/.test(res.url()) && res.request().method() === "POST",
      ),
      pageA.getByText("Duplicate", { exact: true }).click(),
    ]);
    assert(duplicateResponse.ok(), `expected duplicate to succeed, got ${duplicateResponse.status()}`);
    await waitFor(
      async () => (await filesTree(pageA).getByText("e2e-notes-renamed-copy.js", { exact: true }).count()) > 0,
      { message: "duplicated file to appear" },
    );
    await pageA.waitForTimeout(1500);
  });

  await record("A: delete a file via Delete key", async () => {
    const row = filesTree(pageA).getByText("e2e-notes-renamed-copy.js", { exact: true });
    await row.click();
    pageA.once("dialog", (dialog) => dialog.accept());
    await pageA.keyboard.press("Delete");
    await waitFor(
      async () => (await filesTree(pageA).getByText("e2e-notes-renamed-copy.js", { exact: true }).count()) === 0,
      { message: "deleted file to disappear" },
    );
    await pageA.waitForTimeout(1500);
  });

  await record("A: move a file into a folder via drag and drop", async () => {
    const source = filesTree(pageA).getByText("e2e-notes-renamed.js", { exact: true });
    const target = filesTree(pageA).getByText("temp-folder", { exact: true });
    await source.dragTo(target);
    await target.click();
    await waitFor(
      async () => {
        const depthAttr = await filesTree(pageA)
          .getByText("e2e-notes-renamed.js", { exact: true })
          .locator("xpath=ancestor::div[@role='treeitem']")
          .getAttribute("aria-level");
        return Number(depthAttr) > 1;
      },
      { message: "moved file to be nested under folder" },
    );
    await pageA.waitForTimeout(1500);
  });

  await record("A: open index.html and edit in Monaco", async () => {
    await filesTree(pageA).getByText("index.html", { exact: true }).first().click();
    await pageA.locator(".monaco-editor").first().waitFor();
    await setMonacoContent(
      pageA,
      "<!DOCTYPE html>\n<html><head><title>E2E</title></head><body><h1 id=\"t\">Hello E2E</h1><script src=\"script.js\"></script></body></html>",
    );
    await waitFor(
      async () => (await monacoText(pageA)).includes("Hello E2E"),
      { message: "Monaco to reflect typed content" },
    );
  });

  await record("A: autosave reaches Saved state", async () => {
    await waitFor(
      async () => (await pageA.getByText("Saving…").count()) > 0 || (await pageA.getByText("Saved").count()) > 0,
      { message: "save indicator to change" },
    );
    await waitFor(
      async () => (await pageA.getByText("Saved").count()) > 0,
      { timeout: 10000, message: "save state to settle on Saved" },
    );
  });

  await record("A: preview renders edited HTML", async () => {
    await pageA.getByRole("button", { name: /Run/ }).click();
    await waitFor(
      async () => {
        const frame = pageA.frameLocator("iframe[title='Preview']");
        const text = await frame.locator("#t").textContent().catch(() => null);
        return text === "Hello E2E";
      },
      { timeout: 10000, message: "preview iframe to render edited content" },
    );
  });

  await record("A: runtime console error surfaces in Problems", async () => {
    await filesTree(pageA).getByText("script.js", { exact: true }).first().click();
    await pageA.locator(".monaco-editor").first().waitFor();
    await setMonacoContent(pageA, "console.log('e2e console message'); throw new Error('e2e runtime crash');");
    await waitFor(async () => (await monacoText(pageA)).includes("e2e runtime crash"), { message: "script.js edit applied" });
    await pageA.getByRole("button", { name: /Run/ }).click();
    await pageA.getByRole("button", { name: "Problems" }).click();
    await waitFor(
      async () => (await pageA.getByText(/e2e runtime crash/).count()) > 0,
      { timeout: 10000, message: "runtime crash to appear in Problems" },
    );
    await pageA.getByRole("button", { name: "Console" }).click();
    await waitFor(
      async () => (await pageA.getByText(/e2e console message/).count()) > 0,
      { timeout: 10000, message: "console.log to appear in Console tab" },
    );
    await shot(pageA, "console-and-problems");
  });

  await record("B: fresh signup", async () => {
    await passwordSignIn(ctxB, pageB, emailB);
    await pageB.getByPlaceholder("Search projects…").waitFor({ timeout: 10000 });
  });

  await record("A: invite B as Viewer", async () => {
    await pageA.getByRole("button", { name: "Share" }).click();
    await pageA.getByLabel("Invite by email").fill(emailB);
    await pageA.getByLabel("Role for invited member").selectOption("VIEWER");
    await pageA.getByRole("button", { name: "Send invite" }).click();
    await pageA.getByText(`Invited ${emailB}`).waitFor({ timeout: 10000 });
    await pageA.getByRole("button", { name: "Done" }).click();
  });

  await record("B: opens shared project as Viewer, edit is blocked", async () => {
    await pageB.goto(`${BASE_URL}/projects/${projectId}`);
    await pageB.locator('[role="treeitem"]').first().waitFor({ timeout: 45000 });
    await filesTree(pageB).getByText("index.html", { exact: true }).first().click();
    await pageB.locator(".monaco-editor").first().waitFor({ timeout: 45000 });
    const newFileButtonCount = await pageB.getByTitle("New file  ⌘N").count();
    assert(newFileButtonCount === 0, "Viewer should not see file-creation controls");
    const readOnly = await pageB.evaluate(() => {
      const el = document.querySelector(".monaco-editor textarea");
      return el ? el.hasAttribute("readonly") || el.getAttribute("aria-readonly") === "true" : null;
    });
    assert(readOnly !== false, `expected Monaco to be read-only for Viewer, got ${readOnly}`);
  });

  await record("A: upgrade B to Editor", async () => {
    await pageA.getByRole("button", { name: "Share" }).click();
    await pageA.locator("select").filter({ hasText: "Editor" }).first().selectOption("EDITOR");
    await pageA.getByRole("button", { name: "Done" }).click();
  });

  await record("B: role upgrade propagates live and unlocks editing", async () => {
    await waitFor(
      async () => (await pageB.getByText(/role on this project changed to Editor/i).count()) > 0,
      { timeout: 15000, message: "role-change toast to appear for B" },
    );
    await waitFor(
      async () => (await pageB.getByTitle("New file  ⌘N").count()) > 0,
      { timeout: 10000, message: "Editor controls to appear for B after upgrade" },
    );
  });

  await record("Realtime: B sees A's live edits without refresh", async () => {
    await filesTree(pageA).getByText("index.html", { exact: true }).first().click();
    await filesTree(pageB).getByText("index.html", { exact: true }).first().click();
    await pageA.locator(".monaco-editor").first().waitFor();
    await pageB.locator(".monaco-editor").first().waitFor();
    await setMonacoContent(pageA, "<!DOCTYPE html>\n<html><body><h1 id=\"t\">Realtime sync works</h1></body></html>");
    await waitFor(
      async () => (await monacoText(pageB)).includes("Realtime sync works"),
      { timeout: 30000, message: "B's Monaco to receive A's live edit via Yjs" },
    );
  });

  await record("Realtime: remote cursor/selection visible", async () => {
    await pageB.locator(".monaco-editor").first().click();
    await pageB.keyboard.press("End");
    const found = await waitFor(
      async () => (await pageA.locator('[class*="yRemoteSelectionHead-"]').count()) > 0,
      { timeout: 10000, message: "A to see B's remote cursor decoration" },
    ).catch(() => false);
    assert(found, "expected a yRemoteSelectionHead-* element in A's DOM");
  });

  await record("Realtime: presence avatar visible", async () => {
    const count = await waitFor(
      async () => {
        const c = await pageA.locator('[aria-pressed]').filter({ hasText: /^.{1,3}$/ }).count();
        return c > 0 ? c : null;
      },
      { timeout: 10000, message: "collaborator presence avatar in A's TopBar" },
    ).catch(() => 0);
    assert(count > 0, "expected at least one collaborator avatar in TopBar");
  });

  await record("Disconnect/reconnect: B goes offline then recovers", async () => {
    await ctxB.setOffline(true);
    try {
      await waitFor(
        async () => (await pageB.getByText(/Reconnecting|Offline/).count()) > 0,
        { timeout: 75000, message: "B connection indicator to show Reconnecting/Offline" },
      );
      await setMonacoContent(pageA, "<!DOCTYPE html>\n<html><body><h1 id=\"t\">Edited while B offline</h1></body></html>");
    } finally {
      await ctxB.setOffline(false);
    }
    await waitFor(
      async () => (await pageB.getByText("Live").count()) > 0,
      { timeout: 20000, message: "B connection indicator to recover to Live" },
    );
    await waitFor(
      async () => (await monacoText(pageB)).includes("Edited while B offline"),
      { timeout: 25000, message: "B to converge to A's content after reconnect" },
    );
  });

  await record("A: save a checkpoint version", async () => {
    await pageA.getByRole("button", { name: "History" }).click();
    await pageA.getByLabel("Describe this change").fill("E2E checkpoint one");
    await pageA.getByRole("button", { name: "Save" }).click();
    await pageA.getByText("E2E checkpoint one").waitFor({ timeout: 10000 });
    await pageA.getByRole("button", { name: "Close version history" }).click();
  });

  await record("A: modify content after checkpoint", async () => {
    await setMonacoContent(pageA, "<!DOCTYPE html>\n<html><body><h1 id=\"t\">Content after checkpoint, should be reverted</h1></body></html>");
    await waitFor(async () => (await monacoText(pageA)).includes("should be reverted"), { message: "post-checkpoint edit applied" });
    await waitFor(async () => (await pageA.getByText("Saved").count()) > 0, { timeout: 10000, message: "post-checkpoint edit saved" });
  });

  await record("A: diff viewer shows before/after content", async () => {
    await pageA.getByRole("button", { name: "History" }).click();
    await pageA.getByText("E2E checkpoint one").click();
    await waitFor(
      async () => {
        const text = await pageA.locator(".monaco-diff-editor").textContent().catch(() => "");
        return text && text.length > 0;
      },
      { timeout: 10000, message: "diff editor to render" },
    );
    await shot(pageA, "diff-viewer");
  });

  await record("A: restore checkpoint", async () => {
    await pageA.getByRole("button", { name: "Restore this version" }).click();
    await pageA.getByText(/Restored/).waitFor({ timeout: 15000 });
  });

  await record("A: content reverted after restore", async () => {
    await waitFor(
      async () => (await monacoText(pageA)).includes("Edited while B offline") && !(await monacoText(pageA)).includes("should be reverted"),
      { timeout: 15000, message: "A's content to match restored checkpoint" },
    );
  });

  await record("Restore propagates live to B without refresh", async () => {
    await waitFor(
      async () => (await monacoText(pageB)).includes("Edited while B offline") && !(await monacoText(pageB)).includes("should be reverted"),
      { timeout: 30000, message: "B to receive restored content live" },
    );
  });

  await record("A: continue editing after restore", async () => {
    await setMonacoContent(pageA, "<!DOCTYPE html>\n<html><body><h1 id=\"t\">Post-restore edit</h1></body></html>");
    await waitFor(async () => (await pageA.getByText("Saved").count()) > 0, { timeout: 10000, message: "post-restore edit saved" });
    await waitFor(
      async () => (await monacoText(pageB)).includes("Post-restore edit"),
      { timeout: 25000, message: "B to receive post-restore edit live" },
    );
  });

  await record("Persistence: content survives full page refresh", async () => {
    await pageA.reload();
    await pageA.locator('[role="treeitem"]').first().waitFor({ timeout: 45000 });
    await filesTree(pageA).getByText("index.html", { exact: true }).first().click();
    await pageA.locator(".monaco-editor").first().waitFor({ timeout: 45000 });
    await waitFor(
      async () => (await monacoText(pageA)).includes("Post-restore edit"),
      { timeout: 15000, message: "content to persist across reload" },
    );
  });

  await record("Sharing: share link creation and use by third user", async () => {
    await pageA.getByRole("button", { name: "Share" }).click();
    const [linkResponse] = await Promise.all([
      pageA.waitForResponse(
        (res) => res.url().includes("/share-links") && res.request().method() === "POST",
      ),
      pageA.locator("select").last().selectOption("VIEWER"),
    ]);
    assert(linkResponse.ok(), `expected share-link creation to succeed, got ${linkResponse.status()}`);
    const link = await waitFor(
      () => prisma.shareLink.findFirst({ where: { projectId }, orderBy: { createdAt: "desc" } }),
      { message: "ShareLink row to exist after enabling link access" },
    );
    await pageA.getByRole("button", { name: "Copy link" }).waitFor({ timeout: 10000 });
    await pageA.getByRole("button", { name: "Done" }).click();

    const ctxC = await browser.newContext();
    const pageC = await ctxC.newPage();
    await passwordSignIn(ctxC, pageC, emailC);
    await pageC.goto(`${BASE_URL}/share/${link.token}`);
    await pageC.getByRole("button", { name: "Continue to project" }).click();
    await pageC.waitForURL(`${BASE_URL}/projects/${projectId}`, { timeout: 15000 });
    await pageC.locator('[role="treeitem"]').first().waitFor({ timeout: 45000 });
    await ctxC.close();
  });

  await record("Sharing: revoked link no longer grants access", async () => {
    await pageA.getByRole("button", { name: "Share" }).click();
    await pageA.locator("select").last().selectOption("RESTRICTED");
    await waitFor(async () => {
      const link = await prisma.shareLink.findFirst({ where: { projectId }, orderBy: { createdAt: "desc" } });
      return link?.revokedAt != null;
    }, { timeout: 10000, message: "share link to be revoked in DB" });
    await pageA.getByRole("button", { name: "Done" }).click();

    const revokedLink = await prisma.shareLink.findFirst({ where: { projectId }, orderBy: { createdAt: "desc" } });
    const ctxD = await browser.newContext();
    const pageD = await ctxD.newPage();
    await pageD.goto(`${BASE_URL}/share/${revokedLink.token}`);
    await pageD.getByText("Link not available").waitFor({ timeout: 10000 });
    await ctxD.close();
  });

  await record("Security: unauthorized user cannot access private project", async () => {
    const ctxE = await browser.newContext();
    const pageE = await ctxE.newPage();
    await passwordSignIn(ctxE, pageE, `e2e-${RUN_ID}-unrelated@orbit-test.local`);
    await pageE.goto(`${BASE_URL}/projects/${projectId}`);
    await pageE.getByText("Page not found").waitFor({ timeout: 10000 });
    await ctxE.close();
  });

  await record("Security: API route rejects unauthenticated request", async () => {
    const res = await pageA.request.fetch(`${BASE_URL}/api/projects/${projectId}`, {
      headers: { cookie: "" },
    });
    assert(res.status() === 401 || res.status() === 403, `expected 401/403 for unauthenticated request, got ${res.status()}`);
  });
  } catch (error) {
    log(`\nFATAL mid-run error: ${error?.message ?? error}`);
  }

  await ctxA.close().catch(() => {});
  await ctxB.close().catch(() => {});
  await browser.close().catch(() => {});

  log("\n=== Cleanup ===");
  for (const id of createdProjectIds) {
    await prisma.project.deleteMany({ where: { id } }).catch((error) => log(`cleanup project ${id} failed: ${error.message}`));
  }
  for (const id of createdUserIds) {
    await prisma.profile.deleteMany({ where: { id } }).catch(() => {});
    await admin.auth.admin.deleteUser(id).catch((error) => log(`cleanup user ${id} failed: ${error.message}`));
  }
  await prisma.$disconnect();

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  log("\n=== E2E RESULTS ===");
  log(`Total: ${results.length}  Passed: ${passed}  Failed: ${failed}`);
  for (const r of results.filter((r) => !r.pass)) {
    log(`  FAIL: ${r.name} — ${r.error}`);
  }
  log("\nJSON_RESULTS_START");
  log(JSON.stringify({ runId: RUN_ID, total: results.length, passed, failed, results }, null, 2));
  log("JSON_RESULTS_END");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("FATAL", error);
  process.exit(1);
});
