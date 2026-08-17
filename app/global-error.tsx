"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0D0E10",
          color: "#E9E8E4",
          fontFamily: "system-ui, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>
            Something went wrong
          </h1>
          <p style={{ margin: "0 0 26px", fontSize: 13.5, lineHeight: 1.6, color: "#9A9B9F" }}>
            Orbit hit an unexpected error and couldn&apos;t finish loading.
          </p>
          {error.digest && (
            <p
              style={{
                margin: "0 0 26px",
                fontFamily: "ui-monospace, monospace",
                fontSize: 11,
                color: "#6E7075",
              }}
            >
              Reference: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              background: "#E8833A",
              color: "#17110B",
              border: "none",
              borderRadius: 8,
              padding: "9px 18px",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
