export interface PreviewSourceFile {
  path: string;
  content: string;
}

export interface PreviewLineOffset {
  file: string;
  start: number;
  end: number;
}

export interface PreviewWarning {
  text: string;
  line: number;
}

export type PreviewBuildResult =
  | { ok: true; html: string; offsets: PreviewLineOffset[]; warnings: PreviewWarning[] }
  | { ok: false; error: string };

const CAPTURE_SCRIPT = `<script>
(function () {
  function send(type) {
    return function () {
      var text = Array.prototype.slice.call(arguments).map(function (arg) {
        try {
          return typeof arg === "object" ? JSON.stringify(arg) : String(arg);
        } catch (err) {
          return String(arg);
        }
      }).join(" ");
      parent.postMessage({ source: "orbit-preview", type: type, text: text }, "*");
    };
  }
  ["log", "warn", "error", "info"].forEach(function (level) {
    var original = console[level];
    console[level] = function () {
      send(level).apply(null, arguments);
      if (original) original.apply(console, arguments);
    };
  });
  window.onerror = function (message, source, line, col) {
    parent.postMessage({ source: "orbit-preview", type: "crash", text: String(message), line: line, col: col }, "*");
    return false;
  };
  window.addEventListener("unhandledrejection", function (event) {
    var reason = event && event.reason;
    var text = reason instanceof Error ? reason.message : String(reason);
    parent.postMessage({ source: "orbit-preview", type: "crash", text: "Unhandled promise rejection: " + text }, "*");
  });
  parent.postMessage({ source: "orbit-preview", type: "ready" }, "*");
})();
</script>`;

function normalizePath(path: string): string {
  return path.replace(/^(\.\/|\/)+/, "");
}

function isExternalUrl(src: string): boolean {
  const isProtocolRelative = src.charAt(0) === "/" && src.charAt(1) === "/";
  return src.startsWith("http://") || src.startsWith("https://") || isProtocolRelative || src.startsWith("data:");
}

function lineAt(text: string, matchedSnippet: string): number {
  const index = text.indexOf(matchedSnippet);
  return index === -1 ? 1 : text.slice(0, index).split("\n").length;
}

export function buildPreviewDoc(files: PreviewSourceFile[]): PreviewBuildResult {
  const byPath = new Map<string, string>();
  for (const file of files) {
    byPath.set(file.path, file.content);
    byPath.set(normalizePath(file.path), file.content);
  }
  const entry = byPath.get("index.html");

  if (entry === undefined) {
    return { ok: false, error: "No index.html found in this project." };
  }

  const warnings: PreviewWarning[] = [];

  let html = entry.replace(/<link[^>]*href="([^"]+\.css)"[^>]*>/g, (match, href: string) => {
    const css = byPath.get(href) ?? byPath.get(normalizePath(href));
    if (css === undefined) {
      if (!isExternalUrl(href)) {
        warnings.push({ text: `Referenced stylesheet "${href}" was not found in this project.`, line: lineAt(entry, match) });
      }
      return match;
    }
    return `<style>\n${css}\n</style>`;
  });

  html = html.replace(
    /<script([^>]*)\ssrc="([^"]+\.js)"([^>]*)>\s*<\/script>/g,
    (match, _before: string, src: string) => {
      const js = byPath.get(src) ?? byPath.get(normalizePath(src));
      if (js === undefined) {
        if (!isExternalUrl(src)) {
          warnings.push({ text: `Referenced script "${src}" was not found in this project.`, line: lineAt(entry, match) });
        }
        return match;
      }
      return `<script data-f="${src}">\n${js}\n</script>`;
    },
  );

  html = html.includes("<head>") ? html.replace("<head>", `<head>\n${CAPTURE_SCRIPT}`) : CAPTURE_SCRIPT + html;

  const lines = html.split("\n");
  const offsets: PreviewLineOffset[] = [];
  let current: { file: string; start: number } | null = null;
  lines.forEach((line, index) => {
    const openMatch = line.match(/<script data-f="([^"]+)">/);
    if (openMatch) {
      current = { file: openMatch[1], start: index + 2 };
    } else if (current && line.trim() === "</script>") {
      offsets.push({ file: current.file, start: current.start, end: index });
      current = null;
    }
  });

  return { ok: true, html, offsets, warnings };
}

export function mapPreviewLine(
  offsets: PreviewLineOffset[],
  line: number | undefined,
): { file: string; line: number } {
  if (line !== undefined) {
    for (const offset of offsets) {
      if (line >= offset.start && line <= offset.end) {
        return { file: offset.file, line: line - offset.start + 1 };
      }
    }
  }
  return { file: "index.html", line: line ?? 1 };
}
