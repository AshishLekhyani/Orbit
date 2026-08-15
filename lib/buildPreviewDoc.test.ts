import { describe, expect, it } from "vitest";
import { buildPreviewDoc } from "./buildPreviewDoc";

describe("buildPreviewDoc", () => {
  it("inlines css/js referenced with exact paths", () => {
    const result = buildPreviewDoc([
      { path: "index.html", content: '<link href="styles.css"><script src="script.js"></script>' },
      { path: "styles.css", content: "body { color: red; }" },
      { path: "script.js", content: "console.log(1);" },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.html).toContain("body { color: red; }");
    expect(result.html).toContain("console.log(1);");
  });

  it("inlines css/js referenced with a leading ./ even though project paths have none", () => {
    const result = buildPreviewDoc([
      { path: "index.html", content: '<link href="./styles.css"><script src="./script.js"></script>' },
      { path: "styles.css", content: "body { color: blue; }" },
      { path: "script.js", content: "console.log(2);" },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.html).toContain("body { color: blue; }");
    expect(result.html).toContain("console.log(2);");
  });

  it("inlines css/js referenced with a leading /", () => {
    const result = buildPreviewDoc([
      { path: "index.html", content: '<script src="/script.js"></script>' },
      { path: "script.js", content: "console.log(3);" },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.html).toContain("console.log(3);");
  });

  it("warns when a referenced script does not match any project file", () => {
    const result = buildPreviewDoc([
      {
        path: "index.html",
        content: '<!DOCTYPE html>\n<body>\n<script src="./support.js"></script>\n</body>',
      },
      { path: "script.js", content: "console.log(1);" },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([
      { text: 'Referenced script "./support.js" was not found in this project.', line: 3 },
    ]);
    expect(result.html).toContain('<script src="./support.js"></script>');
  });

  it("does not warn about external CDN scripts/stylesheets left untouched", () => {
    const protocolRelative = "/".repeat(2) + "cdn.example.com/lib.js";
    const result = buildPreviewDoc([
      {
        path: "index.html",
        content:
          '<link href="https://fonts.googleapis.com/css2?family=Inter">\n' +
          '<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>\n' +
          `<script src="${protocolRelative}"></script>`,
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
    expect(result.html).toContain("https://unpkg.com/react@18/umd/react.production.min.js");
  });

  it("returns an error when index.html is missing", () => {
    const result = buildPreviewDoc([{ path: "script.js", content: "console.log(1);" }]);
    expect(result.ok).toBe(false);
  });
});
