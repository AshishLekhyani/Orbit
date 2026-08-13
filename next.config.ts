import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      "monaco-editor/esm/vs/editor/editor.api.js":
        "./node_modules/monaco-editor/esm/vs/editor/editor.api.js",
    },
  },
};

export default nextConfig;
