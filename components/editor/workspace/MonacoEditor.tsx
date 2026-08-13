"use client";

import { useCallback, useEffect, useRef } from "react";
import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setCursor, markDirty, markClean, setSaveState } from "@/store/slices/editorSlice";
import { useGetFileQuery, useSaveFileContentMutation } from "@/store/api/filesApi";
import { monacoLanguageFor } from "@/lib/fileMeta";
import { ORBIT_THEME_NAME, orbitMonacoTheme } from "@/lib/monacoTheme";

const SAVE_DEBOUNCE_MS = 700;

interface MonacoEditorProps {
  projectId: string;
  fileId: string;
  canEdit: boolean;
  pendingLine: number | null;
  onLineHandled: () => void;
  onEditorMount: (editor: editor.IStandaloneCodeEditor) => void;
  saveNowToken: number;
}

export function MonacoEditor({
  projectId,
  fileId,
  canEdit,
  pendingLine,
  onLineHandled,
  onEditorMount,
  saveNowToken,
}: MonacoEditorProps) {
  const dispatch = useAppDispatch();
  const settings = useAppSelector((state) => state.settings);
  const { data: file, isLoading } = useGetFileQuery({ projectId, fileId });
  const [saveContent] = useSaveFileContentMutation();

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestContent = useRef<string>("");
  const hasPendingChange = useRef(false);

  const flushSave = useCallback(
    (content: string) => {
      hasPendingChange.current = false;
      dispatch(setSaveState("saving"));
      saveContent({ projectId, fileId, content })
        .unwrap()
        .then(() => {
          dispatch(markClean(fileId));
          dispatch(setSaveState("saved"));
        })
        .catch(() => {
          dispatch(setSaveState("error"));
        });
    },
    [dispatch, saveContent, projectId, fileId],
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  useEffect(() => {
    if (saveNowToken === 0) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (hasPendingChange.current) flushSave(latestContent.current);
  }, [saveNowToken, flushSave]);

  useEffect(() => {
    if (pendingLine && editorRef.current) {
      editorRef.current.revealLineInCenter(pendingLine);
      editorRef.current.setPosition({ lineNumber: pendingLine, column: 1 });
      editorRef.current.focus();
      onLineHandled();
    }
  }, [pendingLine, onLineHandled]);

  function handleChange(value: string | undefined) {
    const content = value ?? "";
    latestContent.current = content;
    hasPendingChange.current = true;
    dispatch(markDirty(fileId));

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => flushSave(latestContent.current), SAVE_DEBOUNCE_MS);
  }

  function handleBeforeMount(monaco: Monaco) {
    monaco.editor.defineTheme(ORBIT_THEME_NAME, orbitMonacoTheme);
  }

  const handleMount: OnMount = (editorInstance, monaco) => {
    editorRef.current = editorInstance;
    monaco.editor.setTheme(ORBIT_THEME_NAME);
    onEditorMount(editorInstance);

    editorInstance.onDidChangeCursorPosition((event) => {
      dispatch(setCursor({ line: event.position.lineNumber, column: event.position.column }));
    });

    if (pendingLine) {
      editorInstance.revealLineInCenter(pendingLine);
      editorInstance.setPosition({ lineNumber: pendingLine, column: 1 });
      onLineHandled();
    }
  };

  if (isLoading || !file) {
    return <div className="flex-1 bg-bg-editor" />;
  }

  return (
    <Editor
      key={fileId}
      language={monacoLanguageFor(file.type)}
      defaultValue={file.content}
      theme={ORBIT_THEME_NAME}
      beforeMount={handleBeforeMount}
      onMount={handleMount}
      onChange={canEdit ? handleChange : undefined}
      options={{
        readOnly: !canEdit,
        fontFamily: "var(--font-mono)",
        fontSize: settings.fontSize,
        tabSize: settings.tabSize,
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
