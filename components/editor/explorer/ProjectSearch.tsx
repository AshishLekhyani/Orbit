"use client";

import { useEffect, useRef, useState } from "react";
import { useLazySearchFilesQuery } from "@/store/api/filesApi";

interface ProjectSearchProps {
  projectId: string;
  onOpenAtLine?: (fileId: string, path: string, line: number) => void;
}

export function ProjectSearch({ projectId, onOpenAtLine }: ProjectSearchProps) {
  const [query, setQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [search, { data: results = [], isFetching }] = useLazySearchFilesQuery();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    const timeout = setTimeout(
      () => search({ projectId, query: trimmed, caseSensitive, wholeWord }),
      250,
    );
    return () => clearTimeout(timeout);
  }, [query, caseSensitive, wholeWord, projectId, search]);

  const totalMatches = results.reduce((sum, file) => sum + file.matches.length, 0);
  const summary =
    query.trim().length < 2
      ? ""
      : isFetching
        ? "Searching…"
        : totalMatches === 0
          ? "No results"
          : `${totalMatches} ${totalMatches === 1 ? "result" : "results"} in ${results.length} ${results.length === 1 ? "file" : "files"}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-none border-b border-[#17191D] px-2.5 py-2">
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search in project"
          className="h-7 w-full rounded-xs border border-border-strong bg-bg-editor px-2.25 font-mono text-[11.5px] text-text-primary outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/12"
        />
        <div className="mt-2 flex items-center gap-2.5">
          <button
            onClick={() => setCaseSensitive((value) => !value)}
            title="Match case"
            className={`rounded-xs border border-border-strong px-1.5 py-0.5 font-mono text-[10px] ${
              caseSensitive ? "bg-accent text-on-accent" : "bg-transparent text-text-tertiary"
            }`}
          >
            Aa
          </button>
          <button
            onClick={() => setWholeWord((value) => !value)}
            title="Whole word"
            className={`rounded-xs border border-border-strong px-1.5 py-0.5 font-mono text-[10px] ${
              wholeWord ? "bg-accent text-on-accent" : "bg-transparent text-text-tertiary"
            }`}
          >
            ab
          </button>
          <span className="ml-auto font-mono text-[10px] text-text-muted">{summary}</span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-1 py-1.5">
        {query.trim().length < 2 && (
          <div className="px-2 py-4 text-[11.5px] leading-relaxed text-text-faint">
            Search across every file in this project. ⇧⌘F opens it from anywhere.
          </div>
        )}
        {query.trim().length >= 2 && !isFetching && results.length === 0 && (
          <div className="px-2 py-4 text-[11.5px] leading-relaxed text-text-faint">
            No matches for &quot;{query}&quot;. Try a different term or turn off match case.
          </div>
        )}
        {results.map((file) => (
          <div key={file.fileId} className="mb-1.5">
            <div className="px-2 py-1 font-mono text-[10.5px] text-text-muted">{file.path}</div>
            {file.matches.map((match) => (
              <button
                key={match.line}
                onClick={() => onOpenAtLine?.(file.fileId, file.path, match.line)}
                className="flex w-full items-baseline gap-1.75 rounded-sm px-2 py-1 text-left hover:bg-[#191B1F]"
              >
                <span className="flex-none font-mono text-[9.5px] text-text-faint">
                  {match.line}
                </span>
                <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11.5px] text-text-secondary">
                  {match.text}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
