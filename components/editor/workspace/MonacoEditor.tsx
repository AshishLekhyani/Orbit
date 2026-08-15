"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { Awareness } from "y-protocols/awareness";
import { MonacoBinding } from "y-monaco";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setCursor, markDirty, markClean, setSaveState, setLiveContent } from "@/store/slices/editorSlice";
import type { ConnectionState } from "@/store/slices/collaborationSlice";
import { useGetFilesQuery, useGetFileSnapshotQuery, useSaveFileSnapshotMutation } from "@/store/api/filesApi";
import { monacoLanguageFor } from "@/lib/fileMeta";
import { ORBIT_THEME_NAME, orbitMonacoTheme } from "@/lib/monacoTheme";
import { createClient } from "@/lib/supabase/client";
import { SupabaseYjsProvider, type LocalUser } from "@/lib/realtime/SupabaseYjsProvider";
import { syncAwarenessStyles, clearAwarenessStyles } from "@/lib/realtime/awarenessStyles";
import { toBase64, fromBase64 } from "@/lib/realtime/encoding";

const SAVE_DEBOUNCE_MS = 700;
const SAFETY_INTERVAL_MS = 30000;

interface MonacoEditorProps {
  projectId: string;
  fileId: string;
  canEdit: boolean;
  currentUser: LocalUser;
  onConnectionStateChange: (state: ConnectionState) => void;
  pendingLine: number | null;
  onLineHandled: () => void;
  onEditorMount: (editor: editor.IStandaloneCodeEditor) => void;
  saveNowToken: number;
}

export function MonacoEditor({
  projectId,
  fileId,
  canEdit,
  currentUser,
  onConnectionStateChange,
  pendingLine,
  onLineHandled,
  onEditorMount,
  saveNowToken,
}: MonacoEditorProps) {
  const dispatch = useAppDispatch();
  const settings = useAppSelector((state) => state.settings);
  const { data: files = [] } = useGetFilesQuery(projectId);
  const fileNode = files.find((entry) => entry.id === fileId);
  const { data: snapshot, isLoading: snapshotLoading } = useGetFileSnapshotQuery({ projectId, fileId });
  const [saveSnapshot] = useSaveFileSnapshotMutation();

  const [ready, setReady] = useState(false);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const docRef = useRef<Y.Doc | null>(null);
  const awarenessRef = useRef<Awareness | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasPendingChange = useRef(false);
  const supabaseRef = useRef(createClient());
  const autoSaveRef = useRef(settings.autoSave);
  useEffect(() => {
    autoSaveRef.current = settings.autoSave;
  }, [settings.autoSave]);
  const showCursorsRef = useRef(settings.showCollaboratorCursors);
  useEffect(() => {
    showCursorsRef.current = settings.showCollaboratorCursors;
    if (awarenessRef.current) syncAwarenessStyles(awarenessRef.current, showCursorsRef.current);
  }, [settings.showCollaboratorCursors]);

  const flushSnapshot = useCallback(() => {
    const doc = docRef.current;
    if (!doc || !canEdit) return;
    hasPendingChange.current = false;
    dispatch(setSaveState("saving"));
    const content = doc.getText("content").toString();
    const yjsState = toBase64(Y.encodeStateAsUpdate(doc));
    saveSnapshot({ projectId, fileId, content, yjsState })
      .unwrap()
      .then(() => {
        dispatch(markClean(fileId));
        dispatch(setSaveState("saved"));
      })
      .catch(() => {
        dispatch(setSaveState("error"));
      });
  }, [dispatch, saveSnapshot, projectId, fileId, canEdit]);

  const flushIfDirty = useCallback(() => {
    if (hasPendingChange.current) flushSnapshot();
  }, [flushSnapshot]);

  useEffect(() => {
    if (!snapshot) return;
    let cancelled = false;
    const doc = new Y.Doc();
    const ytext = doc.getText("content");
    const persistence = new IndexeddbPersistence(`orbit-file-${fileId}`, doc);
    let provider: SupabaseYjsProvider | null = null;
    let awareness: Awareness | null = null;

    persistence.whenSynced.then(() => {
      if (cancelled) return;

      if (snapshot.yjsState) {
        Y.applyUpdate(doc, fromBase64(snapshot.yjsState), "db-snapshot");
      }

      awareness = new Awareness(doc);
      awarenessRef.current = awareness;
      docRef.current = doc;

      provider = new SupabaseYjsProvider({
        supabase: supabaseRef.current,
        fileId,
        doc,
        awareness,
        localUser: currentUser,
        onConnectionStateChange,
        onInitialSyncSettled: (receivedPeerState) => {
          if (!receivedPeerState && !snapshot.yjsState && ytext.length === 0 && snapshot.content) {
            ytext.insert(0, snapshot.content);
          }
        },
      });

      doc.on("update", () => {
        dispatch(setLiveContent({ path: fileNode?.path ?? fileId, content: ytext.toString() }));
        if (!canEdit) return;
        hasPendingChange.current = true;
        dispatch(markDirty(fileId));
        if (saveTimer.current) clearTimeout(saveTimer.current);
        if (autoSaveRef.current) {
          saveTimer.current = setTimeout(flushSnapshot, SAVE_DEBOUNCE_MS);
        } else {
          dispatch(setSaveState("unsaved"));
        }
      });

      awareness.on("change", () => syncAwarenessStyles(awareness!, showCursorsRef.current));

      setReady(true);
    });

    safetyInterval.current = setInterval(() => {
      if (autoSaveRef.current) flushIfDirty();
    }, SAFETY_INTERVAL_MS);

    return () => {
      cancelled = true;
      setReady(false);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (safetyInterval.current) clearInterval(safetyInterval.current);
      if (autoSaveRef.current) flushIfDirty();
      bindingRef.current?.destroy();
      bindingRef.current = null;
      provider?.destroy();
      awareness?.destroy();
      persistence.destroy();
      doc.destroy();
      clearAwarenessStyles();
      docRef.current = null;
      awarenessRef.current = null;
      onConnectionStateChange("offline");
    };
  }, [snapshot, fileId]);

  useEffect(() => {
    function handleBeforeUnload() {
      if (!hasPendingChange.current || !docRef.current || !canEdit) return;
      const doc = docRef.current;
      const content = doc.getText("content").toString();
      const yjsState = toBase64(Y.encodeStateAsUpdate(doc));
      fetch(`/api/projects/${projectId}/files/${fileId}/snapshot`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, yjsState }),
        keepalive: true,
      }).catch(() => {});
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [projectId, fileId, canEdit]);

  useEffect(() => {
    if (saveNowToken === 0) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    flushIfDirty();
  }, [saveNowToken, flushIfDirty]);

  useEffect(() => {
    if (pendingLine && editorRef.current && ready) {
      editorRef.current.revealLineInCenter(pendingLine);
      editorRef.current.setPosition({ lineNumber: pendingLine, column: 1 });
      editorRef.current.focus();
      onLineHandled();
    }
  }, [pendingLine, onLineHandled, ready]);

  function handleBeforeMount(monaco: Monaco) {
    monaco.editor.defineTheme(ORBIT_THEME_NAME, orbitMonacoTheme);
  }

  const handleMount: OnMount = (editorInstance, monaco) => {
    editorRef.current = editorInstance;
    monaco.editor.setTheme(ORBIT_THEME_NAME);
    onEditorMount(editorInstance);

    const model = editorInstance.getModel();
    if (model && docRef.current && awarenessRef.current) {
      bindingRef.current = new MonacoBinding(
        docRef.current.getText("content"),
        model,
        new Set([editorInstance]),
        awarenessRef.current,
      );
    }

    editorInstance.onDidChangeCursorPosition((event) => {
      dispatch(setCursor({ line: event.position.lineNumber, column: event.position.column }));
    });

    editorInstance.onDidBlurEditorWidget(() => {
      if (autoSaveRef.current) flushIfDirty();
    });

    if (pendingLine) {
      editorInstance.revealLineInCenter(pendingLine);
      editorInstance.setPosition({ lineNumber: pendingLine, column: 1 });
      onLineHandled();
    }
  };

  if (snapshotLoading || !ready || !fileNode) {
    return <div className="flex-1 bg-bg-editor" />;
  }

  return (
    <Editor
      key={fileId}
      language={monacoLanguageFor(fileNode.type)}
      theme={ORBIT_THEME_NAME}
      beforeMount={handleBeforeMount}
      onMount={handleMount}
      options={{
        readOnly: !canEdit,
        fontFamily: "var(--font-mono)",
        fontSize: settings.fontSize,
        tabSize: settings.tabSize,
        detectIndentation: false,
        wordWrap: settings.wordWrap ? "on" : "off",
        minimap: { enabled: settings.minimap },
        lineNumbers: settings.lineNumbers ? "on" : "off",
        automaticLayout: true,
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        cursorBlinking: "smooth",
        renderLineHighlight: "line",
        padding: { top: 12 },
      }}
    />
  );
}
