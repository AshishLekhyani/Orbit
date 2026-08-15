"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { useGetFileBundleQuery } from "@/store/api/filesApi";
import {
  setDevice,
  setZoom,
  setActiveBottomTab,
  appendConsoleEntry,
  setProblems,
  addProblems,
  startRun,
  setLoading,
  setError,
  type PreviewDevice,
} from "@/store/slices/previewSlice";
import { buildPreviewDoc, mapPreviewLine, type PreviewLineOffset } from "@/lib/buildPreviewDoc";

const REBUILD_DEBOUNCE_MS = 700;

const DEVICE_FRAME: Record<PreviewDevice, { width: string; radius: string; pad: string }> = {
  desktop: { width: "100%", radius: "0px", pad: "0px" },
  tablet: { width: "768px", radius: "10px", pad: "18px" },
  mobile: { width: "390px", radius: "10px", pad: "18px" },
};

const DEVICES: { id: PreviewDevice; glyph: string; name: string }[] = [
  { id: "desktop", glyph: "▭", name: "Desktop" },
  { id: "tablet", glyph: "▯", name: "Tablet" },
  { id: "mobile", glyph: "▪", name: "Mobile" },
];

const ZOOM_STEPS = [100, 75, 50];

const CONSOLE_MESSAGE_TYPES = new Set(["log", "info", "warn", "error"]);

interface PreviewReadyMessage {
  source: "orbit-preview";
  type: "ready";
}
interface PreviewCrashMessage {
  source: "orbit-preview";
  type: "crash";
  text: string;
  line?: number;
  col?: number;
}
interface PreviewConsoleMessage {
  source: "orbit-preview";
  type: "log" | "info" | "warn" | "error";
  text: string;
}
type PreviewMessage = PreviewReadyMessage | PreviewCrashMessage | PreviewConsoleMessage;

function parsePreviewMessage(data: unknown): PreviewMessage | null {
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;
  if (record.source !== "orbit-preview") return null;

  if (record.type === "ready") return { source: "orbit-preview", type: "ready" };

  if (record.type === "crash" && typeof record.text === "string") {
    return {
      source: "orbit-preview",
      type: "crash",
      text: record.text,
      line: typeof record.line === "number" ? record.line : undefined,
      col: typeof record.col === "number" ? record.col : undefined,
    };
  }

  if (typeof record.type === "string" && CONSOLE_MESSAGE_TYPES.has(record.type) && typeof record.text === "string") {
    return { source: "orbit-preview", type: record.type as PreviewConsoleMessage["type"], text: record.text };
  }

  return null;
}

interface PreviewPanelProps {
  projectId: string;
  projectName: string;
  runToken: number;
  onOpenAtLine: (path: string, line: number) => void;
}

export function PreviewPanel({ projectId, projectName, runToken, onOpenAtLine }: PreviewPanelProps) {
  const dispatch = useAppDispatch();
  const device = useAppSelector((state) => state.preview.device);
  const zoom = useAppSelector((state) => state.preview.zoom);
  const isLoading = useAppSelector((state) => state.preview.isLoading);
  const error = useAppSelector((state) => state.preview.error);
  const autoRebuild = useAppSelector((state) => state.settings.autoSave);

  const { data: bundle = [] } = useGetFileBundleQuery(projectId);
  const liveContent = useAppSelector((state) => state.editor.liveContent);

  const [doc, setDoc] = useState<{ html: string; offsets: PreviewLineOffset[] } | null>(null);
  const [buildId, setBuildId] = useState(0);
  const offsetsRef = useRef<PreviewLineOffset[]>([]);
  const mergedFilesRef = useRef<{ path: string; content: string }[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const mergedFiles = useMemo(
    () => bundle.map((file) => ({ path: file.path, content: liveContent[file.path] ?? file.content })),
    [bundle, liveContent],
  );

  useEffect(() => {
    mergedFilesRef.current = mergedFiles;
  }, [mergedFiles]);

  const rebuild = useCallback(() => {
    dispatch(startRun());
    const result = buildPreviewDoc(mergedFilesRef.current);
    if (!result.ok) {
      offsetsRef.current = [];
      setDoc(null);
      dispatch(setLoading(false));
      dispatch(setError({ text: result.error, file: "index.html", line: 1 }));
      return;
    }
    offsetsRef.current = result.offsets;
    setDoc({ html: result.html, offsets: result.offsets });
    setBuildId((id) => id + 1);

    if (result.warnings.length > 0) {
      dispatch(
        setProblems(
          result.warnings.map((warning, index) => ({
            id: `ref-warning-${index}`,
            severity: "warn",
            file: "index.html",
            line: warning.line,
            text: warning.text,
          })),
        ),
      );
      for (const warning of result.warnings) {
        dispatch(appendConsoleEntry({ id: `ref-warning-console-${warning.line}`, type: "warn", text: warning.text }));
      }
    }
  }, [dispatch]);

  useEffect(() => {
    rebuild();
  }, [runToken, rebuild]);

  useEffect(() => {
    if (bundle.length === 0) return;
    if (!autoRebuild) return;
    const timer = setTimeout(rebuild, REBUILD_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [mergedFiles, autoRebuild, bundle.length, rebuild]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return;

      const message = parsePreviewMessage(event.data);
      if (!message) return;

      if (message.type === "ready") {
        dispatch(setLoading(false));
        return;
      }
      if (message.type === "crash") {
        const loc = mapPreviewLine(offsetsRef.current, message.line);
        dispatch(setError({ text: message.text, file: loc.file, line: loc.line }));
        dispatch(
          addProblems([{ id: `crash-${Date.now()}`, severity: "error", file: loc.file, line: loc.line, text: message.text }]),
        );
        dispatch(setActiveBottomTab("problems"));
        return;
      }
      dispatch(
        appendConsoleEntry({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: message.type,
          text: message.text,
        }),
      );
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [dispatch]);

  function handleOpenInNewTab() {
    if (!doc) return;
    const html = doc.html;
    const popup = window.open("/preview-window", "_blank");
    if (!popup) return;

    function handleReady(event: MessageEvent) {
      if (!popup || event.source !== popup) return;
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (data && typeof data === "object" && data.source === "orbit-preview-window" && data.type === "ready") {
        popup.postMessage({ source: "orbit-preview-window", html }, window.location.origin);
        window.removeEventListener("message", handleReady);
      }
    }
    window.addEventListener("message", handleReady);
  }

  const frame = DEVICE_FRAME[device];
  const zoomScale = zoom / 100;
  const zoomWidth = `${10000 / zoom}%`;
  const slug = projectName.toLowerCase().trim().replace(/\s+/g, "-") || "project";

  return (
    <section className="flex h-full flex-col border-l border-border-subtle bg-bg-panel">
      <div className="flex h-8.75 flex-none items-center gap-2 border-b border-border-subtle px-2">
        <button
          onClick={rebuild}
          title="Refresh preview"
          aria-label="Refresh preview"
          className="grid h-6 w-6 flex-none place-items-center rounded-sm text-ui text-text-secondary hover:bg-[#1B1D21] hover:text-text-primary"
        >
          ↻
        </button>
        <div className="flex h-5.5 min-w-0 flex-1 items-center rounded-sm border border-[#22242A] bg-bg-editor px-2.25 font-mono text-[10.5px] text-text-tertiary">
          <span
            className="mr-1.75 block h-1.25 w-1.25 flex-none rounded-full"
            style={{ background: error ? "var(--color-danger)" : "var(--color-ok)" }}
          />
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">{slug} — live preview</span>
        </div>
        <div className="flex flex-none overflow-hidden rounded-sm border border-[#22242A]">
          {DEVICES.map((option) => (
            <button
              key={option.id}
              onClick={() => dispatch(setDevice(option.id))}
              title={option.name}
              aria-label={option.name}
              aria-pressed={device === option.id}
              className="grid h-5.5 w-6.5 place-items-center text-[10px]"
              style={{ color: device === option.id ? "#E9E8E4" : "#6E7075" }}
            >
              {option.glyph}
            </button>
          ))}
        </div>
        <button
          onClick={() =>
            dispatch(setZoom(ZOOM_STEPS[(ZOOM_STEPS.indexOf(zoom) + 1) % ZOOM_STEPS.length]))
          }
          title="Zoom"
          aria-label={`Zoom, currently ${zoom}%`}
          className="flex-none rounded-sm border border-[#22242A] px-1.5 py-0.5 font-mono text-[10.5px] text-text-secondary hover:border-[#3A3D44] hover:text-text-primary"
        >
          {zoom}%
        </button>
        <button
          onClick={handleOpenInNewTab}
          title="Open in new tab"
          aria-label="Open preview in new tab"
          className="grid h-6 w-6 flex-none place-items-center rounded-sm text-ui text-text-secondary hover:bg-[#1B1D21] hover:text-text-primary"
        >
          ↗
        </button>
      </div>

      <div
        className="relative flex flex-1 justify-center overflow-auto bg-[#08090B]"
        style={{ padding: frame.pad }}
      >
        <div
          className="h-full overflow-hidden border border-border-subtle bg-white"
          style={{ width: frame.width, maxWidth: "100%", borderRadius: frame.radius }}
        >
          {doc && (
            <iframe
              key={buildId}
              ref={iframeRef}
              title="Preview"
              sandbox="allow-scripts allow-modals"
              srcDoc={doc.html}
              style={{
                height: "100%",
                minHeight: 480,
                border: "none",
                display: "block",
                transform: `scale(${zoomScale})`,
                transformOrigin: "top left",
                width: zoomWidth,
              }}
            />
          )}
        </div>

        {isLoading && (
          <div className="absolute inset-0 grid place-items-center bg-bg-panel">
            <div className="text-center">
              <div className="mx-auto mb-3 h-4 w-4 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
              <div className="font-mono text-[11px] text-text-muted">Booting preview…</div>
            </div>
          </div>
        )}

        {error && !isLoading && (
          <div className="absolute inset-0 flex flex-col justify-center bg-[rgba(13,14,16,0.94)] px-7">
            <div className="text-body font-semibold text-text-primary">Preview failed</div>
            <div className="mt-2.5 mb-1.5 font-mono text-[11.5px] leading-relaxed break-words text-syntax-keyword">
              {error.text}
            </div>
            <div className="font-mono text-[11px] text-text-muted">
              {error.file}:{error.line}
            </div>
            <div className="mt-4.5 flex gap-2">
              <button
                onClick={() => onOpenAtLine(error.file, error.line)}
                className="rounded-sm bg-accent px-3 py-1.5 text-ui font-medium text-on-accent hover:bg-accent-hover"
              >
                Open in editor
              </button>
              <button
                onClick={rebuild}
                className="rounded-sm border border-border-strong bg-[#17191D] px-3 py-1.5 text-ui text-text-primary hover:border-[#3A3D44]"
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
