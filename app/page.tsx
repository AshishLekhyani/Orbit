export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg-base">
      <div className="flex items-center gap-2.5">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <rect x="1" y="1" width="22" height="22" rx="5" fill="#17181C" stroke="#2A2C31" />
          <path d="M12 4.5 L19 12 L12 19.5 L5 12 Z" fill="none" stroke="#E8833A" strokeWidth="1.6" />
          <rect x="8" y="11.1" width="8" height="1.8" fill="#E8833A" />
        </svg>
        <span className="text-title font-semibold text-text-primary">Orbit</span>
      </div>
      <p className="text-body text-text-secondary">Build together. Right in your browser.</p>
    </main>
  );
}
