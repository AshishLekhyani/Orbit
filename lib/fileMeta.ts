export function detectFileType(name: string): "HTML" | "CSS" | "JS" | "JSON" | "MARKDOWN" | "OTHER" {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "html":
    case "htm":
      return "HTML";
    case "css":
      return "CSS";
    case "js":
    case "mjs":
    case "cjs":
      return "JS";
    case "json":
      return "JSON";
    case "md":
      return "MARKDOWN";
    default:
      return "OTHER";
  }
}

export function monacoLanguageFor(type: string): string {
  switch (type) {
    case "HTML":
      return "html";
    case "CSS":
      return "css";
    case "JS":
      return "javascript";
    case "JSON":
      return "json";
    case "MARKDOWN":
      return "markdown";
    default:
      return "plaintext";
  }
}

export function joinPath(parentPath: string | null, name: string): string {
  return parentPath ? `${parentPath}/${name}` : name;
}

export function withCopySuffix(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? `${name.slice(0, dot)}-copy${name.slice(dot)}` : `${name}-copy`;
}

export function fileTypeLabel(type: string): string {
  switch (type) {
    case "HTML":
      return "HTML";
    case "CSS":
      return "CSS";
    case "JS":
      return "JavaScript";
    case "JSON":
      return "JSON";
    case "MARKDOWN":
      return "Markdown";
    default:
      return "Plain Text";
  }
}
