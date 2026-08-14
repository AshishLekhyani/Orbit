export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-bg-base px-8 pt-19.5">
      <div
        className="skeleton-shimmer h-6.5 w-65 rounded-sm"
        style={{ background: "linear-gradient(90deg, #16171B 0px, #1E2025 120px, #16171B 240px)" }}
      />
      <div className="mt-8.5 h-3 w-30 rounded-xs bg-bg-raised" />
      <div className="mt-10 grid grid-cols-[repeat(auto-fill,minmax(268px,1fr))] gap-3.5">
        {[1, 2, 3, 4, 5, 6].map((key) => (
          <div
            key={key}
            className="skeleton-shimmer h-32 rounded-md border border-border-subtle"
            style={{ background: "linear-gradient(90deg, #131418 0px, #191A1E 120px, #131418 240px)" }}
          />
        ))}
      </div>
    </div>
  );
}
