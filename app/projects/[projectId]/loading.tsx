export default function ProjectLoading() {
  return (
    <div className="flex h-screen flex-col bg-bg-base">
      <div className="h-11 flex-none border-b border-border-subtle bg-bg-panel px-3.5 py-3">
        <div
          className="skeleton-shimmer h-5 w-40 rounded-sm"
          style={{ background: "linear-gradient(90deg, #16171B 0px, #1E2025 120px, #16171B 240px)" }}
        />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="w-56 flex-none border-r border-border-subtle bg-bg-panel p-2">
          {[1, 2, 3, 4, 5].map((key) => (
            <div
              key={key}
              className="skeleton-shimmer mb-1.5 h-5 rounded-sm"
              style={{ background: "linear-gradient(90deg, #131418 0px, #191A1E 120px, #131418 240px)" }}
            />
          ))}
        </div>
        <div className="flex-1 bg-bg-editor" />
      </div>
    </div>
  );
}
