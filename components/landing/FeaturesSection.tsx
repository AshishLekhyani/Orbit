const FEATURES = [
  {
    title: "Code together",
    body: "Real-time collaboration with live cursors, shared selections, and synchronized editing.",
    icon: <span className="block h-2 w-2 rounded-full bg-accent" />,
  },
  {
    title: "See it instantly",
    body: "Write code and watch changes land in the live preview beside it, with console and errors attached.",
    icon: <span className="block h-[9px] w-[9px] border border-accent" />,
  },
  {
    title: "Built for developers",
    body: "Files, console, keyboard shortcuts, version history, and a command palette that keeps up with you.",
    icon: <span className="block h-0.5 w-2.5 bg-accent" />,
  },
];

export function FeaturesSection() {
  return (
    <section className="mt-24 border-t border-border-subtle bg-bg-base">
      <div className="mx-auto grid max-w-[1080px] grid-cols-1 gap-12 px-8 py-16 md:grid-cols-3">
        {FEATURES.map((feature) => (
          <div key={feature.title}>
            <div className="mb-4 grid h-[26px] w-[26px] place-items-center rounded-sm border border-border-strong">
              {feature.icon}
            </div>
            <h3 className="m-0 mb-2 text-[15px] font-semibold text-text-primary">
              {feature.title}
            </h3>
            <p className="m-0 text-body text-text-secondary">{feature.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
