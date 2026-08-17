import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safeRedirect";

describe("safeRedirectPath", () => {
  it("keeps ordinary in-app paths", () => {
    expect(safeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("/projects/abc-123")).toBe("/projects/abc-123");
    expect(safeRedirectPath("/share/tok?x=1")).toBe("/share/tok?x=1");
  });

  it("falls back to the dashboard when absent", () => {
    expect(safeRedirectPath(null)).toBe("/dashboard");
    expect(safeRedirectPath(undefined)).toBe("/dashboard");
    expect(safeRedirectPath("")).toBe("/dashboard");
  });

  it("rejects absolute URLs to other origins", () => {
    expect(safeRedirectPath("https://evil.test/steal")).toBe("/dashboard");
    expect(safeRedirectPath("http://evil.test")).toBe("/dashboard");
  });

  it("rejects protocol-relative and backslash tricks", () => {
    const protocolRelative = "/".repeat(2) + "evil.test/steal";
    expect(safeRedirectPath(protocolRelative)).toBe("/dashboard");
    expect(safeRedirectPath("/\\evil.test")).toBe("/dashboard");
  });

  it("rejects scheme-like values that do not start with a slash", () => {
    expect(safeRedirectPath("javascript:alert(1)")).toBe("/dashboard");
    expect(safeRedirectPath("dashboard")).toBe("/dashboard");
  });
});
