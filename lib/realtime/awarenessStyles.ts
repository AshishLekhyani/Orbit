import type { Awareness } from "y-protocols/awareness";

const STYLE_ELEMENT_ID = "orbit-yjs-remote-cursors";

function escapeCss(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}

export function syncAwarenessStyles(awareness: Awareness, visible: boolean = true) {
  let styleEl = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = STYLE_ELEMENT_ID;
    document.head.appendChild(styleEl);
  }

  if (!visible) {
    styleEl.textContent = "";
    return;
  }

  const rules: string[] = [];
  awareness.getStates().forEach((state, clientId) => {
    if (clientId === awareness.doc.clientID) return;
    const user = state.user as { name?: string; color?: string } | undefined;
    if (!user?.color) return;
    const color = user.color;
    const name = escapeCss(user.name ?? "Anonymous");

    rules.push(`
      .yRemoteSelection-${clientId} { background-color: ${color}33; }
      .yRemoteSelectionHead-${clientId} {
        position: relative;
        border-left: 2px solid ${color};
      }
      .yRemoteSelectionHead-${clientId}::after {
        content: "${name}";
        position: absolute;
        top: -1.15em;
        left: -2px;
        font-family: "IBM Plex Sans", sans-serif;
        font-size: 10px;
        font-weight: 600;
        line-height: 1.4;
        white-space: nowrap;
        color: #0D0E10;
        background: ${color};
        padding: 1px 5px;
        border-radius: 3px 3px 3px 0;
        pointer-events: none;
        z-index: 30;
      }
    `);
  });

  styleEl.textContent = rules.join("\n");
}

export function clearAwarenessStyles() {
  document.getElementById(STYLE_ELEMENT_ID)?.remove();
}
