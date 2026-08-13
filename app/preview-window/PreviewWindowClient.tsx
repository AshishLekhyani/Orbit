"use client";

import { useEffect, useState } from "react";

export function PreviewWindowClient() {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.source !== window.opener) return;
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (data && typeof data === "object" && data.source === "orbit-preview-window" && typeof data.html === "string") {
        setHtml(data.html);
      }
    }

    window.addEventListener("message", handleMessage);
    window.opener?.postMessage({ source: "orbit-preview-window", type: "ready" }, window.location.origin);

    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#08090B" }}>
      {html ? (
        <iframe
          title="Preview"
          sandbox="allow-scripts allow-modals"
          srcDoc={html}
          style={{ width: "100%", height: "100%", border: "none", display: "block" }}
        />
      ) : (
        <div
          style={{
            display: "grid",
            placeItems: "center",
            height: "100%",
            color: "#6E7075",
            fontFamily: "ui-monospace, monospace",
            fontSize: 12,
          }}
        >
          Waiting for preview…
        </div>
      )}
    </div>
  );
}
